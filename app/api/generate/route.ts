import { NextRequest, NextResponse } from "next/server";
import { RequestBody, Attribute } from "@/lib/types";
import { createAndSubmitGeneration } from "@/lib/generate-task";
import { validateAndNormalizeAttributes } from "@/lib/prompt";

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
  let attributes: Attribute[];
  try {
    attributes = validateAndNormalizeAttributes(attributesRaw);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid attributes";
    throw new ApiError(message, 400);
  }

  const extraPrompt =
    typeof b["extra_prompt"] === "string"
      ? (b["extra_prompt"] as string)
      : undefined;

  return {
    product_id: pid as number,
    image,
    attributes,
    extra_prompt: extraPrompt,
  };
}

export async function POST(req: NextRequest) {
  try {
    const raw = await parseJsonBody(req);
    const body = validateAndNormalize(raw);

    const result = await createAndSubmitGeneration({
      product_id: body.product_id,
      image: body.image,
      attributes: body.attributes,
      extra_prompt: body.extra_prompt,
    });

    return NextResponse.json(
      {
        id: result.id,
        status: result.status,
        product_id: result.product_id,
        hash: result.hash,
        ...(result.image_url ? { image_url: result.image_url } : {}),
      },
      { headers: corsHeaders() },
    );
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: corsHeaders() },
      );
    }

    console.error("Unhandled error in /api/generate:", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders() },
    );
  }
}

