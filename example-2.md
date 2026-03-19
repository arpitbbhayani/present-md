## Databases Were Not Designed For This

**Arpit Bhayani** | arpitbhayani.me

> Agentic AI systems violate the implicit contract of database architecture at every layer simultaneously.

---

## The Implicit Contract (That No Longer Holds)

For 40 years, databases assumed:

- caller is a human-authored, deterministic application
- writes are intentional and reviewed before deployment
- connections are brief
- failures are loud and noticed by a human
- schema is a contract with engineering

Agents break every single one of these assumptions.

---

## Assumption 1: Deterministic Caller

Traditional tooling is built around predictable query patterns:

- Postgres query planner builds statistics on observed patterns
- caching layers warm up on repeated queries
- connection pools sized around known concurrency and query complexity

**Agents reason their way to queries** -- same tables, wildly different joins each time

- a customer analytics agent might join 5 tables that have never been joined before
- holds the connection while the LLM thinks, then issues a different follow-up
- your indexes cover the happy path; agent queries may not hit them

---

## Fix: Statement Timeouts at the Role Level

A 30s human query is a bug someone notices. A 30s agent query might be an unattended reasoning loop.

```sql
CREATE ROLE agent_worker;
ALTER ROLE agent_worker SET statement_timeout = '5s';
ALTER ROLE agent_worker SET idle_in_transaction_session_timeout = '10s';
```

- `idle_in_transaction_session_timeout` is critical -- agents pause mid-reasoning while holding open transactions
- set at the **role level**, not just the application level -- survives misconfigured app code

---

## Assumption 2: Writes Are Intentional

Every write in traditional systems was reviewed by a human. Agents write:

- based on potentially wrong understanding of the task
- in loops when tools return unexpected results
- on retries when transient errors make them think the first attempt failed
- thousands of rows before anyone gets a Slack notification

**Real failure pattern:** agent calls legacy API, receives HTTP `200` with empty body (silent DB failure upstream), interprets "no data" as "no problem", approves 500 transactions with incomplete data. No exception. No alert. Log shows `decision: approved` on every record.

---

## Fix: Soft Deletes Everywhere

Never let an agent hard-delete anything.

```sql
ALTER TABLE orders ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN deleted_by TEXT; -- 'agent:customer-support-v2'
ALTER TABLE orders ADD COLUMN delete_reason TEXT;

-- agents query this view; they never see deleted rows
CREATE VIEW active_orders AS
  SELECT * FROM orders WHERE deleted_at IS NULL;
```

`deleted_by` is not optional -- "show me everything agent X deleted in the last 2 hours" is a query you will need.

---

## Fix: Append-only Event Logs

For high-stakes writes (financial, inventory, user state): no `UPDATE`, no `DELETE` -- only `INSERT` with new state and reason.

```sql
CREATE TABLE order_state_log (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id         UUID NOT NULL REFERENCES orders(id),
  previous_status  TEXT,
  new_status       TEXT NOT NULL,
  changed_by       TEXT NOT NULL,   -- agent identity
  changed_at       TIMESTAMPTZ DEFAULT now(),
  reason           TEXT,
  idempotency_key  TEXT UNIQUE       -- deduplicates retries
);
```

Event sourcing at the table level. "Undo" becomes a projection query.

---

## Fix: Idempotency Keys Are Not Optional

Every orchestration framework uses at-least-once delivery. Agents **will** retry.

```sql
ALTER TABLE order_state_log
  ADD CONSTRAINT uq_idempotency_key UNIQUE (idempotency_key);
```

Construct the key deterministically from the logical operation:

```python
import hashlib

def make_idempotency_key(task_id: str,
    operation: str, target_id: str) -> str:
    raw = f"{task_id}:{operation}:{target_id}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]
```

`task_id` is stable across retries of the same logical task. DB sees exactly one write per logical operation regardless of how many retries occur.

---

## Assumption 3: Connections Are Brief

Traditional sizing: `N` concurrent requests, one short-lived connection each.

Agents break this three ways:

1. **hold connections longer** -- query + LLM inference time + reasoning steps, repeated
2. **fan out** -- one high-level task spawns 5 sub-agents, each needing a session
3. **multiply unexpectedly** -- 3 agents in dev, 30 in prod, nobody updated pool config

```
connection time per task = query exec time + (LLM inference time × reasoning steps)
```

---

## Fix: Dedicated Agent Connection Pool

```python
agent_engine = create_engine(
    DATABASE_URL,
    pool_size=10,        # base pool for agents
    max_overflow=5,      # burst capacity
    pool_timeout=3,      # fail fast, not queue -- prevents cascading failure
    pool_recycle=300,    # recycle every 5 min
    pool_pre_ping=True,  # validate before checkout
    connect_args={
        "options": "-c statement_timeout=5000 -c idle_in_transaction_session_timeout=10000"
    }
)
# rule of thumb: num_agent_workers * avg_concurrent_steps * 0.5
# 0.5 because most agent steps involve LLM time, not DB time
```

Separate pool from human-facing traffic. `pool_timeout=3` forces fast-fail-and-retry, not indefinite queuing.

---

## Fix: PgBouncer in Transaction Pooling Mode

20 real Postgres connections can serve 500 agent connections.

```ini
# pgbouncer.ini
[pgbouncer]
pool_mode = transaction    # release connection after each txn, not each session
max_client_conn = 500      # agents can connect up to this
default_pool_size = 20     # actual postgres connections (much smaller)
reserve_pool_size = 5      # emergency capacity
reserve_pool_timeout = 1.0 # fail fast if reserve is exhausted
```

In transaction pooling mode, a Postgres connection is held only for the duration of one transaction -- not the entire multi-step agent session.

---

## Assumption 4: Bad Queries Fail Loudly

