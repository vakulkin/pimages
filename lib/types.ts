export type Attribute = {
  slug: string;
  target: string;
  to: string;
  type?: "hex" | "text";
  material: string;
};

export type Generation = {
  id: string;
  product_id: number;
  config_hash: string;
  source_image_url: string;
  attributes: Attribute[];
  provider_job_id?: string;
  provider_status?: string;
  status:
  | "queued"
  | "processing"
  | "completed"
  | "accepted"
  | "rejected"
  | "failed";
  image_url?: string;
  retry_count: number;
  queue_msg_id?: number | null;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

export type RequestBody = {
  product_id: number;
  image: string;
  attributes: Attribute[];
  extra_prompt?: string;
};

export type GeminiTaskInput = {
  prompt: string;
  image_urls?: string[];
  aspect_ratio?: string;
  output_format?: "png" | "jpeg";
};

export type SeedreamTaskInput = {
  prompt: string;
  image_urls?: string[];
  aspect_ratio?:
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3"
  | "4:5"
  | "5:4";
  output_format?: "png" | "jpeg";
  size?: "2K" | "3K";
};

export type PiApiCreateTaskResponse = {
  data?: { task_id: string };
  task_id?: string;
};
