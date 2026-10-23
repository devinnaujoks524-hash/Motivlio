import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDraftOrder, reissueLink, revokeLinks, sendForApproval, setArchived, startNewRound } from "@/app/actions/orders";
import { ActionForm, LinkBox } from "@/components/form";
import { OrderForm } from "@/components/order-form";
import { Alert, Card, PageHeader, StatusBadge, btnAccent, btnDanger, btnSecondary } from "@/components/ui";
import { SpecList } from "@/components/customer-view";
import { appUrl } from "@/lib/config";
import { decryptToken } from "@/lib/crypto";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { requireBusiness } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Auftrag" };

const ACTIVITY: Record<string, string> = {
  sent: "Zur Freigabe versendet",
  superseded: "Durch neue Version ersetzt",
  approved: "Freigegeben",
  changes_requested: "Änderungen angefordert",
  link_issued: "Neuer Link erstellt",
  links_revoked: "Links widerrufen",
  new_round: "Neue Freigaberunde gestartet",
  archived: "Archiviert",
  unarchived: "Aus dem Archiv geholt",
};

async function currentLink(versionId: string) {
  try {
    const { data } = await createAdminClient()
      .from("share_links").select("token_enc")
      .eq("version_id", versionId).is("revoked_at", null).gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ? `${appUrl()}/f/${decryptToken(data.token_enc)}` : null;
  } catch {
    return null;
  }
}

