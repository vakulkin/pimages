import { createServiceClient } from "@/lib/supabase/service";
// import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// CORS
// Set GENERATE_ALLOWED_ORIGIN in .env.local to restrict to your WC domain.
// Defaults to "*" so local WordPress dev works out of the box.
// ---------------------------------------------------------------------------
const ALLOWED_ORIGIN = process.env.GENERATE_ALLOWED_ORIGIN ?? "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

import { RequestBody, Attribute, Generation } from "@/lib/types";
import { generateConfigHash } from "@/lib/utils";
import { createGeminiImageTask } from "@/lib/piapi/gemini";
import { buildPrompt, collectColorSwatches } from "@/lib/prompt";
import { resolveColorInfo } from "@/lib/color-cache";

type SupabaseServerClient = ReturnType<typeof createServiceClient>;

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function parseJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError("Invalid JSON", 400);
  }
}

function validateAndNormalize(body: unknown): RequestBody {
  if (typeof body !== "object" || body === null) {
    throw new ApiError("Invalid request body", 400);
  }

  const b = body as Record<string, unknown>;
  let pid = b["product_id"] as number | string | undefined;

  if (typeof pid === "string" && /^\d+$/.test(pid)) pid = Number(pid);

  if (!Number.isInteger(pid as number) || (pid as number) <= 0) {
    throw new ApiError("product_id (integer) is required", 400);
  }

  const image = b["image"] as string | undefined;
  if (typeof image !== "string" || !image.startsWith("http")) {
    throw new ApiError("image (URL) is required", 400);
  }

  const attributesRaw = b["attributes"];
  if (!Array.isArray(attributesRaw) || attributesRaw.length === 0) {
    throw new ApiError("attributes must be a non-empty array", 400);
  }

  const extraPrompt =
    typeof b["extra_prompt"] === "string" ? (b["extra_prompt"] as string) : undefined;

  return {
    product_id: pid as number,
    image,
    attributes: attributesRaw as Attribute[],
    extra_prompt: extraPrompt,
  };
}

async function findExistingGeneration(
  supabase: SupabaseServerClient,
  configHash: string,
): Promise<Generation | null> {
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("config_hash", configHash)
    .maybeSingle();

  if (error) throw new ApiError("DB error (check existing)", 500);
  return (data as Generation) ?? null;
}

function handleExistingResponse(existing: Generation | null) {
  if (!existing) return null;

  return NextResponse.json(
    {
      id: existing.id,
      status: existing.status,
      product_id: existing.product_id,
      hash: existing.config_hash,
      ...(existing.image_url ? { image_url: existing.image_url } : {}),
    },
    { headers: corsHeaders() },
  );
}

async function createOrResetGeneration(
  supabase: SupabaseServerClient,
  existing: Generation | null,
  opts: {
    product_id: number;
    image: string;
    attributes: Attribute[];
    configHash: string;
  },
): Promise<string> {
  const { product_id, image, attributes } = opts;

  if (existing) {
    const { data, error } = await supabase
      .from("generations")
      .update({
        source_image_url: image,
        attributes,
        status: "queued",
        retry_count: (existing.retry_count ?? 0) + 1,
        provider_job_id: null,
        provider_status: null,
        image_url: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !data) throw new ApiError("Failed to reset generation", 500);
    return data.id as string;
  }

  const { data, error } = await supabase
    .from("generations")
    .insert({
      product_id,
      config_hash: opts.configHash,
      source_image_url: image,
      attributes,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) throw new ApiError("Failed to create generation", 500);
  return data.id as string;
}

async function submitToProvider(
  prompt: string,
  image_urls: string[],
): Promise<{ taskId: string }> {
  const { taskId } = await createGeminiImageTask({
    prompt,
    image_urls,
    aspect_ratio: "1:1",
    output_format: "png",
  });
  return { taskId };
}

async function updateGenerationWithTask(
  supabase: SupabaseServerClient,
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

  if (error) throw new ApiError("Failed to update generation", 500);
}

async function markGenerationFailed(
  supabase: SupabaseServerClient,
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

export async function POST(req: NextRequest) {
  // Auth check — only authenticated users may submit generations
  // const authClient = await createClient();
  // const { data: { user } } = await authClient.auth.getUser();
  // if (!user) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  let supabase: SupabaseServerClient | undefined;
  let generationId: string | undefined;
  let existing: Generation | null = null;

  try {
    const raw = await parseJsonBody(req);
    const body = validateAndNormalize(raw);
    const { product_id, image, attributes } = body;

    supabase = createServiceClient();

    const configHash = generateConfigHash(product_id, image, attributes);

    existing = await findExistingGeneration(supabase, configHash);

    const existingResp = handleExistingResponse(existing);
    if (existingResp) return existingResp;

    generationId = await createOrResetGeneration(supabase, existing, {
      product_id,
      image,
      attributes,
      configHash,
    });

    const { hexes } = collectColorSwatches(attributes);

    // Resolve color info for each unique hex (DB cache → upload → API) in parallel
    const colorInfoEntries = await Promise.all(
      hexes.map(async (hex) => [hex, await resolveColorInfo(hex, supabase!)] as const),
    );
    const colorInfoMap = new Map(colorInfoEntries);

    // Use stored swatch URLs (Supabase storage) rather than singlecolorimage.com
    const swatchUrls = hexes.map((hex) => colorInfoMap.get(hex)!.swatchUrl);

    // image_urls[0] = product image (image 1), swatches follow from index 1 (image 2+)
    const swatchIndexMap = new Map(
      hexes.map((hex, i) => [hex.replace("#", "").toLowerCase(), i + 2]),
    );

    const prompt = buildPrompt(attributes, colorInfoMap, body.extra_prompt, swatchIndexMap);

    const { taskId } = await submitToProvider(prompt, [image, ...swatchUrls]);

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
      throw new ApiError("Failed to enqueue generation job", 500);
    }

    // pgmq send returns setof bigint — unwrap the array, then persist in one update
    const resolvedMsgId = Array.isArray(msgId) ? msgId[0] : msgId;
    await updateGenerationWithTask(supabase, generationId, taskId, resolvedMsgId ?? null);

    return NextResponse.json(
      { id: generationId, status: "processing", product_id: product_id, hash: configHash },
      { headers: corsHeaders() },
    );
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: corsHeaders() });
    }

    console.error("Unhandled error in /api/generate:", err);

    if (supabase && generationId) {
      await markGenerationFailed(supabase, generationId);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
