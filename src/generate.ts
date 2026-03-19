import type { Slide } from "./parser.js";

function escAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderSlide(slide: Slide, index: number): string {
  const bgStyle = slide.bgImage
    ? ` style="--slide-bg-url: url('${escAttr(slide.bgImage.src)}'); --slide-bg-opacity: ${slide.bgImage.opacity};"`
    : "";

  const bgLayer = slide.bgImage
    ? `<div class="slide__bg" aria-hidden="true"></div>`
    : "";

  let innerHtml: string;

  if (slide.rightImage) {
    innerHtml = `
      <div class="slide__split">
        <div class="slide__content">${slide.html}</div>
        <div class="slide__image-panel" style="opacity:${slide.rightImage.opacity}">
          <img src="${escAttr(slide.rightImage.src)}" alt="${escAttr(slide.rightImage.alt)}" />
        </div>
      </div>`;
  } else if (slide.leftImage) {
    innerHtml = `
      <div class="slide__split slide__split--left-image">
        <div class="slide__image-panel" style="opacity:${slide.leftImage.opacity}">
          <img src="${escAttr(slide.leftImage.src)}" alt="${escAttr(slide.leftImage.alt)}" />
        </div>
        <div class="slide__content">${slide.html}</div>
      </div>`;
  } else {
    innerHtml = `<div class="slide__content">${slide.html}</div>`;
  }

  return `<div class="slide${slide.bgImage ? " slide--has-bg" : ""}" data-index="${index}"${bgStyle}>
  ${bgLayer}
  ${innerHtml}
</div>`;
}

