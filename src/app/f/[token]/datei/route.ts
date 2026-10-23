import { FILE_BUCKET } from "@/lib/config";
import { rateLimit } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, isPlausibleToken } from "@/lib/tokens";

export const runtime = "nodejs";

/** Liefert das Dokument genau der Version, die zum Link gehört – nach erneuter Link-Prüfung. */
export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!isPlausibleToken(token)) return new Response("Nicht gefunden", { status: 404 });
  if (!(await rateLimit("file", 120, 600, true))) return new Response("Zu viele Anfragen", { status: 429 });

  const admin = createAdminClient();
  const { data } = await admin.rpc("public_get_version", { p_token_hash: hashToken(token) });
  const v = data as { state: string; file_path?: string; file_mime?: string; file_name?: string } | null;
  if (!v?.file_path || v.state === "unavailable" || v.state === "unknown") {
    return new Response("Nicht gefunden", { status: 404 });
  }
  const file = await admin.storage.from(FILE_BUCKET).download(v.file_path);
  if (file.error) return new Response("Nicht gefunden", { status: 404 });
  const name = encodeURIComponent(v.file_name ?? "entwurf");
  return new Response(file.data.stream(), {
    headers: {
      "Content-Type": v.file_mime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "sandbox",
    },
  });
}
