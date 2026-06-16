#!/usr/bin/env node
import { accessSync, constants, readFileSync } from "fs";
import { readFile } from "fs/promises";
import { spawn } from "child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { resolve, dirname, basename, extname, relative, isAbsolute } from "path";
import { Command } from "commander";
import open from "open";
import { parseSlides } from "./parser.js";
import { generateHtml, type ThemeName } from "./generate.js";

const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  magenta:"\x1b[35m",
};

const MIME: Record<string, string> = {
  ".html":  "text/html; charset=utf-8",
  ".css":   "text/css",
  ".js":    "application/javascript",
  ".mjs":   "application/javascript",
  ".json":  "application/json",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".jpeg":  "image/jpeg",
  ".gif":   "image/gif",
  ".svg":   "image/svg+xml",
  ".webp":  "image/webp",
  ".ico":   "image/x-icon",
  ".avif":  "image/avif",
  ".mp4":   "video/mp4",
  ".webm":  "video/webm",
  ".woff":  "font/woff",
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
};

function getMime(filepath: string): string {
  return MIME[extname(filepath).toLowerCase()] ?? "application/octet-stream";
}

function isPathInside(parentDir: string, targetPath: string): boolean {
  const rel = relative(parentDir, targetPath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function buildRequestHandler(htmlContent: string, baseDir: string) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const rawUrl = req.url ?? "/";
    const decoded = decodeURIComponent(rawUrl.split("?")[0]);

    if (decoded === "/" || decoded === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(htmlContent);
      return;
    }

    const filePath = resolve(baseDir, decoded.replace(/^\//, ""));

    if (!isPathInside(baseDir, filePath)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": getMime(filePath) });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  };
}

async function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.listen(preferred, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      server.close(() => resolvePort(addr.port));
    });
    server.on("error", () => {
      // Try a random port
      const s2 = createServer();
      s2.listen(0, "127.0.0.1", () => {
        const addr = s2.address() as { port: number };
        s2.close(() => resolvePort(addr.port));
      });
    });
  });
}

async function startServer(
  htmlContent: string,
  baseDir: string,
  port: number
): Promise<Server> {
  const server = createServer(buildRequestHandler(htmlContent, baseDir));
  await new Promise<void>((resolveServer) => {
    server.listen(port, "127.0.0.1", resolveServer);
  });

  return server;
}