export function generateHtml(slides: Slide[], title: string): string {
  const slideHtml = slides.map((s, i) => renderSlide(s, i)).join("\n");
  const total = slides.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escAttr(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <style>
/* ── Reset & base ─────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Catppuccin Mocha */
  --crust:    #11111b;
  --mantle:   #181825;
  --base:     #1e1e2e;
  --surface0: #313244;
  --surface1: #45475a;
  --surface2: #585b70;
  --overlay0: #6c7086;
  --overlay1: #7f849c;
  --subtext0: #a6adc8;
  --subtext1: #bac2de;
  --text:     #cdd6f4;
  --lavender: #b4befe;
  --blue:     #89b4fa;
  --sapphire: #74c7ec;
  --sky:      #89dceb;
  --teal:     #94e2d5;
  --green:    #a6e3a1;
  --yellow:   #f9e2af;
  --peach:    #fab387;
  --red:      #f38ba8;
  --mauve:    #cba6f7;
  --pink:     #f5c2e7;
}

html, body {
  height: 100%;
  overflow: hidden;
  background: var(--crust);
  color: var(--text);
  font-family: 'IBM Plex Mono', 'Cascadia Code', 'Fira Code', monospace;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Presentation shell ───────────────────────────────────────────────── */
#presentation {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* ── Slide base ───────────────────────────────────────────────────────── */
.slide {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 6rem;
  opacity: 0;
  pointer-events: none;
  /* forward: enter from right */
  transform: translateX(48px);
  transition:
    opacity 0.38s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.38s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide.is-active {
  opacity: 1;
  transform: translateX(0);
  pointer-events: all;
}

/* Exiting slide direction classes — set by JS before transition */
.slide.exit-left  { opacity: 0; transform: translateX(-48px); }
.slide.exit-right { opacity: 0; transform: translateX(48px); }
.slide.enter-from-left  { transform: translateX(-48px); opacity: 0; }
.slide.enter-from-right { transform: translateX(48px);  opacity: 0; }

/* ── Background image layer ───────────────────────────────────────────── */
.slide--has-bg {
  background: var(--base);
}

.slide__bg {
  position: absolute;
  inset: 0;
  background-image: var(--slide-bg-url);
  background-size: cover;
  background-position: center;
  opacity: var(--slide-bg-opacity, 0.5);
  z-index: 0;
}

.slide--has-bg .slide__content,
.slide--has-bg .slide__split {
  position: relative;
  z-index: 1;
}

/* ── Content area ─────────────────────────────────────────────────────── */
.slide__content {
  width: 100%;
  max-width: 1100px;
  max-height: calc(100vh - 8rem);
  overflow: hidden;
}

/* ── Split layouts ────────────────────────────────────────────────────── */
.slide__split {
  display: flex;
  width: 100%;
  max-width: 1400px;
  height: calc(100vh - 8rem);
  align-items: center;
  gap: 3rem;
}

.slide__split .slide__content {
  flex: 1;
  max-width: none;
}

.slide__image-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 80vh;
}

.slide__image-panel img {
  max-width: 100%;
  max-height: 78vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

/* ── Typography ───────────────────────────────────────────────────────── */
.slide__content h1 {
  font-size: clamp(2rem, 4.5vw, 3.4rem);
  font-weight: 700;
  color: var(--mauve);
  margin-bottom: 1.2rem;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.slide__content h2 {
  font-size: clamp(1.5rem, 3vw, 2.4rem);
  font-weight: 600;
  color: var(--blue);
  margin-bottom: 1rem;
  line-height: 1.25;
}

.slide__content h3 {
  font-size: clamp(1.15rem, 2vw, 1.75rem);
  font-weight: 500;
  color: var(--sky);
  margin-bottom: 0.75rem;
  line-height: 1.3;
}

.slide__content h4 {
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--teal);
  margin-bottom: 0.5rem;
}

.slide__content p {
  font-size: clamp(1rem, 1.6vw, 1.35rem);
  line-height: 1.75;
  margin-bottom: 0.9rem;
  color: var(--text);
}

.slide__content strong {
  color: var(--peach);
  font-weight: 600;
}

.slide__content em {
  color: var(--subtext1);
  font-style: italic;
}

/* ── Lists ────────────────────────────────────────────────────────────── */
.slide__content ul,
.slide__content ol {
  font-size: clamp(0.95rem, 1.5vw, 1.25rem);
  line-height: 1.85;
  padding-left: 1.8rem;
  margin-bottom: 0.9rem;
  color: var(--text);
}

.slide__content li {
  margin-bottom: 0.3rem;
}

.slide__content li::marker {
  color: var(--mauve);
}

.slide__content ul ul,
.slide__content ol ol,
.slide__content ul ol,
.slide__content ol ul {
  margin-top: 0.25rem;
  margin-bottom: 0;
}

/* ── Code ─────────────────────────────────────────────────────────────── */
.slide__content pre {
  margin: 1rem 0;
  border-radius: 8px;
  border: 1px solid var(--surface1);
  overflow-x: auto;
  font-size: clamp(0.75rem, 1.1vw, 1rem);
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
}

/* Override hljs background to match our theme */
.slide__content pre code.hljs {
  background: var(--mantle) !important;
  border-radius: 8px;
  padding: 1.4rem 1.6rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: inherit;
  line-height: 1.65;
}

/* Inline code */
.slide__content :not(pre) > code {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.88em;
  background: var(--surface0);
  color: var(--green);
  border-radius: 4px;
  padding: 0.15em 0.45em;
  border: 1px solid var(--surface1);
}

/* ── Blockquotes ──────────────────────────────────────────────────────── */
.slide__content blockquote {
  border-left: 3px solid var(--mauve);
  padding: 0.6rem 1.5rem;
  margin: 1rem 0;
  background: rgba(203, 166, 247, 0.06);
  border-radius: 0 6px 6px 0;
  color: var(--subtext1);
  font-size: clamp(0.95rem, 1.4vw, 1.2rem);
}

.slide__content blockquote p {
  font-size: inherit;
  margin-bottom: 0;
  color: inherit;
}

/* ── Tables ───────────────────────────────────────────────────────────── */
.slide__content table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
  font-size: clamp(0.85rem, 1.2vw, 1.05rem);
}

.slide__content th {
  background: var(--surface0);
  color: var(--lavender);
  font-weight: 600;
  padding: 0.65rem 1rem;
  text-align: left;
  border: 1px solid var(--surface1);
  border-bottom: 2px solid var(--mauve);
}

.slide__content td {
  padding: 0.55rem 1rem;
  border: 1px solid var(--surface0);
  color: var(--subtext1);
}

.slide__content tr:nth-child(even) td {
  background: rgba(49, 50, 68, 0.3);
}

/* ── Links ────────────────────────────────────────────────────────────── */
.slide__content a {
  color: var(--blue);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

.slide__content a:hover {
  color: var(--lavender);
}

/* ── Inline images (no positioning) ──────────────────────────────────── */
.slide__content img {
  max-width: 100%;
  max-height: 55vh;
  border-radius: 6px;
  display: block;
  margin: 0.75rem auto;
}

/* ── Horizontal rule ──────────────────────────────────────────────────── */
.slide__content hr {
  border: none;
  border-top: 1px solid var(--surface1);
  margin: 1.5rem 0;
}

/* ── HUD (progress + counter) ────────────────────────────────────────── */
#hud {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  pointer-events: none;
}

#progress-bar {
  height: 2px;
  background: var(--surface0);
}

#progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--mauve), var(--blue), var(--teal));
  transition: width 0.3s ease;
  width: 0%;
}

