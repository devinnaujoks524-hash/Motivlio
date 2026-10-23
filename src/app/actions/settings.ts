"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FILE_BUCKET, appUrl } from "@/lib/config";
import { checkUpload } from "@/lib/files";
import { requireBusiness } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_PRICE_ENV, getStripe, type PlanId } from "@/lib/stripe";
import type { FormState } from "./types";

const schema = z.object({
  name: z.string().trim().min(1, "Bitte den Firmennamen angeben.").max(120),
  reply_to_email: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().toLowerCase().email("Bitte eine gültige Antwortadresse angeben.").nullable(),
  ),
});

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { supabase, business } = await requireBusiness();
  const { error } = await supabase.from("businesses").update(parsed.data).eq("id", business.id);
  if (error) return { error: "Die Einstellungen konnten nicht gespeichert werden." };

  const logo = fd.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const bytes = new Uint8Array(await logo.arrayBuffer());
    const check = checkUpload(bytes);
    if (!check.ok) return { error: check.error };
    if (check.file.mime === "application/pdf") return { error: "Das Logo muss als PNG oder JPG hochgeladen werden." };
    if (check.size > 2 * 1024 * 1024) return { error: "Das Logo darf höchstens 2 MB groß sein." };
    const admin = createAdminClient();
    const path = `${business.id}/logo/${crypto.randomUUID()}.${check.file.ext}`;
    const up = await admin.storage.from(FILE_BUCKET).upload(path, bytes, { contentType: check.file.mime });
    if (up.error) return { error: "Das Logo konnte nicht hochgeladen werden." };
    await admin.from("businesses").update({ logo_path: path }).eq("id", business.id);
  }
  revalidatePath("/", "layout");
  return { ok: "Gespeichert." };
}

export async function startCheckout(plan: PlanId) {
  const { business, user } = await requireBusiness();
  const priceId = process.env[PLAN_PRICE_ENV[plan]];
  if (!priceId) redirect("/abrechnung?hinweis=" + encodeURIComponent("Stripe ist noch nicht konfiguriert (Preis-ID fehlt)."));
  const admin = createAdminClient();
  const stripe = getStripe();
  const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id").eq("business_id", business.id).single();
  let customer = sub?.stripe_customer_id ?? undefined;
  if (!customer) {
    const c = await stripe.customers.create({ email: user.email, name: business.name, metadata: { business_id: business.id } });
    customer = c.id;
    await admin.from("subscriptions").update({ stripe_customer_id: customer }).eq("business_id", business.id);
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: business.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { business_id: business.id } },
    success_url: `${appUrl()}/abrechnung?checkout=ok`,
    cancel_url: `${appUrl()}/abrechnung`,
  });
  redirect(session.url!);
}

export async function openPortal() {
  const { business } = await requireBusiness();
  const admin = createAdminClient();
  const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id").eq("business_id", business.id).single();
  if (!sub?.stripe_customer_id) redirect("/abrechnung");
  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${appUrl()}/abrechnung`,
  });
  redirect(session.url);
}
