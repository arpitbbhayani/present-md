# Video Support in present-md

New in this release — embed videos directly in your slides.

---

## Inline Video

Videos render inline with browser controls by default:

![](sample.mp4)

---

## Right-Positioned Video

Content on the left, video on the right — great for walkthroughs.

- Autoplays on slide entry
- Loops continuously
- Muted by default

![](sample.mp4 "right autoplay loop muted")

---

## Left-Positioned Video

![](sample.mp4 "left autoplay loop muted")

Same layout flipped — video on the left, content on the right.

Works identically to image positioning.

---

## Video with Controls

Use `controls` to let viewers scrub through:

![](sample.mp4 "right controls")

---

## Background Video

![](sample.mp4 "bg loop autoplay muted opacity:0.4")

# Cinematic slides

Background videos work just like background images — content sits on top.

---

## Supported Formats

| Format | Extension | Browser Support       |
| ------ | --------- | --------------------- |
| MP4    | `.mp4`    | All browsers          |
| WebM   | `.webm`   | All modern browsers   |
| Ogg    | `.ogg` `.ogv` | Firefox, Chrome   |
| MOV    | `.mov`    | Safari, some Chrome   |

---

## Syntax Reference

```markdown
![](demo.mp4)                              # inline, controls
![](demo.mp4 "right autoplay loop muted")  # right panel
![](demo.mp4 "left controls")              # left panel
![](demo.mp4 "bg loop autoplay muted")     # background
![](demo.mp4 "right opacity:0.6")          # with opacity
```

---

# Try it

Drop a `.mp4` next to your slides and go.