#slide-counter {
  text-align: right;
  padding: 0.35rem 1.2rem 0.45rem;
  font-size: 0.72rem;
  color: var(--overlay1);
  letter-spacing: 0.08em;
}

/* ── Nav arrows ───────────────────────────────────────────────────────── */
.nav-arrow {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--surface1);
  cursor: pointer;
  padding: 1.2rem 0.8rem;
  z-index: 200;
  transition: color 0.2s ease;
  line-height: 1;
  font-size: 1.4rem;
  pointer-events: all;
}

.nav-arrow:hover { color: var(--text); }
.nav-arrow--prev { left: 0.5rem; }
.nav-arrow--next { right: 0.5rem; }

/* ── Overview mode ────────────────────────────────────────────────────── */
#overview {
  position: fixed;
  inset: 0;
  background: var(--crust);
  z-index: 300;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
  overflow-y: auto;
}

#overview.hidden { display: none; }

.overview-thumb {
  background: var(--base);
  border: 2px solid var(--surface0);
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.overview-thumb:hover { border-color: var(--mauve); transform: scale(1.02); }
.overview-thumb.is-current { border-color: var(--blue); }

.overview-thumb__number {
  position: absolute;
  top: 0.4rem;
  left: 0.5rem;
  font-size: 0.65rem;
  color: var(--overlay0);
  z-index: 1;
}

.overview-thumb__inner {
  width: 100%;
  height: 100%;
  transform: scale(0.28);
  transform-origin: top left;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
}

/* ── Kbd hint ─────────────────────────────────────────────────────────── */
#kbd-hint {
  position: fixed;
  bottom: 2.2rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.65rem;
  color: var(--overlay0);
  letter-spacing: 0.06em;
  pointer-events: none;
  opacity: 1;
  transition: opacity 0.6s ease;
  z-index: 150;
}

#kbd-hint.hidden { opacity: 0; }

/* ── Scrollbar ────────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--surface1); border-radius: 3px; }

/* ── Print / PDF export ───────────────────────────────────────────────── */
@media print {
  html, body {
    height: auto !important;
    overflow: visible !important;
    background: var(--crust) !important;
  }

  #presentation {
    position: static !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
  }

  .slide {
    position: relative !important;
    inset: auto !important;
    opacity: 1 !important;
    transform: none !important;
    pointer-events: all !important;
    transition: none !important;
    width: 100vw !important;
    height: 100vh !important;
    page-break-after: always;
    break-after: page;
  }

  .slide:last-of-type {
    page-break-after: avoid;
    break-after: avoid;
  }

  #hud, .nav-arrow, #overview, #kbd-hint {
    display: none !important;
  }
}
  </style>
</head>
<body>

<div id="presentation">
${slideHtml}
</div>

<div id="hud">
  <div id="progress-bar"><div id="progress-fill"></div></div>
  <div id="slide-counter"><span id="cur">1</span>&nbsp;/&nbsp;<span id="tot">${total}</span></div>
</div>

<button class="nav-arrow nav-arrow--prev" id="btn-prev" title="Previous (←)">&#8592;</button>
<button class="nav-arrow nav-arrow--next" id="btn-next" title="Next (→)">&#8594;</button>

<div id="overview" class="hidden"></div>

<div id="kbd-hint">← → navigate &nbsp;·&nbsp; O overview &nbsp;·&nbsp; F fullscreen &nbsp;·&nbsp; Home/End first/last</div>

