import { marked } from "marked";

export interface PositionedImage {
  src: string;
  alt: string;
  opacity: number;
}

export interface Slide {
  html: string;
  bgImage?: PositionedImage;
  rightImage?: PositionedImage;
  leftImage?: PositionedImage;
  notes?: string;
}

type ImagePosition = "inline" | "right" | "left" | "bg";

function parseImageDirective(title: string | undefined | null): {
  position: ImagePosition;
  opacity: number;
} {
  if (!title) return { position: "inline", opacity: 1 };

  const t = title.trim().toLowerCase();
  let position: ImagePosition = "inline";

  if (t.includes("right")) position = "right";
  else if (t.includes("left")) position = "left";
  else if (t.includes("bg")) position = "bg";

  const opacityMatch = t.match(/opacity[=:]?\s*([0-9]*\.?[0-9]+)/);
  const opacity = opacityMatch
    ? Math.min(1, Math.max(0, parseFloat(opacityMatch[1])))
    : 1;

  return { position, opacity };
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

      // Find positioned images via title attribute: ![alt](src "right opacity:0.7")
      const imgRegex =
        /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g;
      const toRemove: string[] = [];
      let match: RegExpExecArray | null;

      // Reset lastIndex before use since we're reusing the regex
      imgRegex.lastIndex = 0;

      while ((match = imgRegex.exec(raw)) !== null) {
        const [full, alt, src, titleAttr] = match;
        const { position, opacity } = parseImageDirective(titleAttr);

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

      for (const item of toRemove) {
        // Replace only first occurrence (the matched image)
        processedMd = processedMd.replace(item, "");
      }

      // Render remaining markdown to HTML
      slide.html = marked.parse(processedMd.trim()) as string;

      return slide;
    });
}
