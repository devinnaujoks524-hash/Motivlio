import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/config";

/** Service-Role-Client: umgeht RLS. Nur serverseitig, nur nach eigener Berechtigungsprüfung. */
export function createAdminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
