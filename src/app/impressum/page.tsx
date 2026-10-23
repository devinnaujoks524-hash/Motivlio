import Link from "next/link";
import { Alert } from "@/components/ui";
import { legalComplete, legalFields } from "@/lib/legal";

export const metadata = { title: "Impressum", robots: { index: true, follow: true } };
export const dynamic = "force-dynamic";

export default function ImpressumPage() {
  const fields = legalFields();
  const complete = legalComplete();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Impressum</h1>
      {!complete && (
        <Alert kind="error">
          Die Betreiberangaben sind noch nicht vollständig eingetragen (Umgebungsvariablen <code>LEGAL_*</code>). Vor dem Livegang ausfüllen.
        </Alert>
      )}
      <dl className="divide-y divide-line rounded-xl border border-line bg-white">
        {fields.map((f) => {
          if (!f.value && !f.required) return null;
          return (
            <div key={f.label} className="grid gap-1 px-5 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="text-sm text-neutral-500">{f.label}</dt>
              <dd className="whitespace-pre-line text-sm font-medium">
                {f.value ?? <span className="text-red-700">noch nicht eingetragen</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      <p><Link href="/" className="text-sm underline">Zurück</Link></p>
    </main>
  );
}
