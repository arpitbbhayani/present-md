# present

Browser-based Markdown slide presentations for developers.

Write slides in Markdown, serve them locally, present from your browser.

![Slide showing a code-heavy presentation with syntax highlighting](examples/image.png)

## Installation

```bash
npm install -g @arpitbbhayani/present
```

## Usage

```bash
present slides.md            # serve on :7890, auto-open browser
present slides.md -p 3000    # custom port
present slides.md --no-open  # serve only, print URL
present slides.md --pdf      # export to PDF
```

## Image placement syntax

Images use the title attribute (the quoted string after the URL):

```markdown
![alt](image.png "right")              # right half, content goes left
![alt](image.png "left opacity:0.8")   # left half with 80% opacity
![alt](image.png "bg opacity:0.3")     # fullscreen background, 30% opacity
![alt](image.png)                      # inline (default)
```

## Keyboard shortcuts

| Key             | Action              |
| --------------- | ------------------- |
| `→` / `Space`   | Next slide          |
| `←`             | Previous slide      |
| `O`             | Overview grid       |
| `F`             | Toggle fullscreen   |
| `Home` / `End`  | First / last slide  |

## Features

- Catppuccin Mocha dark theme — always, no override possible
- IBM Plex Mono throughout (headings, body, code)
- Highlight.js (tokyo-night-dark theme) for code blocks via CDN
- Full Markdown: tables, blockquotes, lists, bold/italic, inline code, HR
- Smooth slide transitions with directional animation
- Progress bar + slide counter HUD
- HTTP server (not `file://`) so local images load without CORS issues
- Touch swipe support
- PDF export via `--pdf`

## Examples

See `examples/` for sample slide decks:

- `examples/example-1.md` — feature walkthrough
- `examples/example-2.md` — real-world talk: databases and agentic AI

## Project layout

```
present/
├── src/
│   ├── index.ts      # CLI entry point + HTTP server
│   ├── parser.ts     # Markdown → slides with image extraction
│   └── generate.ts   # Slides → self-contained HTML presentation
├── examples/
│   ├── example-1.md
│   └── example-2.md
├── package.json
└── tsconfig.json
```
