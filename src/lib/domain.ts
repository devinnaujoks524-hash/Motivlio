import { z } from "zod";

export const METHODS = { stick: "Stick", druck: "Druck", transfer: "Transfer", sonstiges: "Sonstiges" } as const;

export const ORDER_STATUS_LABEL = {
  draft: "Entwurf",
  waiting: "Wartet auf Freigabe",
  changes_requested: "Änderungen angefordert",
  approved: "Freigegeben",
  archived: "Archiviert",
} as const;
export type OrderStatus = keyof typeof ORDER_STATUS_LABEL;

export const VERSION_STATUS_LABEL = {
  pending: "Wartet auf Freigabe",
  superseded: "Ersetzt",
  approved: "Freigegeben",
  changes_requested: "Änderungen angefordert",
} as const;

const text = (max: number) => z.string().trim().max(max);
const optionalMm = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(String(v).replace(",", "."))),
  z.number().positive("Bitte eine Zahl größer 0 angeben.").max(2000).optional(),
);

export const specSchema = z.object({
  garment: text(160).min(1, "Bitte den Artikel angeben."),
  garmentColor: text(80).optional().default(""),
  method: z.enum(["stick", "druck", "transfer", "sonstiges"], { message: "Bitte ein Verfahren wählen." }),
  position: text(120).min(1, "Bitte die Motivposition angeben."),
  widthMm: optionalMm,
  heightMm: optionalMm,
  colors: text(500).optional().default(""),
  quantity: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int("Bitte eine ganze Zahl angeben.").min(1).max(1_000_000).optional(),
  ),
  customerNote: text(2000).optional().default(""),
});
export type Spec = z.infer<typeof specSchema>;

export const customerSchema = z.object({
  company: text(160).min(1, "Bitte die Firma angeben."),
  contact_name: text(160).min(1, "Bitte einen Ansprechpartner angeben."),
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben."),
});

export const orderSchema = z.object({
  order_number: text(60).min(1, "Bitte eine Auftragsnummer angeben."),
  title: text(160).min(1, "Bitte einen Titel angeben."),
  customer_id: z.string().uuid("Bitte einen Kunden wählen."),
  due_date: z.preprocess((v) => (v === "" ? null : v), z.string().date().nullable()),
  internal_note: text(4000).optional().default(""),
});

export const decisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    name: text(160).min(2, "Bitte Ihren vollständigen Namen angeben."),
    confirmed: z.literal("on", { message: "Bitte bestätigen Sie die Prüfung." }),
    comment: text(4000).optional().default(""),
  }),
  z.object({
    decision: z.literal("request_changes"),
    comment: text(4000).min(3, "Bitte beschreiben Sie, was geändert werden soll."),
    name: text(160).optional().default(""),
  }),
]);

/** Übersetzt Datenbankfehler (errcode P0001, message = Code) in verständliche Hinweise. */
const DB_ERRORS: Record<string, string> = {
  order_not_found: "Der Auftrag wurde nicht gefunden.",
  invalid_state: "Das ist im aktuellen Status des Auftrags nicht möglich.",
  missing_file: "Bitte laden Sie zuerst einen Entwurf hoch.",
  missing_spec: "Bitte ergänzen Sie Artikel, Verfahren und Motivposition.",
  no_subscription: "Zum Versenden wird ein aktiver Tarif benötigt. Bitte wählen Sie unter „Abrechnung“ einen Tarif.",
  limit_reached:
    "Das Kontingent Ihres Tarifs ist für diese Abrechnungsperiode aufgebraucht. Bitte wechseln Sie den Tarif oder warten Sie auf die nächste Periode. Der Auftrag bleibt als Entwurf erhalten.",
  invalid_expiry: "Die Gültigkeit des Links ist ungültig.",
  version_not_found: "Die Version wurde nicht gefunden.",
};
export function friendlyDbError(message: string | undefined) {
  const code = (message ?? "").trim();
  return DB_ERRORS[code] ?? "Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.";
}
