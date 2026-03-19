present — what was built
===

## Usage

present slides.md            # serve on :7890, auto-open browser
present slides.md -p 3000    # custom port
present slides.md --no-open  # serve only, print URL

## Image placement syntax

Images use the title attribute (the quoted string after the URL):

```
![alt](image.png "right")              # right half, content goes left
![alt](image.png "left opacity:0.8")   # left half with 80% opacity
![alt](image.png "bg opacity:0.3")     # fullscreen background, 30% opacity
![alt](image.png)                      # inline (default)
```

## Features

- Catppuccin Mocha dark theme — always, no override possible
- IBM Plex Mono throughout (headings, body, code)
- Highlight.js (tokyo-night-dark theme) for code blocks via CDN
- Full markdown: tables, blockquotes, lists, bold/italic, inline code, HR
- Smooth slide transitions with directional animation
- Keyboard: ← → navigate, Space advance, O overview grid, F fullscreen, Home/End
- Touch swipe support
- Progress bar + slide counter HUD
- HTTP server (not file://) so local images load without CORS issues

## Project layout

```
present/
├── src/
│   ├── index.ts      # CLI entry point + HTTP server
│   ├── parser.ts     # Markdown → slides with image extraction
│   └── generate.ts   # Slides → self-contained HTML presentation
├── package.json
└── tsconfig.json
```
