import "server-only";
import { APP_NAME, APPROVAL_TEXT, appUrl } from "@/lib/config";
import { decryptToken } from "@/lib/crypto";
import { esc, layout, sendMail, type Mail } from "@/lib/email";
import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Idempotenter Versand: Der Dedupe-Key wird atomar "beansprucht". Nur wer ihn bekommt, sendet.
 * Ein Versandfehler wird protokolliert, ändert aber nie eine gespeicherte Entscheidung.
 */
async function deliver(admin: Admin, key: string, businessId: string, kind: string, mail: Mail) {
  const { data: claimed } = await admin.rpc("claim_email", {
    p_key: key, p_business: businessId, p_kind: kind, p_to: mail.to,
  });
  if (claimed !== true) return "duplicate" as const;
  const res = await sendMail(mail);
  await admin.rpc("finish_email", { p_key: key, p_ok: res.ok, p_error: res.ok ? null : res.error });
  return res.ok ? ("sent" as const) : ("failed" as const);
}

async function loadVersion(admin: Admin, versionId: string) {
  const { data } = await admin
    .from("order_versions")
    .select(
      "id, version_number, status, spec, file_name, file_sha256, decided_at, decided_by_name, comment, " +
        "orders!inner(id, order_number, title, customers!inner(company, contact_name, email), " +
        "businesses!inner(id, name, owner_id, reply_to_email))",
    )
    .eq("id", versionId)
    .single();
  if (!data) return null;
  const v = data as any;
  const order = v.orders;
  const owner = await admin.auth.admin.getUserById(order.businesses.owner_id);
  return { v, order, customer: order.customers, business: order.businesses, ownerEmail: owner.data.user?.email ?? null };
}

async function activeLinkUrl(admin: Admin, versionId: string) {
  const { data } = await admin
    .from("share_links")
    .select("token_enc")
    .eq("version_id", versionId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? `${appUrl()}/f/${decryptToken(data.token_enc)}` : null;
}

export async function sendInvitation(versionId: string, tokenHashForKey: string) {
  const admin = createAdminClient();
  const ctx = await loadVersion(admin, versionId);
  const url = await activeLinkUrl(admin, versionId);
  if (!ctx || !url) return "failed" as const;
  const { business, order, customer, v } = ctx;
  const subject = `${business.name}: Bitte Entwurf prüfen und freigeben (${order.order_number})`;
  const body = `<p>Guten Tag ${esc(customer.contact_name)},</p>
<p>${esc(business.name)} bittet um Ihre Prüfung und Freigabe: <strong>${esc(order.title)}</strong> (Auftrag ${esc(order.order_number)}, Version ${v.version_number}).</p>
<p>Der Link ist privat – bitte nicht weiterleiten.</p>`;
  return deliver(admin, `invite:${tokenHashForKey}`, business.id, "invitation", {
    to: customer.email,
    subject,
    html: layout("Freigabe angefragt", body, { label: "Entwurf prüfen", url }),
    text: `${subject}\n\n${url}`,
    replyTo: business.reply_to_email ?? ctx.ownerEmail,
  });
}

export async function sendReminder(versionId: string, reminderNo: number) {
  const admin = createAdminClient();
  const ctx = await loadVersion(admin, versionId);
  const url = await activeLinkUrl(admin, versionId);
  if (!ctx || !url) return "failed" as const;
  const { business, order, customer, v } = ctx;
  const subject = `Erinnerung: Freigabe für ${order.title} (${order.order_number}) steht noch aus`;
  const body = `<p>Guten Tag ${esc(customer.contact_name)},</p>
<p>die Freigabe von Version ${v.version_number} für <strong>${esc(order.title)}</strong> steht noch aus.</p>`;
  return deliver(admin, `reminder:${versionId}:${reminderNo}`, business.id, "reminder", {
    to: customer.email,
    subject,
    html: layout("Erinnerung zur Freigabe", body, { label: "Entwurf prüfen", url }),
    text: `${subject}\n\n${url}`,
    replyTo: business.reply_to_email ?? ctx.ownerEmail,
  });
}

/** Nach gespeicherter Entscheidung; Fehler werden geschluckt (Entscheidung bleibt gültig). */
export async function notifyDecision(versionId: string, decision: "approved" | "changes_requested") {
  try {
    const admin = createAdminClient();
    const ctx = await loadVersion(admin, versionId);
    if (!ctx) return;
    const { business, order, customer, v, ownerEmail } = ctx;
    const link = `${appUrl()}/auftraege/${order.id}`;
    if (decision === "changes_requested") {
      if (!ownerEmail) return;
      const subject = `Änderungen angefordert: ${order.title} (${order.order_number})`;
      await deliver(admin, `changes:${versionId}`, business.id, "changes_requested", {
        to: ownerEmail,
        subject,
        html: layout(
          "Änderungswunsch erhalten",
          `<p>${esc(customer.company)} wünscht Änderungen an Version ${v.version_number}:</p><blockquote style="border-left:3px solid #ccc;margin:12px 0;padding-left:12px">${esc(v.comment ?? "")}</blockquote>`,
          { label: "Auftrag öffnen", url: link },
        ),
        text: `${subject}\n\n${v.comment ?? ""}\n\n${link}`,
      });
      return;
    }
    const when = formatDateTime(v.decided_at);
    const summary = `<p><strong>${esc(order.title)}</strong> (Auftrag ${esc(order.order_number)}), Version ${v.version_number}<br>Freigegeben von ${esc(v.decided_by_name ?? "")} am ${esc(when)}.</p>
<p style="color:#555">„${esc(APPROVAL_TEXT)}“</p>`;
    const subject = `Freigabe bestätigt: ${order.title} (${order.order_number})`;
    if (ownerEmail) {
      await deliver(admin, `approved:${versionId}:business`, business.id, "approved_business", {
        to: ownerEmail,
        subject,
        html: layout("Freigabe erteilt", summary, { label: "Produktionszettel öffnen", url: link }),
        text: `${subject}\n\nFreigegeben von ${v.decided_by_name} am ${when}.\n${link}`,
      });
    }
    await deliver(admin, `approved:${versionId}:customer`, business.id, "approved_customer", {
      to: customer.email,
      subject: `${APP_NAME}: Ihre Freigabe wurde gespeichert (${order.order_number})`,
      html: layout("Ihre Freigabe wurde gespeichert", summary),
      text: `Ihre Freigabe für ${order.title} (Version ${v.version_number}) wurde am ${when} gespeichert.`,
      replyTo: business.reply_to_email ?? ownerEmail,
    });
  } catch (e) {
    console.error("notifyDecision fehlgeschlagen", e instanceof Error ? e.message : "unbekannt");
  }
}