export default async function OrderDetailPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ hinweis?: string }> }) {
  const { id } = await params;
  const { hinweis } = await searchParams;
  const { supabase } = await requireBusiness();

  const { data: order } = await supabase
    .from("orders").select("*, customers(id, company, contact_name, email)").eq("id", id).maybeSingle();
  if (!order) notFound();
  const [{ data: versions }, { data: activity }, { data: customers }] = await Promise.all([
    supabase.from("order_versions").select("*").eq("order_id", id).order("version_number", { ascending: false }),
    supabase.from("activity").select("id, kind, detail, created_at, version_id").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("customers").select("id, company, contact_name").order("company"),
  ]);
  const vs = versions ?? [];
  const pending = vs.find((v) => v.status === "pending");
  const approved = vs.find((v) => v.status === "approved");
  const link = pending && order.status === "waiting" ? await currentLink(pending.id) : null;
  const canSend = ["draft", "changes_requested", "waiting"].includes(order.status);
  const hasFile = !!order.draft_file_path;
  const nextNumber = (vs[0]?.version_number ?? 0) + 1;

  return (
    <>
      <PageHeader title={order.title} subtitle={`Auftrag ${order.order_number} · ${order.customers.company} (${order.customers.contact_name}, ${order.customers.email})${order.due_date ? ` · Frist ${formatDate(order.due_date)}` : ""}`}>
        <StatusBadge status={order.status} />
      </PageHeader>
      <div className="space-y-5">
        {hinweis && <Alert kind="error">{hinweis}</Alert>}

        {canSend && (
          <Card className="space-y-4">
            <div>
              <h2 className="font-semibold">{order.status === "waiting" ? "Neue Version senden" : vs.length ? `Version ${nextNumber} zur Freigabe senden` : "Zur Freigabe senden"}</h2>
              <p className="text-sm text-neutral-600">
                {order.status === "waiting"
                  ? `Version ${pending?.version_number} wartet auf Freigabe. Eine neue Version ersetzt sie; deren Link wird ungültig.`
                  : "Der Kunde erhält einen privaten Link zur Ansicht, ohne Registrierung."}
              </p>
            </div>
            {!hasFile && <Alert kind="info">Laden Sie unten zuerst einen Entwurf (PDF, PNG oder JPG) hoch.</Alert>}
            <ActionForm action={sendForApproval.bind(null, id)} submit={order.status === "waiting" ? "Version ersetzen und senden" : "An Kunden senden"} submitClass={btnAccent}>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" name="send_email" defaultChecked className="size-5 accent-[var(--accent)]" />
                Einladung per E-Mail an {order.customers.email} senden
              </label>
            </ActionForm>
            <div><Link href={`/auftraege/${id}/vorschau`} className="text-sm underline">Kundenansicht als Vorschau ansehen</Link></div>
          </Card>
        )}

        {pending && order.status === "waiting" && (
          <Card className="space-y-3">
            <h2 className="font-semibold">Privater Link zu Version {pending.version_number}</h2>
            {link ? <LinkBox link={link} /> : <p className="text-sm text-neutral-600">Kein aktiver Link. Erstellen Sie einen neuen.</p>}
            <ActionForm action={reissueLink.bind(null, pending.id, id)} submit="Neuen Link erstellen" submitClass={btnSecondary} className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="send_email" className="size-5 accent-[var(--accent)]" />Zusätzlich per E-Mail senden</label>
            </ActionForm>
            <form action={revokeLinks.bind(null, pending.id, id)}><button className={btnDanger}>Link widerrufen</button></form>
          </Card>
        )}

        {order.status === "approved" && approved && (
          <Card className="space-y-3">
            <h2 className="font-semibold">Freigegeben – Version {approved.version_number}</h2>
            <p className="text-sm text-neutral-600">von {approved.decided_by_name} am {formatDateTime(approved.decided_at)}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/auftraege/${id}/produktionszettel?version=${approved.id}`} className={btnAccent}>Produktionszettel (PDF)</a>
              <a href={`/auftraege/${id}/datei?version=${approved.id}&download=1`} className={btnSecondary}>Original herunterladen</a>
              <form action={startNewRound.bind(null, id)}><button className={btnSecondary}>Neue Freigaberunde starten</button></form>
            </div>
            <p className="text-xs text-neutral-500">Eine freigegebene Version bleibt unverändert. Änderungen erfordern eine ausdrücklich neue Freigaberunde.</p>
          </Card>
        )}

        <Card>
          <h2 className="mb-3 font-semibold">Versionen</h2>
          {vs.length === 0 ? (
            <p className="text-sm text-neutral-600">Noch nichts versendet. Jede versendete Version wird hier unveränderlich festgehalten.</p>
          ) : (
            <ul className="divide-y divide-line">
              {vs.map((v) => (
                <li key={v.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Version {v.version_number}</span>
                    <StatusBadge status={v.status} kind="version" />
                  </div>
                  <p className="text-sm text-neutral-600">Gesendet {formatDateTime(v.sent_at)} · {v.file_name} ({formatBytes(v.file_size)})</p>
                  {v.status === "approved" && <p className="text-sm">Freigegeben von <strong>{v.decided_by_name}</strong> am {formatDateTime(v.decided_at)}</p>}
                  {v.comment && <blockquote className="border-l-2 border-line pl-3 text-sm text-neutral-700">{v.comment}</blockquote>}
                  <details className="text-sm">
                    <summary className="min-h-11 cursor-pointer py-2 underline">Produktionsangaben dieser Version</summary>
                    <SpecList spec={v.spec} />
                    <p className="mt-2 break-all text-xs text-neutral-500">SHA-256: {v.file_sha256}</p>
                  </details>
                  <a href={`/auftraege/${id}/datei?version=${v.id}`} target="_blank" className="inline-flex min-h-11 items-center text-sm underline">Dokument ansehen</a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Verlauf</h2>
          {!activity?.length ? <p className="text-sm text-neutral-600">Noch keine Aktivitäten.</p> : (
            <ol className="relative space-y-4 border-l border-line pl-5">
              {activity.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[1.55rem] top-1.5 size-2.5 rounded-full bg-neutral-400" />
                  <p className="text-sm font-medium">{ACTIVITY[a.kind] ?? a.kind}{a.kind === "approved" && a.detail ? ` von ${a.detail}` : ""}</p>
                  <p className="text-xs text-neutral-500">{formatDateTime(a.created_at)}{a.kind === "sent" && a.detail ? ` · ${a.detail}` : ""}</p>
                  {a.kind === "changes_requested" && a.detail && <p className="mt-1 text-sm text-neutral-700">„{a.detail}“</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {order.status !== "archived" && (
          <Card>
            <h2 className="mb-1 font-semibold">Entwurf bearbeiten</h2>
            <p className="mb-4 text-sm text-neutral-600">
              Änderungen betreffen die nächste Version. Bereits versendete Versionen bleiben unverändert.
              {hasFile && <> <a className="underline" href={`/auftraege/${id}/datei`} target="_blank">Aktuellen Entwurf ansehen</a>.</>}
            </p>
            <OrderForm
              customers={customers ?? []}
              defaults={{
                id, order_number: order.order_number, title: order.title, customer_id: order.customer_id, due_date: order.due_date,
                internal_note: order.internal_note, spec: order.spec, fileName: order.draft_file_name,
              }}
            />
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          {order.status === "archived" ? (
            <form action={setArchived.bind(null, id, false)}><button className={btnSecondary}>Aus dem Archiv holen</button></form>
          ) : (
            <form action={setArchived.bind(null, id, true)}><button className={btnSecondary}>Archivieren</button></form>
          )}
          {vs.length === 0 && order.status === "draft" && (
            <form action={deleteDraftOrder.bind(null, id)}><button className={btnDanger}>Entwurf löschen</button></form>
          )}
        </div>
      </div>
    </>
  );
}
