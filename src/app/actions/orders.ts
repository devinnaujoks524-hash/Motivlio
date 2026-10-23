"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FILE_BUCKET, appUrl, linkValidityDays } from "@/lib/config";
import { encryptToken } from "@/lib/crypto";
import { customerSchema, friendlyDbError, orderSchema, specSchema } from "@/lib/domain";
import { checkUpload, safeFileName, storagePath } from "@/lib/files";
import { sendInvitation } from "@/lib/notify";
import { requireBusiness } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken } from "@/lib/tokens";
import type { FormState } from "./types";

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Bitte prüfen Sie Ihre Eingaben.";
const expiry = () => new Date(Date.now() + linkValidityDays() * 86_400_000).toISOString();

// ------------------------------------------------------------------ Kunden

export async function saveCustomer(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const parsed = customerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { supabase, business } = await requireBusiness();
  const { error } = id
    ? await supabase.from("customers").update(parsed.data).eq("id", id)
    : await supabase.from("customers").insert({ ...parsed.data, business_id: business.id });
  if (error) return { error: "Der Kunde konnte nicht gespeichert werden." };
  revalidatePath("/kunden");
  if (!id && fd.get("return_to")) redirect(String(fd.get("return_to")).startsWith("/auftraege/") ? String(fd.get("return_to")) : "/kunden");
  return { ok: "Gespeichert." };
}

// ------------------------------------------------------------------ Aufträge

async function storeDraftFile(businessId: string, orderId: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes);
  if (!check.ok) return check.error;
  const admin = createAdminClient();
  const path = storagePath(businessId, orderId, check.file.ext);
  const up = await admin.storage.from(FILE_BUCKET).upload(path, bytes, { contentType: check.file.mime, upsert: false });
  if (up.error) return "Der Upload ist fehlgeschlagen. Bitte versuchen Sie es erneut.";
  const { error } = await admin.rpc("attach_draft_file", {
    p_business: businessId, p_order: orderId, p_path: path, p_name: safeFileName(file.name),
    p_mime: check.file.mime, p_size: check.size, p_sha256: check.sha256,
  });
  if (error) {
    await admin.storage.from(FILE_BUCKET).remove([path]);
    return "Die Datei konnte dem Auftrag nicht zugeordnet werden.";
  }
  return null;
}

/** Legt einen Auftrag an (id = null) oder speichert den Entwurfsstand. Versendete Versionen bleiben unberührt. */
export async function saveOrder(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const details = orderSchema.safeParse(Object.fromEntries(fd));
  if (!details.success) return { error: firstIssue(details.error) };
  const spec = specSchema.safeParse(Object.fromEntries(fd));
  if (!spec.success) return { error: firstIssue(spec.error) };
  const file = fd.get("file");

  const { supabase, business } = await requireBusiness();
  const row = {
    ...details.data,
    internal_note: details.data.internal_note || null,
    spec: spec.data,
  };

  let orderId = id;
  if (id) {
    const { error } = await supabase.from("orders").update(row).eq("id", id);
    if (error) return { error: error.code === "23505" ? "Diese Auftragsnummer gibt es bereits." : "Der Auftrag konnte nicht gespeichert werden." };
  } else {
    const { data, error } = await supabase.from("orders").insert({ ...row, business_id: business.id }).select("id").single();
    if (error) return { error: error.code === "23505" ? "Diese Auftragsnummer gibt es bereits." : "Der Auftrag konnte nicht angelegt werden." };
    orderId = data.id;
  }

  if (file instanceof File && file.size > 0) {
    const err = await storeDraftFile(business.id, orderId!, file);
    if (err) {
      if (!id) redirect(`/auftraege/${orderId}?hinweis=${encodeURIComponent(err)}`);
      return { error: `Auftrag gespeichert, aber: ${err}` };
    }
  }
  revalidatePath("/auftraege");
  revalidatePath("/dashboard");
  if (!id) redirect(`/auftraege/${orderId}`);
  revalidatePath(`/auftraege/${id}`);
  return { ok: "Gespeichert." };
}

// ------------------------------------------------------------------ Versand

export async function sendForApproval(orderId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireBusiness();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const { data, error } = await supabase.rpc("send_version", {
    p_order: orderId, p_token_hash: tokenHash, p_token_enc: encryptToken(token), p_expires_at: expiry(),
  });
  if (error) return { error: friendlyDbError(error.message) };
  revalidatePath(`/auftraege/${orderId}`);
  revalidatePath("/dashboard");
  const link = `${appUrl()}/f/${token}`;
  if (fd.get("send_email") === "on") {
    const res = await sendInvitation((data as { version_id: string }).version_id, tokenHash);
    if (res !== "sent") {
      return {
        link,
        error: "Die Version ist versendet, aber die E-Mail konnte nicht zugestellt werden. Bitte senden Sie den Link selbst.",
      };
    }
    return { link, ok: "Version versendet. Der Kunde hat eine E-Mail erhalten." };
  }
  return { link, ok: "Version versendet. Kopieren Sie den Link und schicken Sie ihn dem Kunden." };
}

/** Neuen Link für die offene Version ausstellen (widerruft bisherige Links dieser Version). */
export async function reissueLink(versionId: string, orderId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireBusiness();
  const token = generateToken();
  const { error } = await supabase.rpc("issue_link", {
    p_version: versionId, p_token_hash: hashToken(token), p_token_enc: encryptToken(token), p_expires_at: expiry(),
  });
  if (error) return { error: friendlyDbError(error.message) };
  revalidatePath(`/auftraege/${orderId}`);
  const link = `${appUrl()}/f/${token}`;
  if (fd.get("send_email") === "on") {
    const res = await sendInvitation(versionId, hashToken(token));
    if (res !== "sent") return { link, error: "Neuer Link erstellt, die E-Mail konnte aber nicht zugestellt werden." };
  }
  return { link, ok: "Neuer Link erstellt. Der bisherige Link ist ungültig." };
}

export async function revokeLinks(versionId: string, orderId: string) {
  const { supabase } = await requireBusiness();
  await supabase.rpc("revoke_links", { p_version: versionId });
  revalidatePath(`/auftraege/${orderId}`);
}

export async function startNewRound(orderId: string) {
  const { supabase } = await requireBusiness();
  await supabase.rpc("start_new_round", { p_order: orderId });
  revalidatePath(`/auftraege/${orderId}`);
  revalidatePath("/dashboard");
}

export async function setArchived(orderId: string, archived: boolean) {
  const { supabase } = await requireBusiness();
  await supabase.rpc("set_order_archived", { p_order: orderId, p_archived: archived });
  revalidatePath(`/auftraege/${orderId}`);
  revalidatePath("/auftraege");
  revalidatePath("/dashboard");
}

export async function deleteDraftOrder(orderId: string) {
  const { supabase } = await requireBusiness();
  // Nur Aufträge ohne versendete Version können gelöscht werden (Datenbank verweigert sonst).
  const { error } = await supabase.from("orders").delete().eq("id", orderId).eq("status", "draft");
  if (error) redirect(`/auftraege/${orderId}?hinweis=${encodeURIComponent("Dieser Auftrag hat versendete Versionen und kann nur archiviert werden.")}`);
  revalidatePath("/auftraege");
  redirect("/auftraege");
}
