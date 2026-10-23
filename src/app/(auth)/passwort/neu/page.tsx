import { updatePassword } from "@/app/actions/auth";
import { ActionForm } from "@/components/form";
import { Field, inputCls } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Neues Passwort" };

export default async function NewPasswordPage() {
  await requireUser(); // Der E-Mail-Link meldet kurz an; ohne Sitzung -> Login
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Neues Passwort festlegen</h1>
      <ActionForm action={updatePassword} submit="Passwort speichern">
        <Field label="Neues Passwort" htmlFor="password" hint="Mindestens 10 Zeichen.">
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={inputCls} />
        </Field>
      </ActionForm>
    </>
  );
}
