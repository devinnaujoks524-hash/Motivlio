import { saveCustomer } from "@/app/actions/orders";
import { ActionForm } from "@/components/form";
import { Card, EmptyState, Field, PageHeader, btnSecondary, inputCls } from "@/components/ui";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Kunden" };

function CustomerFields({ c }: { c?: { company: string; contact_name: string; email: string } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Firma"><input name="company" required defaultValue={c?.company} className={inputCls} /></Field>
      <Field label="Ansprechpartner"><input name="contact_name" required defaultValue={c?.contact_name} className={inputCls} /></Field>
      <Field label="E-Mail"><input name="email" type="email" required defaultValue={c?.email} className={inputCls} /></Field>
    </div>
  );
}

export default async function CustomersPage() {
  const { supabase } = await requireBusiness();
  const { data: customers } = await supabase.from("customers").select("*").order("company");
  return (
    <>
      <PageHeader title="Kunden" />
      <div className="space-y-5">
        <Card>
          <h2 className="mb-3 font-semibold">Neuen Kunden anlegen</h2>
          <ActionForm action={saveCustomer.bind(null, null)} submit="Kunde anlegen"><CustomerFields /></ActionForm>
        </Card>
        {!customers?.length ? (
          <EmptyState title="Noch keine Kunden" text="Legen Sie oben Ihren ersten Kunden an. Danach können Sie einen Freigabeauftrag erstellen." />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {customers.map((c) => (
                <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                  <details>
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{c.company}</span>
                      <span className="text-sm text-neutral-600">{c.contact_name} · {c.email}</span>
                    </summary>
                    <div className="pt-3">
                      <ActionForm action={saveCustomer.bind(null, c.id)} submit="Speichern" submitClass={btnSecondary}><CustomerFields c={c} /></ActionForm>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
