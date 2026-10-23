import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusBadge, btnAccent } from "@/components/ui";
import { formatDate, todayBerlin } from "@/lib/format";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Heute" };

type Row = {
  id: string;
  order_number: string;
  title: string;
  status: string;
  due_date: string | null;
  customers: { company: string };
  order_versions: { version_number: number; status: string; sent_at: string; decided_at: string | null }[];
};

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

function OrderLink({ o, note }: { o: Row; note?: string }) {
  return (
    <li>
      <Link href={`/auftraege/${o.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-3 hover:bg-neutral-50 sm:px-2">
        <span>
          <span className="font-medium">{o.title}</span>
          <span className="block text-sm text-neutral-600">{o.order_number} · {o.customers.company}</span>
        </span>
        <span className="flex items-center gap-2 text-sm text-neutral-600">{note}<StatusBadge status={o.status} /></span>
      </Link>
    </li>
  );
}

function Section({ title, hint, rows, note }: { title: string; hint?: string; rows: Row[]; note?: (o: Row) => string }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <h2 className="font-semibold">{title} <span className="font-normal text-neutral-500">({rows.length})</span></h2>
      {hint && <p className="text-sm text-neutral-600">{hint}</p>}
      <ul className="mt-2 divide-y divide-line">{rows.map((o) => <OrderLink key={o.id} o={o} note={note?.(o)} />)}</ul>
    </Card>
  );
}

export default async function DashboardPage() {
  const { supabase } = await requireBusiness();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, title, status, due_date, customers(company), order_versions(version_number, status, sent_at, decided_at)")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(300);
  const orders = (data ?? []) as unknown as Row[];
  const today = todayBerlin();
  const open = (o: Row) => o.status !== "approved";
  const sentAt = (o: Row) => o.order_versions.find((v) => v.status === "pending")?.sent_at;

  const overdue = orders.filter((o) => open(o) && o.due_date && o.due_date < today);
  const overdueIds = new Set(overdue.map((o) => o.id));
  const changes = orders.filter((o) => o.status === "changes_requested" && !overdueIds.has(o.id));
  const waiting = orders.filter((o) => o.status === "waiting" && !overdueIds.has(o.id));
  const drafts = orders.filter((o) => o.status === "draft" && !overdueIds.has(o.id));
  const approved = orders
    .filter((o) => o.status === "approved")
    .map((o) => ({ o, at: o.order_versions.filter((v) => v.status === "approved").map((v) => v.decided_at ?? "").sort().pop() ?? "" }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5)
    .map((x) => x.o);

  const nothingToDo = overdue.length + changes.length + waiting.length + drafts.length === 0;

  return (
    <>
      <PageHeader title="Wo muss ich heute handeln?">
        <Link href="/auftraege/neu" className={btnAccent}>Neuer Freigabeauftrag</Link>
      </PageHeader>
      <div className="space-y-4">
        {orders.length === 0 && (
          <EmptyState
            title="Noch kein Freigabeauftrag"
            text="Legen Sie zuerst einen Kunden an, erstellen Sie dann einen Auftrag, laden Sie den Entwurf hoch und senden Sie ihn zur Freigabe."
            action={<Link href="/kunden" className={btnAccent}>Ersten Kunden anlegen</Link>}
          />
        )}
        <Section title="Überfällig" hint="Die Frist ist überschritten, der Auftrag ist noch nicht freigegeben." rows={overdue}
          note={(o) => `Frist ${formatDate(o.due_date)}`} />
        <Section title="Änderungen angefordert" hint="Der Kunde wartet auf eine überarbeitete Version." rows={changes} />
        <Section title="Wartet auf Freigabe" rows={waiting}
          note={(o) => { const s = sentAt(o); return s ? `seit ${daysSince(s)} Tg.` : ""; }} />
        <Section title="Entwürfe" hint="Noch nicht an den Kunden gesendet." rows={drafts} />
        {orders.length > 0 && nothingToDo && (
          <EmptyState title="Alles erledigt" text="Es gibt gerade nichts, was von Ihnen eine Aktion braucht." />
        )}
        <Section title="Zuletzt freigegeben" rows={approved} />
      </div>
    </>
  );
}
