import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/config";
import { requireBusiness } from "@/lib/session";

const NAV = [
  { href: "/dashboard", label: "Heute" },
  { href: "/auftraege", label: "Aufträge" },
  { href: "/kunden", label: "Kunden" },
  { href: "/abrechnung", label: "Abrechnung" },
  { href: "/einstellungen", label: "Einstellungen" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { business } = await requireBusiness();
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">{APP_NAME}</Link>
          <div className="flex items-center gap-3 text-sm text-neutral-600">
            <span className="hidden sm:inline">{business.name}</span>
            <form action={signOut}><button className="min-h-11 rounded-lg px-2 underline">Abmelden</button></form>
          </div>
        </div>
        <nav aria-label="Hauptnavigation" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
