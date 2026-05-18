/**
 * Required Supabase table (run once in SQL editor):
 *
 *   CREATE TABLE color_cache (
 *     hex        TEXT PRIMARY KEY,   -- lowercase, no "#", e.g. "d4af37"
 *     name       TEXT,
 *     rgb_r      SMALLINT,
 *     rgb_g      SMALLINT,
 *     rgb_b      SMALLINT,
 *     hsl_h      SMALLINT,
 *     hsl_s      SMALLINT,
 *     hsl_l      SMALLINT,
 *     swatch_url TEXT NOT NULL,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *
 * Storage: "images" bucket, folder "swatches/"
 * (no extra bucket needed, just the existing one)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ColorInfo } from "./prompt";

type CacheRow = {
  hex: string;
  name: string | null;
  rgb_r: number | null;
  rgb_g: number | null;
  rgb_b: number | null;
  hsl_h: number | null;
  hsl_s: number | null;
  hsl_l: number | null;
  swatch_url: string;
};

function rowToInfo(row: CacheRow): ColorInfo {
  return {
    hex: `#${row.hex}`,
    name: row.name ?? undefined,
    rgb:
      row.rgb_r != null
        ? { r: row.rgb_r, g: row.rgb_g!, b: row.rgb_b! }
        : undefined,
    hsl:
      row.hsl_h != null
        ? { h: row.hsl_h, s: row.hsl_s!, l: row.hsl_l! }
        : undefined,
    swatchUrl: row.swatch_url,
  };
}

async function fetchApiColorInfo(clean: string): Promise<{
  name: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
} | null> {
  try {
    const res = await fetch(`https://api.color.pizza/v1/?values=${clean}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      colors?: Array<{
        name: string;
        rgb: { r: number; g: number; b: number };
        hsl: { h: number; s: number; l: number };
      }>;
    };
    const c = data.colors?.[0];
    if (!c) return null;
    return {
      name: c.name,
      rgb: c.rgb,
      hsl: {
        h: Math.round(c.hsl.h),
        s: Math.round(c.hsl.s),
        l: Math.round(c.hsl.l),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Ensures a swatch for `clean` (lowercase hex, no #) exists in our bucket.
 * - If already uploaded: returns the bucket public URL immediately.
 * - If missing: downloads from singlecolorimage.com, uploads to bucket, returns bucket URL.
 * Throws if the upload fails so that external URLs are never cached in the DB.
 */
async function uploadSwatch(
  clean: string,
  supabase: SupabaseClient,
): Promise<string> {
  const storagePath = `swatches/${clean}.png`;
  const { data: publicUrlData } = supabase.storage
    .from("images")
    .getPublicUrl(storagePath);
  const bucketUrl = publicUrlData.publicUrl;

  // Check if the file already exists in the bucket
  const { data: listed } = await supabase.storage
    .from("images")
    .list("swatches", { search: `${clean}.png`, limit: 1 });

  if (listed?.some((f) => f.name === `${clean}.png`)) {
    return bucketUrl;
  }

  // Not in bucket — download from singlecolorimage.com
  const res = await fetch(
    `https://singlecolorimage.com/get/${clean}/32x32`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`Swatch fetch failed for #${clean}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const { error } = await supabase.storage
    .from("images")
    .upload(storagePath, buffer, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`Swatch upload failed for #${clean}: ${error.message}`);

  return bucketUrl;
}

/**
 * Resolves color info for a hex value.
 * Order: DB cache → (color.pizza API + ensure swatch in bucket).
 * The returned swatchUrl is always a Supabase Storage URL.
 * Persists to DB on first fetch so subsequent calls are instant.
 */
export async function resolveColorInfo(
  hex: string,
  supabase: SupabaseClient,
): Promise<ColorInfo> {
  const clean = hex.replace("#", "").toLowerCase();

  // 1. DB cache hit — fastest path
  const { data: cached } = await supabase
    .from("color_cache")
    .select("*")
    .eq("hex", clean)
    .maybeSingle();

  if (cached) return rowToInfo(cached as CacheRow);

  // 2. Fetch colour metadata and upload swatch in parallel
  const [apiInfo, swatchUrl] = await Promise.all([
    fetchApiColorInfo(clean),
    uploadSwatch(clean, supabase),
  ]);

  // 3. Persist (best-effort, upsert handles races)
  await supabase.from("color_cache").upsert(
    {
      hex: clean,
      name: apiInfo?.name ?? null,
      rgb_r: apiInfo?.rgb?.r ?? null,
      rgb_g: apiInfo?.rgb?.g ?? null,
      rgb_b: apiInfo?.rgb?.b ?? null,
      hsl_h: apiInfo?.hsl?.h ?? null,
      hsl_s: apiInfo?.hsl?.s ?? null,
      hsl_l: apiInfo?.hsl?.l ?? null,
      swatch_url: swatchUrl,
    },
    { onConflict: "hex" },
  );

  return {
    hex: `#${clean}`,
    name: apiInfo?.name,
    rgb: apiInfo?.rgb,
    hsl: apiInfo?.hsl,
    swatchUrl,
  };
}
