import { NextResponse, type NextRequest } from "next/server";
import { FILE_BUCKET, SIGNED_URL_SECONDS } from "@/lib/config";
import { requireBusiness } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Download für den Betrieb: ?version=<id> liefert das Original einer Version, sonst das Entwurfsdokument.
 * Die Berechtigung wird über RLS (nutzerbezogener Client) geprüft, erst dann wird eine kurzlebige URL signiert.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const versionId = request.nextUrl.searchParams.get("version");
  const { supabase } = await requireBusiness();

  let path: string | null = null;
  let name: string | null = null;
  if (versionId) {
    const { data } = await supabase
      .from("order_versions").select("file_path, file_name").eq("id", versionId).eq("order_id", id).maybeSingle();
    path = data?.file_path ?? null;
    name = data?.file_name ?? null;
  } else {
    const { data } = await supabase.from("orders").select("draft_file_path, draft_file_name").eq("id", id).maybeSingle();
    path = data?.draft_file_path ?? null;
    name = data?.draft_file_name ?? null;
  }
  if (!path) return new Response("Nicht gefunden", { status: 404 });

  const { data: signed, error } = await createAdminClient()
    .storage.from(FILE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: request.nextUrl.searchParams.get("download") ? (name ?? true) : false });
  if (error || !signed) return new Response("Nicht gefunden", { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
