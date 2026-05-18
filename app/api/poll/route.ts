import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const PIAPI_KEY = process.env.PIAPI_KEY!;

async function getPiapiStatus(taskId: string) {
  const res = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
    headers: { "x-api-key": PIAPI_KEY },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PiAPI status error ${res.status}: ${text}`);
  }

  return await res.json();
}

async function downloadAndConvertToAvif(url: string): Promise<Buffer> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Image download failed: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  return sharp(buffer)
    .avif({ quality: 80, effort: 4 })
    .toBuffer();
}

type JobOutcome = "completed" | "failed" | "still_processing" | "skipped" | "error";

type JobResult = {
  msg_id: number;
  generationId: string | null;
  outcome: JobOutcome;
  reason?: string;
};

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  // CRON key check
  const expectedCronKey = process.env.CRON_KEY;
  if (expectedCronKey) {
    const cronKey = req.headers.get("x-cron-key");

    if (!cronKey || cronKey !== expectedCronKey) {
      console.warn("Unauthorized cron key attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("CRON_KEY env var not set; skipping cron key check");
  }

  const results: JobResult[] = [];

  try {
    // 1. READ JOBS
    const { data: jobs, error: readError } = await supabase
      .schema("pgmq_public")
      .rpc("read", {
        queue_name: "generation_poll",
        sleep_seconds: 60,
        n: 5,
      });

    if (readError) {
      console.error("QUEUE READ ERROR:", readError);
      return NextResponse.json({ error: readError }, { status: 500 });
    }

    const jobCount = jobs?.length ?? 0;
    console.log(`Read ${jobCount} jobs from queue`);

    if (!jobCount) {
      return NextResponse.json({ jobs_read: 0, results: [] });
    }

    for (const job of jobs) {
      const result: JobResult = {
        msg_id: job.msg_id,
        generationId: null,
        outcome: "skipped",
      };
      results.push(result);

      try {
        const { generationId } = job.message ?? {};

        if (!generationId) {
          result.reason = "Missing generationId in message";
          console.error(`Job ${job.msg_id}: missing generationId — archiving`);

          await supabase.schema("pgmq_public").rpc("archive", {
            queue_name: "generation_poll",
            message_id: Number(job.msg_id),
          });

          continue;
        }

        result.generationId = generationId;

        // 2. LOAD GENERATION
        const { data: generation, error: generationError } = await supabase
          .from("generations")
          .select("*")
          .eq("id", generationId)
          .single();

        if (generationError || !generation) {
          result.outcome = "error";
          result.reason = `Generation not found: ${generationError?.message}`;
          console.error(`Job ${job.msg_id}: generation not found`, generationError);
          continue;
        }

        if (!generation.provider_job_id) {
          result.outcome = "error";
          result.reason = "Missing provider_job_id on generation";
          console.error(`Job ${job.msg_id}: missing provider_job_id`);
          continue;
        }

        // 3. CHECK PIAPI STATUS
        const statusResp = await getPiapiStatus(generation.provider_job_id);
        const state: string | undefined = statusResp?.data?.status;
        const providerError: string | undefined =
          statusResp?.data?.error?.message ?? statusResp?.error?.message;

        console.log(`Job ${job.msg_id} (gen ${generationId}): PIAPI state = ${state}`);

        // 4. STILL PROCESSING — pending / starting / processing / retry
        if (state !== "completed" && state !== "failed") {
          result.outcome = "still_processing";
          result.reason = `PIAPI state: ${state ?? "unknown"}`;
          if (generation.provider_status !== state) {
            await supabase
              .from("generations")
              .update({ provider_status: state ?? null, updated_at: new Date().toISOString() })
              .eq("id", generationId);
          }
          continue;
        }

        // 5. FAILED
        if (state === "failed") {
          const { error: updateErr } = await supabase
            .from("generations")
            .update({
              status: "failed",
              provider_status: state,
              error_message: providerError || "Provider reported failure",
              updated_at: new Date().toISOString(),
            })
            .eq("id", generationId);

          if (updateErr) {
            result.outcome = "error";
            result.reason = `DB update to failed: ${updateErr.message}`;
            console.error(`Job ${job.msg_id}: DB update to failed failed:`, updateErr);
            continue;
          }

          const { error: archiveErr } = await supabase
            .schema("pgmq_public")
            .rpc("archive", {
              queue_name: "generation_poll",
              message_id: Number(job.msg_id),
            });

          if (archiveErr) {
            console.error(`Job ${job.msg_id}: archive after fail:`, archiveErr);
          }

          result.outcome = "failed";
          result.reason = providerError ?? "Provider reported failure";
          continue;
        }

        // 6. GET IMAGE URL (state === "completed")
        const imageUrl = statusResp?.data?.output?.image_urls?.[0];

        if (!imageUrl) {
          result.outcome = "error";
          result.reason = "PIAPI completed but no image_url in output";
          console.error(
            `Job ${job.msg_id}: no image_url. Output:`,
            JSON.stringify(statusResp?.data?.output),
          );
          continue;
        }

        // 7. DOWNLOAD & CONVERT TO AVIF
        const avifBuffer = await downloadAndConvertToAvif(imageUrl);

        // 8. SAVE TO STORAGE
        const filePath = `${generation.product_id}/${generationId}.avif`;

        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(filePath, avifBuffer, {
            contentType: "image/avif",
            upsert: true,
          });

        if (uploadError) {
          result.outcome = "error";
          result.reason = `Storage upload failed: ${uploadError.message}`;
          console.error(`Job ${job.msg_id}: upload failed:`, uploadError);
          continue;
        }

        // 9. GET PUBLIC URL
        const { data: publicUrlData } = supabase.storage
          .from("images")
          .getPublicUrl(filePath);

        const imageUrlWithVersion = `${publicUrlData.publicUrl}?v=${Date.now()}`;

        // 10. UPDATE DB
        const { error: updateError } = await supabase
          .from("generations")
          .update({
            status: "completed",
            provider_status: state,
            image_url: imageUrlWithVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", generationId);

        if (updateError) {
          result.outcome = "error";
          result.reason = `DB update to completed: ${updateError.message}`;
          console.error(`Job ${job.msg_id}: DB update to completed failed:`, updateError);
          continue;
        }

        // 11. ARCHIVE JOB
        const { error: archiveError, data: archiveData } = await supabase
          .schema("pgmq_public")
          .rpc("archive", {
            queue_name: "generation_poll",
            message_id: Number(job.msg_id),
          });

        if (archiveError) {
          console.error(`Job ${job.msg_id}: archive after complete:`, archiveError);
        } else if (!archiveData) {
          console.error(
            `Job ${job.msg_id}: archive returned falsy — message may not exist or already archived:`,
            archiveData,
          );
        }

        result.outcome = "completed";
        result.reason = imageUrlWithVersion;
        console.log(`Job ${job.msg_id}: generation ${generationId} completed`);
      } catch (jobError) {
        result.outcome = "error";
        result.reason = jobError instanceof Error ? jobError.message : String(jobError);
        console.error(`Job ${job.msg_id}: unexpected error:`, jobError);
      }
    }

    const summary = {
      jobs_read: jobs.length,
      completed: results.filter((r) => r.outcome === "completed").length,
      failed: results.filter((r) => r.outcome === "failed").length,
      still_processing: results.filter((r) => r.outcome === "still_processing").length,
      errors: results.filter((r) => r.outcome === "error").length,
      skipped: results.filter((r) => r.outcome === "skipped").length,
      results,
    };

    console.log("Run summary:", JSON.stringify(summary, null, 2));

    return NextResponse.json(summary);
  } catch (error) {
    console.error("FATAL ERROR:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        partial_results: results,
      },
      { status: 500 },
    );
  }
}
