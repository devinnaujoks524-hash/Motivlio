import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { ActionForm } from "@/components/form";
import { Field, inputCls } from "@/components/ui";

export const metadata = { title: "Registrieren" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Konto erstellen</h1>
      <ActionForm action={signUp} submit="Konto erstellen">
        <Field label="E-Mail" htmlFor="email"><input id="email" name="email" type="email" autoComplete="email" required className={inputCls} /></Field>
        <Field label="Passwort" htmlFor="password" hint="Mindestens 10 Zeichen.">
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={inputCls} />
        </Field>
      </ActionForm>
      <p className="mt-6 text-sm text-neutral-600">Schon registriert? <Link className="underline" href="/login">Anmelden</Link></p>
    </>
  );
}
