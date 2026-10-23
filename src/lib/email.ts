import "server-only";
import { Resend } from "resend";
import { APP_NAME } from "@/lib/config";

export type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string | null };

/**
 * Versand über Resend. Ohne RESEND_API_KEY wird NICHT gesendet:
 * Nur in Entwicklung (EMAIL_DRIVER=console) wird die Mail ausdrücklich als Testausgabe protokolliert.
 * In Produktion schlägt der Versand ohne Schlüssel fehl, statt Erfolg vorzutäuschen.
 */
export async function sendMail(mail: Mail): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    if (process.env.EMAIL_DRIVER === "console" && process.env.NODE_ENV !== "production") {
      console.warn(`[E-MAIL-TESTADAPTER – NICHT GESENDET] an=${mail.to} betreff="${mail.subject}"`);
      return { ok: true };
    }
    return { ok: false, error: "E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY / EMAIL_FROM)." };
  }
  try {
    const { error } = await new Resend(key).emails.send({
      from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: mail.replyTo ?? undefined,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
<h2 style="font-size:18px;margin:0 0 16px">${esc(title)}</h2>${bodyHtml}
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${esc(cta.label)}</a></p>` : ""}
<p style="color:#666;font-size:12px;margin-top:32px">Gesendet über ${esc(APP_NAME)}</p></div>`;
}
