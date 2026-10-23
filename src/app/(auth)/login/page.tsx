import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { ActionForm } from "@/components/form";
import { Alert, Field, inputCls } from "@/components/ui";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Anmelden</h1>
      {fehler === "link" && (
        <div className="mb-4"><Alert kind="error">Der Link ist abgelaufen oder ungültig. Bitte melden Sie sich an oder fordern Sie einen neuen Link an.</Alert></div>
      )}
      <ActionForm action={signIn} submit="Anmelden">
        <Field label="E-Mail" htmlFor="email"><input id="email" name="email" type="email" autoComplete="email" required className={inputCls} /></Field>
        <Field label="Passwort" htmlFor="password"><input id="password" name="password" type="password" autoComplete="current-password" required className={inputCls} /></Field>
      </ActionForm>
      <div className="mt-6 space-y-1 text-sm text-neutral-600">
        <p><Link className="underline" href="/passwort/vergessen">Passwort vergessen?</Link></p>
        <p>Noch kein Konto? <Link className="underline" href="/registrieren">Jetzt registrieren</Link></p>
      </div>
    </>
  );
}
