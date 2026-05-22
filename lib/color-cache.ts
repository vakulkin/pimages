/**
 * Storage-only swatch resolver.
 * No color metadata is stored in DB.
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensures a swatch for `clean` (lowercase hex, no #) exists in our bucket.
 * - If already uploaded: returns the bucket public URL immediately.
 * - If missing: downloads from singlecolorimage.com, uploads to bucket, returns bucket URL.
 * Throws if the upload fails.
 */
export async function resolveColorInfo(
  clean: string,
  supabase: SupabaseClient,
): Promise<{ swatchUrl: string }> {
  clean = clean.replace(/^#/, "").toLowerCase();
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
    return { swatchUrl: bucketUrl };
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

  return { swatchUrl: bucketUrl };
}
