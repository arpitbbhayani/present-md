# present

### Browser-based presentations for developers

Built with markdown. Runs in your browser. No fluff.

---

## Why `present`?

- Write slides in **plain markdown**
- Code blocks with **syntax highlighting**
- Dark mode, always
- IBM Plex Mono — beautiful monospace typography
- Keyboard navigation: `← →` `Space` `O` `F`

---

## Image Layout System

Place images anywhere with a title directive:

```markdown
![alt](image.png "right")
![alt](image.png "left opacity:0.8")
![alt](image.png "bg opacity:0.3")
```

| Directive      | Effect                        |
|----------------|-------------------------------|
| `right`        | Image on right half           |
| `left`         | Image on left half            |
| `bg`           | Fullscreen background         |
| `opacity:N`    | Transparency (0.0 – 1.0)     |

---

## Code Example

```typescript
interface Slide {
  html: string;
  bgImage?:    PositionedImage;
  rightImage?: PositionedImage;
  leftImage?:  PositionedImage;
}

function parseSlides(markdown: string): Slide[] {
  return markdown
    .split(/\n---\n/)
    .filter(Boolean)
    .map(raw => processSlide(raw));
}
```

---

## Blockquotes & Inline Code

> "Any fool can write code that a computer can understand.
> Good programmers write code that humans can understand."
> — *Martin Fowler*

Use `present file.md` to launch. Pass `--port 3000` to pick your port.

Inline code looks like `const x = 42` or `npm install -g present`.

---

## Tables & Lists

### Keyboard Shortcuts

| Key           | Action                |
|---------------|-----------------------|
| `→` / `Space` | Next slide            |
| `←`           | Previous slide        |
| `O`           | Overview mode         |
| `F`           | Toggle fullscreen     |
| `Home` / `End`| First / last slide    |

---

## A Right-Side Image

This slide has content on the left and an image panel on the right.

- The image scales to fit
- Opacity is controllable
- Works great for diagrams, screenshots, charts

![Logo](https://via.placeholder.com/600x400/1e1e2e/cba6f7?text=Right+Image "right opacity:0.9")

---

## Background Image

Great for title slides or section dividers.

The text sits on top with full readability.

![Background](https://via.placeholder.com/1920x1080/11111b/313244?text=Background+Image "bg opacity:0.4")

---

# Thank you

```bash
npx present slides.md
```

Made with ❤️ and too much coffee
