// Zentrale Konfiguration. Produktname hier (oder per NEXT_PUBLIC_APP_NAME) ändern.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Freigabeklar";

export const APPROVAL_TEXT =
  "Ich habe den Entwurf und die aufgeführten Produktionsangaben geprüft und gebe diese Version zur Produktion frei.";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const FILE_BUCKET = "drafts";
export const SIGNED_URL_SECONDS = 300;
export const REMINDER_FIRST_AFTER = "2 days";
export const REMINDER_SECOND_AFTER = "5 days";

export function linkValidityDays() {
  const n = Number(process.env.SHARE_LINK_VALID_DAYS ?? 30);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? Math.floor(n) : 30;
}

export function appUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL ist nicht gesetzt");
  return url.replace(/\/$/, "");
}

export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Umgebungsvariable ${name} fehlt (siehe .env.example)`);
  return v;
}
