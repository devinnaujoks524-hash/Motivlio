import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Business = {
  id: string;
  name: string;
  reply_to_email: string | null;
  logo_path: string | null;
};

/** Angemeldeter Nutzer samt Betrieb. Ohne Anmeldung -> Login, ohne Betrieb -> Willkommen. */
export async function requireBusiness() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, reply_to_email, logo_path")
    .maybeSingle<Business>();
  if (!business) redirect("/willkommen");
  return { supabase, user: data.user, business };
}

export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}
