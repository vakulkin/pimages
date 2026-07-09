import { createServiceClient } from "@/lib/supabase/service";
import { Attribute, Generation } from "@/lib/types";
import { generateConfigHash } from "@/lib/utils";
// import { createSeedreamImageTask } from "@/lib/piapi/seedream";
import {
  buildPrompt,
  collectColorSwatches,
  normalizeHexColor,
} from "@/lib/prompt";
import { resolveColorInfo } from "@/lib/color-cache";
import { createGeminiImageTask } from "./piapi/gemini";

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

export type GenerateTaskInput = {
  product_id: number;
  image: string;
  attributes: Attribute[];
  extra_prompt?: string;
};

export type GenerateTaskResult = {
  id: string;
  status: string;
  product_id: number;
  hash: string;
  image_url?: string;
  /** Returned when an existing matching generation was found (no new task created). */
  existing?: true;
};

async function findExistingGeneration(
  supabase: SupabaseServiceClient,
  configHash: string,
): Promise<Generation | null> {
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("config_hash", configHash)
    .maybeSingle();

  if (error) throw new Error("DB error checking existing generation");
  return (data as Generation) ?? null;
}

async function createGeneration(
  supabase: SupabaseServiceClient,
  opts: {
    product_id: number;
    image: string;
    attributes: Attribute[];
    configHash: string;
  },
): Promise<string> {
  const { product_id, image, attributes, configHash } = opts;
  const { data, error } = await supabase
    .from("generations")
    .insert({
      product_id,
      config_hash: configHash,
      source_image_url: image,
      attributes,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Failed to create generation: " + (error?.message ?? "no data"));
  return data.id as string;
}

async function updateGenerationWithTask(
  supabase: SupabaseServiceClient,
  generationId: string,
  taskId: string,
  queueMsgId?: number | null,
) {
  const { error } = await supabase
    .from("generations")
    .update({
      provider_job_id: taskId,
      provider_status: "processing",
      status: "processing",
      ...(queueMsgId != null ? { queue_msg_id: queueMsgId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", generationId);

  if (error) throw new Error("Failed to update generation with task: " + error.message);
}

async function markGenerationFailed(
  supabase: SupabaseServiceClient,
  generationId: string,
) {
  try {
    await supabase
      .from("generations")
      .update({
        status: "failed",
        error_message: "PiAPI submission failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId);
  } catch (e) {
    console.error("Failed to mark generation failed:", e);
  }
}

/**
 * Core generation logic: creates a DB row, submits to the AI provider, and
 * enqueues a poll job. Returns the result without going through HTTP.
 *
 * If a generation with the same config_hash already exists, returns it
 * immediately (no new task is created).
 */
export async function createAndSubmitGeneration(
  input: GenerateTaskInput,
): Promise<GenerateTaskResult> {
  const { product_id, image, extra_prompt, attributes } = input;
  const supabase = createServiceClient();

  const configHash = generateConfigHash(product_id, image, attributes);

  const existing = await findExistingGeneration(supabase, configHash);
  if (existing) {
    return {
      id: existing.id,
      status: existing.status,
      product_id: existing.product_id,
      hash: existing.config_hash,
      ...(existing.image_url ? { image_url: existing.image_url } : {}),
      existing: true,
    };
  }

  const generationId = await createGeneration(supabase, {
    product_id,
    image,
    attributes,
    configHash,
  });

  const { hexes } = collectColorSwatches(attributes);

  const swatchEntries = await Promise.all(
    hexes.map(async (hex) => {
      const normalizedHex = (normalizeHexColor(hex) ?? hex).toLowerCase();
      const { swatchUrl } = await resolveColorInfo(normalizedHex, supabase);
      return [normalizedHex, swatchUrl] as const;
    }),
  );
  const swatchUrlMap = new Map(swatchEntries);

  const swatchUrls = hexes.map((hex) => {
    const key = (normalizeHexColor(hex) ?? hex).toLowerCase();
    return swatchUrlMap.get(key)!;
  });

  // Keep swatch indices aligned with attribute order (text attributes are undefined).
  let swatchCursor = 0;
  const swatchIndexByAttribute = attributes.map((attr) => {
    if (attr.type !== "hex") {
      return undefined;
    }
    swatchCursor += 1;
    return swatchCursor + 1; // +1 for product image at index 1 in prompt terms
  });

  const prompt = buildPrompt(attributes, extra_prompt, swatchIndexByAttribute);

  let taskId: string;
  try {
    ({ taskId } = await createGeminiImageTask({
    // ({ taskId } = await createSeedreamImageTask({
      prompt,
      image_urls: [image, ...swatchUrls],
      aspect_ratio: "1:1",
      output_format: "png",
    }));
  } catch (err) {
    await markGenerationFailed(supabase, generationId);
    throw err;
  }

  await updateGenerationWithTask(supabase, generationId, taskId);

  const { data: msgId, error: rpcError } = await supabase
    .schema("pgmq_public")
    .rpc("send", {
      message: { generationId },
      queue_name: "generation_poll",
      sleep_seconds: 10,
    });

  if (rpcError) {
    await markGenerationFailed(supabase, generationId);
    throw new Error("Failed to enqueue generation job: " + rpcError.message);
  }

  const resolvedMsgId = Array.isArray(msgId) ? msgId[0] : msgId;
  await updateGenerationWithTask(supabase, generationId, taskId, resolvedMsgId ?? null);

  return {
    id: generationId,
    status: "processing",
    product_id,
    hash: configHash,
  };
}
