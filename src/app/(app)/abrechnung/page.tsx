import { openPortal, startCheckout } from "@/app/actions/settings";
import { Alert, Card, PageHeader, btnAccent, btnSecondary } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireBusiness } from "@/lib/session";
import { PLAN_INFO, type PlanId } from "@/lib/stripe";

export const metadata = { title: "Abrechnung" };

const STATUS: Record<string, string> = {
  none: "Kein Tarif gewählt",
  active: "Aktiv",
  trialing: "Testzeitraum",
  past_due: "Zahlung offen",
  canceled: "Gekündigt",
  unpaid: "Zahlung offen",
  incomplete: "Unvollständig",
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; hinweis?: string }> }) {
  const { checkout, hinweis } = await searchParams;
  const { supabase, business } = await requireBusiness();
  const { data: sub } = await supabase.from("subscriptions").select("*").eq("business_id", business.id).single();
  const active = sub && ["active", "trialing"].includes(sub.status);

  let used = 0;
  if (active && sub.period_start) {
    let q = supabase.from("orders").select("id", { count: "exact", head: true }).gte("counted_at", sub.period_start);
    if (sub.period_end) q = q.lt("counted_at", sub.period_end);
    used = (await q).count ?? 0;
  }
  const plan = sub?.plan_id ? PLAN_INFO[sub.plan_id as PlanId] : null;

  return (
    <>
      <PageHeader title="Abrechnung" />
      <div className="space-y-5">
        {hinweis && <Alert kind="error">{hinweis}</Alert>}
        {checkout === "ok" && !active && (
          <Alert kind="info">Danke! Sobald Stripe die Zahlung bestätigt hat, wird Ihr Tarif hier freigeschaltet. Das dauert meist nur wenige Sekunden – laden Sie die Seite neu.</Alert>
        )}
        <Card className="space-y-2">
          <h2 className="font-semibold">Aktueller Stand</h2>
          <p>{plan ? `${plan.name} – ${plan.price}` : "Noch kein Tarif"} · <span className="font-medium">{STATUS[sub?.status ?? "none"] ?? sub?.status}</span></p>
          {plan && active && (
            <p className="text-sm text-neutral-600">
              {used} von {plan.orders} Freigabeaufträgen in dieser Periode genutzt
              {sub.period_end ? ` (bis ${formatDate(sub.period_end)})` : ""}. Ein Auftrag zählt beim ersten Versand; weitere Versionen und Erinnerungen zählen nicht.
            </p>
          )}
          {!active && <p className="text-sm text-neutral-600">Ohne aktiven Tarif können Sie Aufträge als Entwurf anlegen, aber nicht versenden. Bereits versendete Links und gespeicherte Freigaben bleiben erhalten.</p>}
          {sub?.stripe_customer_id && (
            <form action={openPortal} className="pt-2"><button className={btnSecondary}>Abo und Rechnungen verwalten</button></form>
          )}
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.entries(PLAN_INFO) as [PlanId, (typeof PLAN_INFO)[PlanId]][]).map(([id, p]) => (
            <Card key={id} className="space-y-2">
              <h2 className="font-semibold">{p.name}</h2>
              <p className="text-2xl font-semibold">{p.price}</p>
              <p className="text-sm text-neutral-600">{p.orders} Freigabeaufträge pro Abrechnungsperiode</p>
              {sub?.plan_id === id && active ? (
                <p className="text-sm font-medium">Ihr aktueller Tarif</p>
              ) : active ? (
                <p className="text-sm text-neutral-600">Wechsel über „Abo verwalten“.</p>
              ) : (
                <form action={startCheckout.bind(null, id)}><button className={btnAccent}>{p.name} wählen</button></form>
              )}
            </Card>
          ))}
        </div>
        <p className="text-xs text-neutral-500">Preise vorläufig, netto zzgl. gesetzlicher Umsatzsteuer.</p>
      </div>
    </>
  );
}
