#!/usr/bin/env node
import { readFileSync } from "fs";
import { readFile } from "fs/promises";
import { createServer } from "http";
import { resolve, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import open from "open";
import { parseSlides } from "./parser.js";
import { generateHtml } from "./generate.js";
import puppeteer from "puppeteer";

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
  ".pdf":   "application/pdf",
};

function getMime(filepath: string): string {
  return MIME[extname(filepath).toLowerCase()] ?? "application/octet-stream";
}

async function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.listen(preferred, () => {
      const addr = server.address() as { port: number };
      server.close(() => resolvePort(addr.port));
    });
    server.on("error", () => {
      // Try a random port
      const s2 = createServer();
      s2.listen(0, () => {
        const addr = s2.address() as { port: number };
        s2.close(() => resolvePort(addr.port));
      });
    });
  });
}

async function serve(
  htmlContent: string,
  baseDir: string,
  port: number
): Promise<void> {
  const server = createServer(async (req, res) => {
    const rawUrl = req.url ?? "/";
    // Strip query string
    const urlPath = rawUrl.split("?")[0];
    const decoded = decodeURIComponent(urlPath);

    if (decoded === "/" || decoded === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(htmlContent);
      return;
    }

    // Serve files relative to the markdown file's directory
    const filePath = resolve(baseDir, decoded.replace(/^\//, ""));

    // Basic path traversal guard
    if (!filePath.startsWith(baseDir)) {
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
  });

  await new Promise<void>((resolveServer) => {
    server.listen(port, "127.0.0.1", resolveServer);
  });

  const url = `http://127.0.0.1:${port}`;
  console.log(`\n  present  →  ${url}\n`);
  console.log("  Press Ctrl+C to stop.\n");

  await open(url);

  // Keep process alive
  await new Promise<void>(() => {});
}

async function exportPdf(
  htmlContent: string,
  baseDir: string,
  outputPath: string,
  slideCount: number
): Promise<void> {
  const port = await findFreePort(0);
  const server = createServer(async (req, res) => {
    const rawUrl = req.url ?? "/";
    const decoded = decodeURIComponent(rawUrl.split("?")[0]);
    if (decoded === "/" || decoded === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(htmlContent);
      return;
    }
    const filePath = resolve(baseDir, decoded.replace(/^\//, ""));
    if (!filePath.startsWith(baseDir)) { res.writeHead(403); res.end(); return; }
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": getMime(filePath) });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const url = `http://127.0.0.1:${port}`;

  process.stdout.write("  Generating PDF…");

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
    // Wait for fonts to finish loading
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: outputPath,
      width: "1280px",
      height: "720px",
      printBackground: true,
    });
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }

  process.stdout.write(` done\n`);
  console.log(`  Exported ${slideCount} slide${slideCount !== 1 ? "s" : ""} → ${outputPath}`);
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
  .option("--pdf [output]", "Export presentation as PDF")
  .action(async (file: string, opts: { port: string; open: boolean; pdf?: string | boolean }) => {
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

    console.log(`  Loaded ${slides.length} slide${slides.length !== 1 ? "s" : ""} from ${basename(absPath)}`);

    const html = generateHtml(slides, title);

    if (opts.pdf !== undefined && opts.pdf !== false) {
      const outputPath = typeof opts.pdf === "string"
        ? resolve(process.cwd(), opts.pdf)
        : resolve(process.cwd(), basename(absPath, extname(absPath)) + ".pdf");
      await exportPdf(html, baseDir, outputPath, slides.length);
      process.exit(0);
    }

    const preferredPort = parseInt(opts.port, 10);
    const port = await findFreePort(preferredPort);

    if (opts.open === false) {
      // Just print URL, don't open
      const server = createServer(async (req, res) => {
        const rawUrl = req.url ?? "/";
        const decoded = decodeURIComponent(rawUrl.split("?")[0]);
        if (decoded === "/" || decoded === "/index.html") {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
          return;
        }
        const filePath = resolve(baseDir, decoded.replace(/^\//, ""));
        if (!filePath.startsWith(baseDir)) { res.writeHead(403); res.end(); return; }
        try {
          const data = await readFile(filePath);
          res.writeHead(200, { "Content-Type": getMime(filePath) });
          res.end(data);
        } catch {
          res.writeHead(404);
          res.end("Not found");
        }
      });
      await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
      console.log(`\n  present  →  http://127.0.0.1:${port}\n`);
      await new Promise<void>(() => {});
    } else {
      await serve(html, baseDir, port);
    }
  });

program.parse(process.argv);
