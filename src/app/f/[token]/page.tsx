import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell, DocumentPreview, SpecList } from "@/components/customer-view";
import { DecisionForm } from "@/components/decision-form";
import { Alert } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { rateLimit } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, isPlausibleToken } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Freigabe",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type PublicVersion = {
  state: "open" | "approved" | "changes_requested" | "superseded" | "unavailable" | "unknown";
  business_name?: string;
  business_logo_path?: string | null;
  order_number?: string;
  title?: string;
  version_number?: number;
  latest_version_number?: number;
  spec?: Record<string, string | number>;
  file_name?: string;
  file_mime?: string;
  decided_at?: string;
  decided_by_name?: string;
};

export default async function PublicApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isPlausibleToken(token)) notFound();
  if (!(await rateLimit("view", 120, 600, true))) {
    return <main className="mx-auto max-w-md flex-1 px-4 py-16"><Alert kind="error">Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.</Alert></main>;
  }
  const { data } = await createAdminClient().rpc("public_get_version", { p_token_hash: hashToken(token) });
  const v = data as PublicVersion | null;
  if (!v || v.state === "unknown") notFound();

  if (v.state === "unavailable") {
    return (
      <main className="mx-auto w-full max-w-md flex-1 space-y-3 px-4 py-16">
        <h1 className="text-xl font-semibold">Dieser Link ist nicht mehr gültig</h1>
        <p className="text-neutral-600">Der Link wurde ersetzt, widerrufen oder ist abgelaufen. Bitte wenden Sie sich an {v.business_name ?? "den Absender"}, um einen neuen Link zu erhalten.</p>
      </main>
    );
  }

  const logo = v.business_logo_path ? `/f/${token}/logo` : null;

  if (v.state === "superseded") {
    return (
      <CustomerShell businessName={v.business_name!} logoSrc={logo} title={v.title!} orderNumber={v.order_number!} versionNumber={v.version_number!}
        banner={
          <Alert kind="error">
            <strong>Diese Version ist nicht mehr aktuell.</strong> Es gibt inzwischen Version {v.latest_version_number}. Eine Freigabe ist über diesen Link nicht möglich –
            bitte verwenden Sie den Link zur neuesten Version oder fragen Sie bei {v.business_name} nach.
          </Alert>
        }
      >{null}</CustomerShell>
    );
  }

  return (
    <CustomerShell businessName={v.business_name!} logoSrc={logo} title={v.title!} orderNumber={v.order_number!} versionNumber={v.version_number!}
      banner={
        v.state === "approved" ? (
          <Alert kind="ok"><strong>Freigegeben.</strong> Version {v.version_number} wurde von {v.decided_by_name} am {formatDateTime(v.decided_at)} freigegeben.</Alert>
        ) : v.state === "changes_requested" ? (
          <Alert kind="info"><strong>Änderungen angefordert.</strong> Ihr Wunsch liegt bei {v.business_name} vor. Sie erhalten eine neue Version mit eigenem Link.</Alert>
        ) : undefined
      }
    >
      <DocumentPreview src={`/f/${token}/datei`} mime={v.file_mime!} name={v.file_name!} />
      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-1 font-semibold">Produktionsangaben</h2>
        <SpecList spec={v.spec!} />
      </section>
      {v.state === "open" && <DecisionForm token={token} />}
    </CustomerShell>
  );
}
