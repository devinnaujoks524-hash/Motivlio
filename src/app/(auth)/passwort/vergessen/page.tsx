import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { ActionForm } from "@/components/form";
import { Field, inputCls } from "@/components/ui";

export const metadata = { title: "Passwort zurücksetzen" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">Passwort zurücksetzen</h1>
      <p className="mb-6 text-sm text-neutral-600">Wir senden Ihnen einen Link, mit dem Sie ein neues Passwort festlegen können.</p>
      <ActionForm action={requestPasswordReset} submit="Link senden">
        <Field label="E-Mail" htmlFor="email"><input id="email" name="email" type="email" autoComplete="email" required className={inputCls} /></Field>
      </ActionForm>
      <p className="mt-6 text-sm"><Link className="underline" href="/login">Zurück zur Anmeldung</Link></p>
    </>
  );
}
