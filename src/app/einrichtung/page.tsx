import { redirect } from "next/navigation";

export const metadata = { title: "Einrichtung" };

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_URL", "LINK_ENCRYPTION_KEY"];

export default function SetupPage() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length === 0) redirect("/dashboard");
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">Einrichtung fehlt noch</h1>
      <p className="text-neutral-700">
        Die App läuft, braucht aber noch Zugangsdaten. Trage in <code>.env.local</code> die folgenden Werte ein und starte
        <code> npm run dev</code> neu:
      </p>
      <ul className="list-disc space-y-1 pl-6 font-mono text-sm">{missing.map((k) => <li key={k}>{k}</li>)}</ul>
      <p className="text-sm text-neutral-600">
        Die Supabase-Werte findest du im Supabase-Projekt unter „Project Settings → API“. Danach die SQL-Dateien aus
        <code> supabase/migrations</code> im SQL-Editor ausführen. Details stehen in der README.
      </p>
    </main>
  );
}
