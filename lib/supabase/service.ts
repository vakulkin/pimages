import { createClient } from "@supabase/supabase-js";

/**
 * Service role client — bypasses RLS entirely.
 * Only use on the server in routes/actions that have already verified auth or
 * are protected by a secret (e.g. CRON_KEY). Never expose to the client.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