<script>
(function () {
  'use strict';

  const slides = Array.from(document.querySelectorAll('.slide'));
  const total  = slides.length;
  let cur      = 0;
  let inOverview = false;

  const elCur      = document.getElementById('cur');
  const elFill     = document.getElementById('progress-fill');
  const elBtnPrev  = document.getElementById('btn-prev');
  const elBtnNext  = document.getElementById('btn-next');
  const elOverview = document.getElementById('overview');
  const elHint     = document.getElementById('kbd-hint');

  // ── Syntax highlighting ──────────────────────────────────────────────
  hljs.highlightAll();

  // ── Slide navigation ─────────────────────────────────────────────────
  function showSlide(next, direction) {
    const prev = cur;
    if (next < 0 || next >= total || next === prev) return;

    const slideOut = slides[prev];
    const slideIn  = slides[next];

    // Set up entering slide position
    const enterClass = direction === 'forward' ? 'enter-from-right' : 'enter-from-left';
    const exitClass  = direction === 'forward' ? 'exit-left'        : 'exit-right';

    slideIn.classList.add(enterClass);
    slideIn.style.transition = 'none';

    // Force reflow so the initial position is painted
    void slideIn.offsetWidth;

    slideIn.style.transition = '';
    slideIn.classList.remove(enterClass);
    slideIn.classList.add('is-active');

    slideOut.classList.remove('is-active');
    slideOut.classList.add(exitClass);

    // Clean up exit class after transition
    slideOut.addEventListener('transitionend', function cleanup() {
      slideOut.classList.remove(exitClass, 'exit-left', 'exit-right');
      slideOut.removeEventListener('transitionend', cleanup);
    });

    cur = next;
    updateHud();
  }

  function updateHud() {
    elCur.textContent = String(cur + 1);
    const pct = total > 1 ? (cur / (total - 1)) * 100 : 100;
    elFill.style.width = pct + '%';
    elBtnPrev.style.opacity = cur === 0 ? '0.2' : '1';
    elBtnNext.style.opacity = cur === total - 1 ? '0.2' : '1';
  }

  function next() { showSlide(cur + 1, 'forward');  }
  function prev() { showSlide(cur - 1, 'backward'); }

  // ── Overview mode ────────────────────────────────────────────────────
  function buildOverview() {
    elOverview.innerHTML = '';
    slides.forEach((slide, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'overview-thumb' + (i === cur ? ' is-current' : '');

      const num = document.createElement('span');
      num.className = 'overview-thumb__number';
      num.textContent = String(i + 1);

      // Clone slide content into thumbnail
      const inner = document.createElement('div');
      inner.className = 'overview-thumb__inner';
      inner.style.width  = window.innerWidth  + 'px';
      inner.style.height = window.innerHeight + 'px';
      const clone = slide.cloneNode(true);
      clone.classList.add('is-active');
      clone.style.transition = 'none';
      inner.appendChild(clone);

      thumb.appendChild(num);
      thumb.appendChild(inner);

      thumb.addEventListener('click', () => {
        const direction = i >= cur ? 'forward' : 'backward';
        toggleOverview(false);
        showSlide(i, direction);
      });

      elOverview.appendChild(thumb);
    });
  }

  function toggleOverview(force) {
    inOverview = force !== undefined ? force : !inOverview;
    if (inOverview) {
      buildOverview();
      elOverview.classList.remove('hidden');
    } else {
      elOverview.classList.add('hidden');
    }
  }

  // ── Keyboard ─────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (inOverview) {
      if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') toggleOverview(false);
      return;
    }
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
        e.preventDefault();
        next();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'Backspace':
        e.preventDefault();
        prev();
        break;
      case 'Home':
        e.preventDefault();
        showSlide(0, 'backward');
        break;
      case 'End':
        e.preventDefault();
        showSlide(total - 1, 'forward');
        break;
      case 'f':
      case 'F':
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        break;
      case 'o':
      case 'O':
      case 'Escape':
        toggleOverview();
        break;
    }
  });

  // ── Mouse/touch ───────────────────────────────────────────────────────
  elBtnPrev.addEventListener('click', prev);
  elBtnNext.addEventListener('click', next);

  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
  }, { passive: true });

  // ── Hint auto-hide ────────────────────────────────────────────────────
  setTimeout(() => { elHint.classList.add('hidden'); }, 4000);

  // ── Init ─────────────────────────────────────────────────────────────
  slides[0].classList.add('is-active');
  updateHud();
})();
</script>
</body>
</html>`;
}
