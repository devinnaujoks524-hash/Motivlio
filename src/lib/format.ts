const TZ = "Europe/Berlin";

export function formatDateTime(iso: string | Date | null | undefined) {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(new Date(iso));
}

export function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return "–";
  const value = typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: TZ }).format(new Date(value));
}

export function formatBytes(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Heute (Berlin) als yyyy-mm-dd für Fristvergleiche. */
export function todayBerlin() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}
