import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate Limit für öffentliche Endpunkte. Die IP wird nur als gesalzener Hash in kurzlebigen
 * Zählern verwendet (Fenster ≤ 1 Stunde, Zeilen werden nach 1 Tag gelöscht) – nie im Klartext.
 */
export async function rateLimit(kind: string, max: number, windowSeconds: number, failOpen: boolean) {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const salt = process.env.RATE_LIMIT_SALT ?? "";
    const bucket = `${kind}:${createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32)}`;
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return failOpen;
    return data === true;
  } catch {
    return failOpen;
  }
}
