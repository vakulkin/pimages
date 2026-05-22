import { Attribute } from "./types";

export function normalizeColorToken(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeHexColor(value: string): string | null {
  const clean = normalizeColorToken(value).replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    const expanded = clean
      .split("")
      .map((ch) => ch + ch)
      .join("");
    return `#${expanded}`;
  }
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return `#${clean}`;
  }
  return null;
}

export function isHexColor(value: string): boolean {
  return normalizeHexColor(value) != null;
}

export function inferAttributeType(attr: Pick<Attribute, "to" | "type">): "hex" | "text" {
  if (attr.type === "hex" || attr.type === "text") {
    return attr.type;
  }
  return isHexColor(attr.to) ? "hex" : "text";
}

export function validateAndNormalizeAttributes(input: unknown): Attribute[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("attributes must be a non-empty array");
  }

  return input.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`attributes[${index}] must be an object`);
    }

    const item = raw as Record<string, unknown>;
    const target = typeof item.target === "string" ? item.target.trim() : "";
    const material = typeof item.material === "string" ? item.material.trim() : "";
    const to = typeof item.to === "string" ? item.to.trim() : "";

    if (!target) {
      throw new Error(`attributes[${index}].target is required`);
    }
    if (!material) {
      throw new Error(`attributes[${index}].material is required`);
    }
    if (!to) {
      throw new Error(`attributes[${index}].to is required`);
    }

    let from: string | undefined;
    if (item.from != null) {
      if (typeof item.from !== "string") {
        throw new Error(`attributes[${index}].from must be a string when provided`);
      }
      const trimmed = item.from.trim();
      if (trimmed) {
        from = trimmed;
      }
    }

    let type: "hex" | "text";
    if (item.type == null || item.type === "") {
      type = inferAttributeType({ to });
    } else {
      if (typeof item.type !== "string") {
        throw new Error(`attributes[${index}].type must be \"hex\" or \"text\"`);
      }
      const normalizedType = item.type.trim().toLowerCase();
      if (normalizedType !== "hex" && normalizedType !== "text") {
        throw new Error(`attributes[${index}].type must be \"hex\" or \"text\"`);
      }
      type = normalizedType;
    }

    if (type === "hex") {
      if (!normalizeHexColor(to)) {
        throw new Error(`attributes[${index}].to must be a valid hex color when type is \"hex\"`);
      }
      if (from && !normalizeHexColor(from)) {
        throw new Error(`attributes[${index}].from must be a valid hex color when type is \"hex\"`);
      }
    }

    return {
      target,
      material,
      to,
      ...(from ? { from } : {}),
      type,
    };
  });
}

function describeColorValue(
  value: string,
  type: "hex" | "text",
  swatchIdx?: number,
): string {
  if (type === "text") return value.trim();
  if (!isHexColor(value)) return value.trim();
  if (swatchIdx != null) return `the color in image ${swatchIdx}`;
  return "the provided color reference";
}

/**
 * Collects all unique valid hex colors from attributes.
 * Returns canonical lowercase #rrggbb values in first-seen order.
 * Swatch image URLs are resolved later (from storage) via `resolveColorInfo`.
 */
export function collectColorSwatches(attributes: Attribute[]): {
  hexes: string[];
} {
  const seen: string[] = [];
  const seenSet = new Set<string>();

  for (const attr of attributes) {
    if (inferAttributeType(attr) !== "hex") {
      continue;
    }

    for (const value of [attr.from, attr.to]) {
      if (!value) continue;
      const hex = normalizeHexColor(value);
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
  extraPrompt?: string,
  /**
   * Maps a canonical hex value (#rrggbb, lowercase) to the 1-based position of its swatch
   * in the image_urls array sent to the model.
   * e.g. { "#eeee22" => 2 } means the swatch is the second image.
   */
  swatchIndexMap?: Map<string, number>,
): string {
  const lines = attributes.map((attr, index) => {
    const type = inferAttributeType(attr);
    const display = attr.target.trim();
    const toHex = type === "hex" ? normalizeHexColor(attr.to) : null;
    const toIdx = toHex ? swatchIndexMap?.get(toHex) : undefined;
    const toDesc = describeColorValue(attr.to, type, toIdx);
    const toRef = toIdx != null ? ` (use image ${toIdx} as the exact colour reference)` : "";

    let color: string;
    if (attr.from) {
      const fromHex = type === "hex" ? normalizeHexColor(attr.from) : null;
      const fromIdx = fromHex ? swatchIndexMap?.get(fromHex) : undefined;
      const fromDesc = describeColorValue(attr.from, type, fromIdx);
      const fromRef = fromIdx != null ? ` (image ${fromIdx})` : "";
      const toRefGrad = toIdx != null ? ` (image ${toIdx})` : "";
      color = `a gradient from ${fromDesc}${fromRef} to ${toDesc}${toRefGrad}`;
    } else {
      color = `${toDesc}${toRef}`;
    }

    return `${index + 1}. Change ${display} to ${color} (${attr.material.trim()}).`;
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