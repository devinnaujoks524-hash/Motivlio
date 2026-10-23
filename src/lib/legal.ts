// Betreiberangaben für das Impressum. Werden aus der Umgebung gelesen – nichts davon ist erfunden.
// Pflichtangaben je nach Rechtsform bitte juristisch prüfen lassen.
export type LegalField = { label: string; value: string | null; required: boolean };

const env = (k: string) => process.env[k]?.trim() || null;

export function legalFields(): LegalField[] {
  return [
    { label: "Name / Firma", value: env("LEGAL_NAME"), required: true },
    { label: "Rechtsform", value: env("LEGAL_FORM"), required: false },
    { label: "Vertretungsberechtigte Person", value: env("LEGAL_REPRESENTATIVE"), required: false },
    { label: "Anschrift", value: env("LEGAL_ADDRESS")?.replace(/\\n/g, "\n") ?? null, required: true },
    { label: "E-Mail", value: env("LEGAL_EMAIL"), required: true },
    { label: "Telefon", value: env("LEGAL_PHONE"), required: false },
    { label: "Handelsregister", value: env("LEGAL_REGISTER"), required: false },
    { label: "Umsatzsteuer-Identifikationsnummer", value: env("LEGAL_VAT_ID"), required: false },
    { label: "Verantwortlich für Inhalte (§ 18 Abs. 2 MStV)", value: env("LEGAL_CONTENT_RESPONSIBLE"), required: false },
  ];
}

export function legalComplete() {
  return legalFields().every((f) => !f.required || f.value);
}
