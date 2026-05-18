import { Attribute } from "./types";

export type ColorInfo = {
  hex: string;
  name?: string;
  rgb?: { r: number; g: number; b: number };
  hsl?: { h: number; s: number; l: number };
  swatchUrl: string;
};

function colorDesc(info: ColorInfo): string {
  const parts: string[] = [];
  if (info.name) parts.push(`"${info.name}"`);
  parts.push(`hex ${info.hex}`);
  if (info.rgb) parts.push(`RGB ${info.rgb.r} ${info.rgb.g} ${info.rgb.b}`);
  if (info.hsl) parts.push(`HSL ${info.hsl.h}° ${info.hsl.s}% ${info.hsl.l}%`);
  return "";
  // return parts.join(", ");
}

/**
 * Collects all unique hex colors from attributes.
 * Returns the unique hexes in the order they were encountered.
 * Swatch image URLs are resolved later (from storage) via `resolveColorInfo`.
 */
export function collectColorSwatches(attributes: Attribute[]): {
  hexes: string[];
} {
  const seen: string[] = [];
  const seenSet = new Set<string>();

  for (const attr of attributes) {
    for (const hex of [attr.from, attr.to]) {
      if (hex && !seenSet.has(hex)) {
        seenSet.add(hex);
        seen.push(hex);
      }
    }
  }

  return { hexes: seen };
}

export function buildPrompt(
  attributes: Attribute[],
  colorInfoMap: Map<string, ColorInfo>,
  extraPrompt?: string,
  /**
   * Maps a hex value (no #, lowercase) to the 1-based position of its swatch
   * in the image_urls array sent to the model.
   * e.g. { "eeee22" => 2 } means the swatch is the second image.
   */
  swatchIndexMap?: Map<string, number>,
): string {
  const lines = attributes.map((attr) => {
    const display = attr.target.trim();
    const toInfo = colorInfoMap.get(attr.to);
    const toDesc = toInfo ? colorDesc(toInfo) : attr.to;

    const toClean = attr.to.replace("#", "").toLowerCase();
    const toIdx = swatchIndexMap?.get(toClean);
    const toRef =
      toIdx != null
        ? ` (use image ${toIdx} as the exact colour reference)`
        : "";

    let color: string;
    if (attr.from) {
      const fromInfo = colorInfoMap.get(attr.from);
      const fromDesc = fromInfo ? colorDesc(fromInfo) : attr.from;
      const fromClean = attr.from.replace("#", "").toLowerCase();
      const fromIdx = swatchIndexMap?.get(fromClean);
      const fromRef = fromIdx != null ? ` (image ${fromIdx})` : "";
      const toRefGrad = toIdx != null ? ` (image ${toIdx})` : "";
      color = `a gradient from ${fromDesc}${fromRef} to ${toDesc}${toRefGrad}`;
    } else {
      color = `${toDesc}${toRef}`;
    }

    return `Change ${display} to ${color} (${attr.material}).`;
  });

  if (lines.length === 0) {
    throw new Error("No attributes provided to build prompt");
  }

  const parts = [
    "Strict color and material replacement.",
    "",
    "Edit only the listed elements.",
    "",
    ...lines,
    "",
    "Preserve all perforation holes, cut-outs, and openings exactly as in the original" +
      " — keep them open and show the original background through them.",
    "",
    "Preserve all shading, lighting, shadows, highlights, reflections, textures, and material realism.",
    "Preserve all shapes, proportions, composition, and image quality.",
  ];

  if (extraPrompt?.trim()) {
    parts.push("", "Additional instructions:", extraPrompt.trim());
  }

  return parts.join("\n");
}
