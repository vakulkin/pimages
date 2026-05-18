"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
}

export async function acceptGeneration(id: string) {
  await requireAuth();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("generations")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/protected");
}

export async function rejectGeneration(id: string) {
  await requireAuth();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("generations")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/protected");
}

export async function deleteGenerationStorage(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { data: gen } = await supabase
    .from("generations")
    .select("product_id")
    .eq("id", id)
    .single();

  if (gen?.product_id == null) {
    return { ok: false, error: "No product_id found for this generation" };
  }

  const filePath = `${gen.product_id}/${id}.avif`;
  const { error: storageError } = await supabase.storage
    .from("images")
    .remove([filePath]);

  if (storageError) {
    console.error(
      `deleteGenerationStorage: remove failed for ${filePath}:`,
      storageError.message,
    );
    return { ok: false, error: storageError.message };
  }

  return { ok: true };
}

export async function removeGeneration(id: string) {
  await requireAuth();
  const supabase = createServiceClient();

  // 1. Fetch row
  const { data: gen } = await supabase
    .from("generations")
    .select("queue_msg_id, product_id")
    .eq("id", id)
    .single();

  // 2. Best-effort: archive queue message
  if (gen?.queue_msg_id != null) {
    try {
      await supabase.schema("pgmq_public").rpc("archive", {
        queue_name: "generation_poll",
        message_id: gen.queue_msg_id,
      });
    } catch {
      // best-effort
    }
  }

  // 3. Delete storage file
  await deleteGenerationStorage(id);

  // 4. Delete the DB row
  const { error } = await supabase.from("generations").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/protected");
}

export async function regenerateGeneration(id: string, extraPrompt?: string) {
  await requireAuth();
  const supabase = createServiceClient();

  try {
    // 1. Fetch data before deletion
    const { data: gen, error } = await supabase
      .from("generations")
      .select("product_id, source_image_url, attributes")
      .eq("id", id)
      .single();

    if (error || !gen) throw new Error("Generation not found");

    // 2. Remove old row — archives queue msg, deletes storage, deletes DB row
    await removeGeneration(id);

    // 3. Resubmit via the generate API (handles prompt, swatches, enqueue)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: gen.product_id,
        image: gen.source_image_url,
        attributes: gen.attributes,
        extra_prompt: extraPrompt,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Generate API error: ${text}`);
    }
  } finally {
    revalidatePath("/protected");
  }
}
