import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";
import { Attribute } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function normalizeAttributes(attributes: Attribute[]) {
  return attributes
    .map((attr) => ({
      target: attr.target.trim().toLowerCase(),
      from: attr.from?.trim().toLowerCase() ?? null,
      to: attr.to.trim().toLowerCase(),
      material: attr.material.trim().toLowerCase(),
    }))
    .sort((a, b) => {
      return JSON.stringify(a).localeCompare(JSON.stringify(b));
    });
}

export function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function generateConfigHash(productId: number, image: string, attributes: Attribute[]) {
  const normalizedAttributes = normalizeAttributes(attributes);

  const payload = {
    product_id: productId,
    image,
    attributes: normalizedAttributes,
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}
