import { FILE_BUCKET } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, isPlausibleToken } from "@/lib/tokens";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!isPlausibleToken(token)) return new Response("Nicht gefunden", { status: 404 });
  const admin = createAdminClient();
  const { data } = await admin.rpc("public_get_version", { p_token_hash: hashToken(token) });
  const path = (data as { business_logo_path?: string } | null)?.business_logo_path;
  if (!path) return new Response("Nicht gefunden", { status: 404 });
  const file = await admin.storage.from(FILE_BUCKET).download(path);
  if (file.error) return new Response("Nicht gefunden", { status: 404 });
  return new Response(file.data.stream(), {
    headers: {
      "Content-Type": path.endsWith(".png") ? "image/png" : "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
