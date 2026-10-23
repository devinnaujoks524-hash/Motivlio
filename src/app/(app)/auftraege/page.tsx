import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusBadge, btnAccent, btnSecondary, inputCls } from "@/components/ui";
import { ORDER_STATUS_LABEL } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Aufträge" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const { supabase } = await requireBusiness();

  let query = supabase
    .from("orders")
    .select("id, order_number, title, status, due_date, customers(company)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status in ORDER_STATUS_LABEL) query = query.eq("status", status as keyof typeof ORDER_STATUS_LABEL);
  else query = query.neq("status", "archived");
  const term = q.replace(/[%,()*\\]/g, " ").trim();
  if (term) query = query.or(`title.ilike.%${term}%,order_number.ilike.%${term}%`);
  const { data } = await query;
  const orders = (data ?? []) as unknown as { id: string; order_number: string; title: string; status: string; due_date: string | null; customers: { company: string } }[];

  return (
    <>
      <PageHeader title="Aufträge"><Link href="/auftraege/neu" className={btnAccent}>Neuer Freigabeauftrag</Link></PageHeader>
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <input name="q" defaultValue={q} placeholder="Suche nach Titel oder Auftragsnummer" aria-label="Suche" className={inputCls} />
        <select name="status" defaultValue={status} aria-label="Status" className={`${inputCls} sm:max-w-56`}>
          <option value="">Alle (ohne Archiv)</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className={btnSecondary}>Filtern</button>
      </form>
      {orders.length === 0 ? (
        <EmptyState
          title={q || status ? "Keine passenden Aufträge" : "Noch keine Aufträge"}
          text={q || status ? "Ändern Sie Suche oder Filter." : "Erstellen Sie Ihren ersten Freigabeauftrag, um einen Entwurf zur Freigabe zu senden."}
          action={!q && !status ? <Link href="/auftraege/neu" className={btnAccent}>Auftrag erstellen</Link> : undefined}
        />
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/auftraege/${o.id}`} className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-neutral-50">
                  <span>
                    <span className="font-medium">{o.title}</span>
                    <span className="block text-sm text-neutral-600">{o.order_number} · {o.customers.company}{o.due_date ? ` · Frist ${formatDate(o.due_date)}` : ""}</span>
                  </span>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
