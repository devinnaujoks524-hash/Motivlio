import type { NextRequest } from "next/server";
import { APPROVAL_TEXT, APP_NAME } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { buildProtocolPdf } from "@/lib/protocol";
import { requireBusiness } from "@/lib/session";

export const runtime = "nodejs";

/** Produktionszettel mit Freigabeprotokoll – nur für eine freigegebene Version (RLS-geprüft). */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const versionId = request.nextUrl.searchParams.get("version");
  const { supabase, business } = await requireBusiness();

  let q = supabase
    .from("order_versions")
    .select("*, orders!inner(order_number, title, customers!inner(company, contact_name))")
    .eq("order_id", id)
    .eq("status", "approved");
  if (versionId) q = q.eq("id", versionId);
  const { data } = await q.order("version_number", { ascending: false }).limit(1).maybeSingle();
  if (!data) return new Response("Keine freigegebene Version gefunden", { status: 404 });

  const v = data as any;
  const pdf = await buildProtocolPdf({
    appName: APP_NAME,
    businessName: business.name,
    customerCompany: v.orders.customers.company,
    contactName: v.orders.customers.contact_name,
    orderNumber: v.orders.order_number,
    title: v.orders.title,
    versionNumber: v.version_number,
    spec: v.spec,
    fileName: v.file_name,
    fileSha256: v.file_sha256,
    approvedBy: v.decided_by_name,
    approvedAt: formatDateTime(v.decided_at),
    approvalText: v.decision_text ?? APPROVAL_TEXT,
    comment: v.comment,
  });
  const name = `Produktionszettel_${v.orders.order_number}_V${v.version_number}.pdf`.replace(/[^\w.-]/g, "_");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
