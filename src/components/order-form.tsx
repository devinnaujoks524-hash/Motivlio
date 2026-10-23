"use client";

import Link from "next/link";
import { saveOrder } from "@/app/actions/orders";
import { ActionForm } from "@/components/form";
import { Field, inputCls } from "@/components/ui";
import { METHODS } from "@/lib/domain";

export type OrderDefaults = {
  id?: string;
  order_number?: string;
  title?: string;
  customer_id?: string;
  due_date?: string | null;
  internal_note?: string | null;
  spec?: Record<string, string | number | undefined>;
  fileName?: string | null;
};

export function OrderForm({
  customers, defaults = {}, suggestedNumber,
}: {
  customers: { id: string; company: string; contact_name: string }[];
  defaults?: OrderDefaults;
  suggestedNumber?: string;
}) {
  const s = defaults.spec ?? {};
  const action = saveOrder.bind(null, defaults.id ?? null);
  return (
    <ActionForm action={action} submit={defaults.id ? "Entwurf speichern" : "Auftrag anlegen"} encType="multipart/form-data" className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-1 font-semibold">Auftrag</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auftragsnummer" htmlFor="order_number">
            <input id="order_number" name="order_number" required defaultValue={defaults.order_number ?? suggestedNumber} className={inputCls} />
          </Field>
          <Field label="Kunde" htmlFor="customer_id">
            <select id="customer_id" name="customer_id" required defaultValue={defaults.customer_id ?? ""} className={inputCls}>
              <option value="" disabled>Bitte wählen …</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company} – {c.contact_name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Titel" htmlFor="title"><input id="title" name="title" required defaultValue={defaults.title} className={inputCls} placeholder="z. B. Poloshirts Team Nord – Logo Brust" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Frist (optional)" htmlFor="due_date"><input id="due_date" name="due_date" type="date" defaultValue={defaults.due_date ?? ""} className={inputCls} /></Field>
        </div>
        <Field label="Interne Notiz" htmlFor="internal_note" hint="Wird dem Kunden nie angezeigt.">
          <textarea id="internal_note" name="internal_note" rows={2} defaultValue={defaults.internal_note ?? ""} className={inputCls} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 font-semibold">Entwurf</legend>
        <Field label={defaults.fileName ? "Entwurf ersetzen (PDF, PNG oder JPG, max. 15 MB)" : "Entwurf hochladen (PDF, PNG oder JPG, max. 15 MB)"} htmlFor="file"
          hint={defaults.fileName ? `Aktuell: ${defaults.fileName}. Bereits versendete Versionen behalten ihr Dokument.` : undefined}>
          <input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" className={`${inputCls} file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5`} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 font-semibold">Produktionsangaben</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kleidungsstück / Artikel" htmlFor="garment"><input id="garment" name="garment" required defaultValue={s.garment} className={inputCls} placeholder="z. B. Poloshirt Herren" /></Field>
          <Field label="Kleidungsfarbe" htmlFor="garmentColor"><input id="garmentColor" name="garmentColor" defaultValue={s.garmentColor} className={inputCls} /></Field>
          <Field label="Veredelungsverfahren" htmlFor="method">
            <select id="method" name="method" required defaultValue={String(s.method ?? "")} className={inputCls}>
              <option value="" disabled>Bitte wählen …</option>
              {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Motivposition" htmlFor="position"><input id="position" name="position" required defaultValue={s.position} className={inputCls} placeholder="z. B. Brust links" /></Field>
          <Field label="Motivbreite (mm)" htmlFor="widthMm"><input id="widthMm" name="widthMm" inputMode="decimal" defaultValue={s.widthMm} className={inputCls} /></Field>
          <Field label="Motivhöhe (mm)" htmlFor="heightMm"><input id="heightMm" name="heightMm" inputMode="decimal" defaultValue={s.heightMm} className={inputCls} /></Field>
          <Field label="Stückzahl" htmlFor="quantity"><input id="quantity" name="quantity" inputMode="numeric" defaultValue={s.quantity} className={inputCls} /></Field>
        </div>
        <Field label="Farb-/Garnangaben" htmlFor="colors"><textarea id="colors" name="colors" rows={2} defaultValue={s.colors} className={inputCls} /></Field>
        <Field label="Hinweise für den Kunden" htmlFor="customerNote" hint="Sichtbar in der Kundenansicht."><textarea id="customerNote" name="customerNote" rows={2} defaultValue={s.customerNote} className={inputCls} /></Field>
      </fieldset>
    </ActionForm>
  );
}

export function NoCustomersHint() {
  return (
    <p className="text-sm text-neutral-600">
      Zuerst wird ein Kunde gebraucht. <Link className="underline" href="/kunden">Kunden anlegen</Link>
    </p>
  );
}
