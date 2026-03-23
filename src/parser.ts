import { marked } from "marked";

export interface PositionedImage {
  src: string;
  alt: string;
  opacity: number;
}

export interface PositionedVideo {
  src: string;
  alt: string;
  opacity: number;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  controls: boolean;
}

export interface Slide {
  html: string;
  bgImage?: PositionedImage;
  rightImage?: PositionedImage;
  leftImage?: PositionedImage;
  bgVideo?: PositionedVideo;
  rightVideo?: PositionedVideo;
  leftVideo?: PositionedVideo;
  notes?: string;
}

type MediaPosition = "inline" | "right" | "left" | "bg";

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".ogg", ".ogv"]);

function isVideo(src: string): boolean {
  const dot = src.lastIndexOf(".");
  if (dot === -1) return false;
  return VIDEO_EXTS.has(src.slice(dot).toLowerCase().split("?")[0]);
}

function parseMediaDirective(title: string | undefined | null): {
  position: MediaPosition;
  opacity: number;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  controls: boolean;
} {
  if (!title) return { position: "inline", opacity: 1, autoplay: false, loop: false, muted: false, controls: false };

  const t = title.trim().toLowerCase();
  let position: MediaPosition = "inline";

  if (t.includes("right")) position = "right";
  else if (t.includes("left")) position = "left";
  else if (t.includes("bg")) position = "bg";

  const opacityMatch = t.match(/opacity[=:]?\s*([0-9]*\.?[0-9]+)/);
  const opacity = opacityMatch
    ? Math.min(1, Math.max(0, parseFloat(opacityMatch[1])))
    : 1;

  return {
    position,
    opacity,
    autoplay: t.includes("autoplay"),
    loop: t.includes("loop"),
    muted: t.includes("muted"),
    controls: t.includes("controls"),
  };
}

export function parseSlides(markdown: string): Slide[] {
  // Normalize line endings
  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split on slide separator: "---" on its own line (with optional surrounding blank lines)
  const rawSlides = normalized.split(/\n[ \t]*---[ \t]*\n/);

  return rawSlides
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const slide: Slide = { html: "" };

      // Extract speaker notes (<!-- notes: ... --> at end)
      const notesMatch = raw.match(/<!--\s*notes?:\s*([\s\S]*?)\s*-->/i);
      if (notesMatch) {
        slide.notes = notesMatch[1].trim();
      }
      let processedMd = raw.replace(/<!--\s*notes?:\s*[\s\S]*?\s*-->/gi, "");

      // Find positioned media via title attribute: ![alt](src "right opacity:0.7")
      const imgRegex =
        /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g;
      const toRemove: string[] = [];
      const toReplace: { from: string; to: string }[] = [];
      let match: RegExpExecArray | null;

      // Reset lastIndex before use since we're reusing the regex
      imgRegex.lastIndex = 0;

      while ((match = imgRegex.exec(raw)) !== null) {
        const [full, alt, src, titleAttr] = match;
        const { position, opacity, autoplay, loop, muted, controls } = parseMediaDirective(titleAttr);

        if (isVideo(src)) {
          // Determine video attributes — positioned videos default to autoplay loop muted
          const isPositioned = position !== "inline";
          const vid: PositionedVideo = {
            src, alt, opacity,
            autoplay: isPositioned ? (titleAttr ? autoplay : true) : autoplay,
            loop: isPositioned ? (titleAttr ? loop : true) : loop,
            muted: isPositioned ? (titleAttr ? muted : true) : muted,
            controls: isPositioned ? controls : (titleAttr ? controls : true),
          };

          // Apply defaults for positioned videos when directives are present but no video attrs specified
          if (isPositioned && titleAttr && !autoplay && !loop && !muted && !controls) {
            vid.autoplay = true;
            vid.loop = true;
            vid.muted = true;
          }

          if (position === "bg") {
            slide.bgVideo = vid;
            toRemove.push(full);
          } else if (position === "right") {
            slide.rightVideo = vid;
            toRemove.push(full);
          } else if (position === "left") {
            slide.leftVideo = vid;
            toRemove.push(full);
          } else {
            // Inline video: replace markdown image syntax with <video> tag
            const attrs = [
              vid.autoplay ? "autoplay" : "",
              vid.loop ? "loop" : "",
              vid.muted ? "muted" : "",
              vid.controls ? "controls" : "",
            ].filter(Boolean).join(" ");
            const videoTag = `<video src="${src}"${attrs ? " " + attrs : ""} style="opacity:${opacity}">Your browser does not support video.</video>`;
            toReplace.push({ from: full, to: videoTag });
          }
        } else {
          if (position === "bg") {
            slide.bgImage = { src, alt, opacity };
            toRemove.push(full);
          } else if (position === "right") {
            slide.rightImage = { src, alt, opacity };
            toRemove.push(full);
          } else if (position === "left") {
            slide.leftImage = { src, alt, opacity };
            toRemove.push(full);
          }
        }
      }

      for (const item of toRemove) {
        // Replace only first occurrence (the matched media)
        processedMd = processedMd.replace(item, "");
      }

      for (const { from, to } of toReplace) {
        processedMd = processedMd.replace(from, to);
      }

      // Render remaining markdown to HTML
      slide.html = marked.parse(processedMd.trim()) as string;

      return slide;
    });
}
