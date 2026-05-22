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
  const rawType = typeof attr.type === "string" ? attr.type.trim().toLowerCase() : "";
  if (!rawType) return "hex";
  return rawType === "text" ? "text" : "hex";
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

    if (typeof item.type !== "string" || !item.type.trim()) {
      throw new Error(`attributes[${index}].type is required`);
    }
    const normalizedType = item.type.trim().toLowerCase() === "text" ? "text" : "hex";
    const type = inferAttributeType({ to, type: normalizedType });

    return {
      target,
      material,
      to,
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

  const normalizedHex = normalizeHexColor(value);
  if (!normalizedHex) return value.trim();

  // Keep exactly one representation: image reference if available, else hex text.
  if (swatchIdx != null) return `the color in image ${swatchIdx} as the exact colour reference`;
  return normalizedHex;
}

/**
 * Collects all unique valid hex colors from attributes.
 * Returns canonical lowercase #rrggbb values in first-seen order.
 * Swatch image URLs are resolved later (from storage) via `resolveColorInfo`.
 */
export function collectColorSwatches(attributes: Attribute[]): {
  hexes: string[];
} {
  const ordered: string[] = [];

  for (const attr of attributes) {
    if (inferAttributeType(attr) !== "hex") {
      continue;
    }

    const hex = normalizeHexColor(attr.to);
    if (hex) {
      ordered.push(hex);
    }
  }

  return { hexes: ordered };
}

export function buildPrompt(
  attributes: Attribute[],
  extraPrompt?: string,
  /**
   * Per-attribute swatch index in the image_urls array sent to the model.
   * Value is undefined for text attributes.
   */
  swatchIndexByAttribute?: Array<number | undefined>,
): string {
  const lines = attributes.map((attr, index) => {
    const type = inferAttributeType(attr);
    const display = attr.target.trim();
    const toIdx = type === "hex" ? swatchIndexByAttribute?.[index] : undefined;
    const toDesc = describeColorValue(attr.to, type, toIdx);

    return `${index + 1}. Change ${display} to ${toDesc} (${attr.material.trim()}).`;
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