async function waitForServer(server: Server): Promise<void> {
  await new Promise<void>(() => {
    const shutdown = () => {
      server.close(() => process.exit(0));
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

async function serve(
  htmlContent: string,
  baseDir: string,
  port: number
): Promise<void> {
  const server = await startServer(htmlContent, baseDir, port);

  const url = `http://127.0.0.1:${port}`;
  console.log(`${c.bold}${c.magenta}present${c.reset} ${c.dim}→${c.reset} ${c.cyan}${c.bold}${url}${c.reset}  ${c.dim}(Ctrl+C to stop)${c.reset}`);

  await open(url);

  await waitForServer(server);
}

function resolvePdfOutput(markdownPath: string, pdfOption: string | boolean): string {
  if (typeof pdfOption === "string" && pdfOption.trim().length > 0) {
    const output = pdfOption.toLowerCase().endsWith(".pdf")
      ? pdfOption
      : `${pdfOption}.pdf`;
    return resolve(process.cwd(), output);
  }

  return resolve(dirname(markdownPath), `${basename(markdownPath, extname(markdownPath))}.pdf`);
}

function findPdfBrowser(): string | null {
  const envPath = process.env.PRESENT_MD_PDF_BROWSER;
  const candidates = [
    envPath,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep searching.
    }
  }

  return null;
}

async function exportPdf(htmlContent: string, baseDir: string, port: number, outputPath: string): Promise<void> {
  const browserPath = findPdfBrowser();
  if (!browserPath) {
    throw new Error(
      "No Chromium-based browser found for PDF export. Set PRESENT_MD_PDF_BROWSER to a Chrome, Chromium, Brave, or Edge executable."
    );
  }

  const server = await startServer(htmlContent, baseDir, port);
  const url = `http://127.0.0.1:${port}/`;

  try {
    const commonArgs = [
      "--disable-gpu",
      "--run-all-compositor-stages-before-draw",
      "--hide-scrollbars",
      "--no-pdf-header-footer",
      "--virtual-time-budget=5000",
      "--print-to-pdf=" + outputPath,
      url,
    ];

    let lastError: Error | null = null;
    for (const headlessFlag of ["--headless=new", "--headless"]) {
      try {
        await new Promise<void>((resolveExport, rejectExport) => {
          const child = spawn(browserPath, [headlessFlag, ...commonArgs], {
            stdio: ["ignore", "pipe", "pipe"],
          });

          let stderr = "";

          child.stderr.on("data", (chunk) => {
            stderr += String(chunk);
          });

          child.on("error", (err) => {
            rejectExport(err);
          });

          child.on("close", (code) => {
            if (code === 0) {
              resolveExport();
              return;
            }

            rejectExport(new Error(stderr.trim() || `Browser exited with code ${code}`));
          });
        });
        lastError = null;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (lastError) {
      throw lastError;
    }

    accessSync(outputPath, constants.R_OK);
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────
const program = new Command();

program
  .name("present")
  .description("Turn a markdown file into a browser-based developer presentation")
  .version("1.0.0")
  .argument("<file>", "Markdown file to present")
  .option("-p, --port <number>", "Port to serve on", "7890")
  .option("--no-open", "Do not automatically open the browser")
  .option("--pdf [output]", "Export to PDF; optionally specify output path")
  .option("--fullscreen", "Auto-enter fullscreen on first interaction")
  .option("--theme <name>", "Color theme: dark or light", "dark")
  .action(async (file: string, opts: { port: string; open: boolean; pdf?: string | boolean; fullscreen?: boolean; theme: string }) => {
    const absPath = resolve(process.cwd(), file);
    const baseDir = dirname(absPath);
    const title   = basename(absPath, extname(absPath));

    let markdown: string;
    try {
      markdown = readFileSync(absPath, "utf-8");
    } catch (err) {
      console.error(`present: cannot read file '${file}'`);
      process.exit(1);
    }

    const slides = parseSlides(markdown);

    if (slides.length === 0) {
      console.error("present: no slides found in the file.");
      process.exit(1);
    }

    console.log(`${c.dim}${slides.length} slide${slides.length !== 1 ? "s" : ""} from ${basename(absPath)}${c.reset}`);

    const firstHeading = slides[0].html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const slideTitle = firstHeading
      ? firstHeading[1].replace(/<[^>]+>/g, "").trim()
      : "";
    const resolvedTitle = slideTitle || title;

    const theme = (opts.theme === "light" ? "light" : "dark") as ThemeName;
    const html = generateHtml(slides, resolvedTitle, !!opts.fullscreen, theme);

    const preferredPort = parseInt(opts.port, 10);
    const port = await findFreePort(preferredPort);

    if (opts.pdf) {
      const outputPath = resolvePdfOutput(absPath, opts.pdf);
      try {
        await exportPdf(html, baseDir, port, outputPath);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`present: PDF export failed: ${message}`);
        process.exit(1);
      }
      console.log(`${c.bold}${c.green}PDF saved${c.reset} ${c.dim}→${c.reset} ${c.cyan}${outputPath}${c.reset}`);
      return;
    }

    if (opts.open === false) {
      const server = await startServer(html, baseDir, port);
      console.log(`${c.bold}${c.magenta}present${c.reset} ${c.dim}→${c.reset} ${c.cyan}${c.bold}http://127.0.0.1:${port}${c.reset}  ${c.dim}(Ctrl+C to stop)${c.reset}`);
      await waitForServer(server);
      return;
    }

    await serve(html, baseDir, port);
  });

program.parse(process.argv);
