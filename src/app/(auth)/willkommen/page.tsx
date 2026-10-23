import { redirect } from "next/navigation";
import { createBusiness } from "@/app/actions/auth";
import { ActionForm } from "@/components/form";
import { Field, inputCls } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Willkommen" };

export default async function WelcomePage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("businesses").select("id").maybeSingle();
  if (data) redirect("/dashboard");
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">Willkommen!</h1>
      <p className="mb-6 text-sm text-neutral-600">Wie heißt Ihr Betrieb? Der Name erscheint in der Kundenansicht und in E-Mails.</p>
      <ActionForm action={createBusiness} submit="Weiter">
        <Field label="Firmenname" htmlFor="name"><input id="name" name="name" required maxLength={120} className={inputCls} /></Field>
      </ActionForm>
    </>
  );
}