In human-operated systems: slow query → dashboard sluggish → engineer runs `EXPLAIN ANALYZE` → fix. Feedback loop is tight.

Agents close that loop:

- slow result → agent just uses it
- empty result set → agent cannot distinguish "data does not exist" from "query was wrong"
- semantically wrong query that returns rows → **completely unobservable** by standard tooling

An exception is observable. A wrong query that returns plausible rows is not.

---

## Fix: Tag Every Agent Query

Standard slow query logs are insufficient. You need: which agent, which task, which reasoning step.

```python
@event.listens_for(Engine, "before_cursor_execute")
def add_agent_context_comment(conn, cursor, statement,
                              parameters, context, executemany):
    agent_ctx = getattr(conn.info, "agent_context", None)
    if agent_ctx:
        statement = (
            f"/* agent_id={agent_ctx['agent_id']}, "
            f"task_id={agent_ctx['task_id']}, "
            f"step={agent_ctx['step']} */ {statement}"
        )
    return statement, parameters
```

Comments surface in `pg_stat_activity`, `pg_stat_statements`, and slow query logs.

---

## Fix: Agent-Aware Monitoring View

```sql
SELECT
  (regexp_match(query, 'agent_id=([^,]+)'))[1]  AS agent_id,
  (regexp_match(query, 'task_id=([^,]+)'))[1]   AS task_id,
  count(*)                                       AS call_count,
  round(mean_exec_time::numeric, 2)              AS avg_ms,
  round(total_exec_time::numeric, 2)             AS total_ms
FROM pg_stat_statements
WHERE query LIKE '%agent_id=%'
GROUP BY 1, 2
ORDER BY total_ms DESC;
```

When one agent type accounts for 60% of total DB time, you know exactly where to look.

---

## Assumption 5: Schema Is a Contract With Engineering

Schema was designed for developer ergonomics. When agents can see your schema (Text-to-SQL, MCP server, tool definitions), **schema becomes a contract with a language model**.

```sql
-- what most schemas look like
CREATE TABLE orders (
  usr_id  UUID,   -- which user?
  stat_cd INT,    -- what does 7 mean?
  flg_1   BOOLEAN -- ???
);

-- what an agent-legible schema looks like
CREATE TABLE orders (
  customer_id        UUID NOT NULL REFERENCES customers(id),
  fulfillment_status TEXT NOT NULL CHECK (
    fulfillment_status IN ('pending','processing','shipped','delivered','cancelled')
  ),
  requires_signature BOOLEAN NOT NULL DEFAULT false
);
```

The second schema generates correct LLM queries almost automatically.

---

## Fix: Agent-Facing View Layer + Column Comments

For legacy schemas you cannot rename:

```sql
CREATE VIEW agent_orders AS
SELECT
  usr_id   AS customer_id,
  CASE stat_cd
    WHEN 1 THEN 'pending'   WHEN 2 THEN 'processing'
    WHEN 5 THEN 'shipped'   WHEN 7 THEN 'delivered'
    WHEN 9 THEN 'cancelled'
  END      AS fulfillment_status,
  flg_1    AS requires_signature,
  upd_ts   AS last_modified_at
FROM orders
WHERE deleted_at IS NULL; -- agents only ever see active rows
```

Write column comments as docstrings -- for Text-to-SQL agents, they are:

```sql
COMMENT ON COLUMN agent_orders.fulfillment_status IS
  'Current state in the fulfillment pipeline. '
  'pending and processing are active. Cancelled orders must never be modified.';
```

---

## Scoping the Blast Radius

Traditional apps share a DB role; application code is the guardrail. Agents are not a finite set of code paths -- a misbehaving agent can issue queries developers never anticipated.

```sql
CREATE ROLE agent_fulfillment;
CREATE ROLE agent_customer_support;
CREATE ROLE agent_analytics;

-- analytics: read-only, only what it needs
GRANT SELECT ON agent_orders, customers TO agent_analytics;
-- explicitly: no access to payments, credentials, PII

-- customer_support: insert to event log, no direct UPDATE on orders
GRANT SELECT ON agent_orders TO agent_customer_support;
GRANT INSERT ON order_state_log TO agent_customer_support;

-- fulfillment: column-level UPDATE only
GRANT SELECT, UPDATE (fulfillment_status, shipped_at, tracking_number)
  ON orders TO agent_fulfillment;
```

Ask not "what does this agent need?" but "what is the worst case if its reasoning goes wrong, or its credentials are compromised?"

---

## The Defensive Data Layer: Full Picture

```
 [Agent A]  [Agent B]  [Agent C]
     \           |          /
      +----- PgBouncer ----+     (transaction pooling mode)
              |
     [Dedicated Agent Pool]      (sized independently from app traffic)
              |
         [Postgres]
              |
    +-- role-level timeouts
    +-- per-agent-type roles (min privilege)
    +-- soft deletes + deleted_by on all writable tables
    +-- append-only event logs for high-stakes writes
    +-- idempotency key constraints
    +-- agent-legible views over legacy tables
    +-- query tagging --> pg_stat_statements monitoring
    +-- circuit breakers (max writes/task, max rows/statement, watchdog)
```

---

## Takeaways

- agents violate all five classic DB assumptions: deterministic caller, intentional writes, brief connections, loud failures, schema-as-dev-contract
- soft deletes, append-only logs, and idempotency keys go from "best practice" to **load-bearing infrastructure**
- role-per-agent-type at the DB level is the only guardrail agents cannot reason around
- query tagging (`agent_id`, `task_id`, `step`) in comments is the minimum viable observability
- PgBouncer in transaction pooling mode is a force multiplier for connection capacity under agentic workloads
- none of this is new technology -- the shift is that deferring these patterns is no longer an option
