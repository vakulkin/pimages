import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { Generation } from "@/lib/types";

const ALLOWED_ORIGIN = process.env.GENERATE_ALLOWED_ORIGIN ?? "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const productIdParam = req.nextUrl.searchParams.get("product_id");
  const productId = productIdParam ? parseInt(productIdParam, 10) : NaN;

  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json(
      { error: "product_id (integer) is required" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("generations")
    .select("product_id, source_image_url, attributes, image_url, config_hash")
    .eq("product_id", productId)
    .eq("status", "accepted")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching accepted generations:", error);
    return NextResponse.json(
      { error: "Failed to fetch accepted generations" },
      { status: 500, headers: corsHeaders() },
    );
  }

  const results = (data as Pick<Generation, "product_id" | "source_image_url" | "attributes" | "image_url" | "config_hash">[]).map(
    (row) => ({
      product_id: row.product_id,
      image: row.source_image_url,
      attributes: row.attributes,
      hash: row.config_hash,
      image_url: row.image_url,
    }),
  );

  return NextResponse.json(results, { headers: corsHeaders() });
}
