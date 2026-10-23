import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerShell, DocumentPreview, SpecList } from "@/components/customer-view";
import { Alert, btnSecondary } from "@/components/ui";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Vorschau Kundenansicht" };

/** Zeigt dem Betrieb die Kundenansicht des aktuellen Entwurfs – ohne Aktionen, ohne Link, ohne Wirkung. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, business } = await requireBusiness();
  const { data: o } = await supabase.from("orders").select("*, order_versions(version_number)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const next = Math.max(0, ...o.order_versions.map((v: { version_number: number }) => v.version_number)) + 1;
  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
        Vorschau – so sieht Ihr Kunde den Entwurf. <Link href={`/auftraege/${id}`} className="font-medium underline">Zurück zum Auftrag</Link>
      </div>
      <CustomerShell businessName={business.name} logoSrc={null} title={o.title} orderNumber={o.order_number} versionNumber={next}>
        {o.draft_file_path ? (
          <DocumentPreview src={`/auftraege/${id}/datei`} mime={o.draft_file_mime} name={o.draft_file_name} />
        ) : (
          <Alert kind="info">Es ist noch kein Entwurf hochgeladen.</Alert>
        )}
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-1 font-semibold">Produktionsangaben</h2>
          <SpecList spec={o.spec} />
        </section>
        <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
          <span className={`${btnSecondary} opacity-60`}>Änderungen anfordern</span>
          <span className={`${btnSecondary} opacity-60`}>Diese Version freigeben</span>
        </div>
      </CustomerShell>
    </>
  );
}
