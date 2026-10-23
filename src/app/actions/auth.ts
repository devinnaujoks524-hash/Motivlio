"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { appUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/session";
import type { FormState } from "./types";

const email = z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben.");
const password = z.string().min(10, "Das Passwort braucht mindestens 10 Zeichen.").max(200);

const first = (e: z.ZodError) => e.issues[0]?.message ?? "Bitte prüfen Sie Ihre Eingaben.";

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1, "Bitte Passwort eingeben.") }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: first(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-Mail oder Passwort stimmt nicht. Bitte erneut versuchen oder das Passwort zurücksetzen." };
  redirect("/dashboard");
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ email, password }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: first(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${appUrl()}/auth/callback` },
  });
  if (error) return { error: "Die Registrierung hat nicht geklappt. Gibt es bereits ein Konto mit dieser E-Mail-Adresse?" };
  if (data.session) redirect("/willkommen");
  return { ok: "Fast geschafft: Wir haben Ihnen eine E-Mail zur Bestätigung geschickt." };
}

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: first(parsed.error) };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl()}/auth/callback?next=/passwort/neu`,
  });
  // Immer dieselbe Antwort – verrät nicht, ob ein Konto existiert.
  return { ok: "Wenn ein Konto mit dieser Adresse existiert, haben wir einen Link zum Zurücksetzen gesendet." };
}

export async function updatePassword(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ password }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: first(parsed.error) };
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Das Passwort konnte nicht geändert werden. Bitte fordern Sie einen neuen Link an." };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createBusiness(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ name: z.string().trim().min(1, "Bitte den Firmennamen angeben.").max(120) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: first(parsed.error) };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_business", { p_name: parsed.data.name });
  if (error && error.code !== "23505") return { error: "Der Betrieb konnte nicht angelegt werden. Bitte erneut versuchen." };
  redirect("/dashboard");
}
