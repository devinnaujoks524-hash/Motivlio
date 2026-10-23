import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">{APP_NAME}</Link>
      <div className="rounded-xl border border-line bg-white p-6 sm:p-8">{children}</div>
      <p className="mt-6 text-center text-xs text-neutral-500"><Link href="/impressum" className="underline">Impressum</Link> · <Link href="/datenschutz" className="underline">Datenschutz</Link></p>
    </main>
  );
}
