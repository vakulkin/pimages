import { GeminiTaskInput, PiApiCreateTaskResponse } from "@/lib/types";

export async function createGeminiImageTask(
  input: GeminiTaskInput,
): Promise<{ taskId: string; raw: PiApiCreateTaskResponse }> {
  const apiKey = process.env.PIAPI_KEY;

  if (!apiKey) {
    throw new Error("PIAPI_KEY is not set");
  }

  const res = await fetch("https://api.piapi.ai/api/v1/task", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini",
      task_type: "nano-banana-2",
      // task_type: "gemini-2.5-flash-image",
      input: {
        prompt: input.prompt,
        image_urls: input.image_urls ?? [],
        aspect_ratio: input.aspect_ratio ?? "1:1",
        output_format: input.output_format ?? "png",
      },
      config: {
        service_mode: "public",
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`PiAPI error: ${errorText}`);
  }

  const data = (await res.json()) as PiApiCreateTaskResponse;
  const taskId = data?.data?.task_id ?? data?.task_id;

  if (!taskId) {
    throw new Error("PiAPI: task_id not returned");
  }

  return { taskId, raw: data };
}
