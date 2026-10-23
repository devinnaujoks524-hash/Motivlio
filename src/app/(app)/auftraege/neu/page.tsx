import Link from "next/link";
import { OrderForm } from "@/components/order-form";
import { Card, EmptyState, PageHeader, btnAccent } from "@/components/ui";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Neuer Freigabeauftrag" };

export default async function NewOrderPage() {
  const { supabase } = await requireBusiness();
  const [{ data: customers }, { count }] = await Promise.all([
    supabase.from("customers").select("id, company, contact_name").order("company"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
  ]);
  const suggested = `A-${String((count ?? 0) + 1).padStart(4, "0")}`;
  return (
    <>
      <PageHeader title="Neuer Freigabeauftrag" subtitle="Eine Ausführung mit einem Entwurf. Weitere Motive legen Sie als eigene Aufträge an." />
      {!customers?.length ? (
        <EmptyState title="Zuerst einen Kunden anlegen" text="Für die Freigabe brauchen wir Ansprechpartner und E-Mail-Adresse." action={<Link href="/kunden" className={btnAccent}>Kunden anlegen</Link>} />
      ) : (
        <Card><OrderForm customers={customers} suggestedNumber={suggested} /></Card>
      )}
    </>
  );
}
