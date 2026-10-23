import Link from "next/link";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui";
import { APP_NAME } from "@/lib/config";
import { legalFields } from "@/lib/legal";

export const metadata = { title: "Datenschutz", robots: { index: true, follow: true } };
export const dynamic = "force-dynamic";

const env = (k: string) => process.env[k]?.trim() || null;

function Todo({ children }: { children?: ReactNode }) {
  return <span className="rounded bg-red-50 px-1 text-red-700">{children ?? "noch nicht eingetragen"}</span>;
}
function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 text-lg font-semibold">{children}</h2>;
}

export default function PrivacyPage() {
  const f = Object.fromEntries(legalFields().map((x) => [x.label, x.value]));
  const hosting = env("PRIVACY_HOSTING");
  const region = env("PRIVACY_DB_REGION");
  const retention = env("PRIVACY_RETENTION");
  const missing = [
    !f["Name / Firma"] && "Betreiberangaben (LEGAL_*)",
    !hosting && "Hosting-Anbieter (PRIVACY_HOSTING)",
    !region && "Datenbank-Region (PRIVACY_DB_REGION)",
    !retention && "Speicherdauer (PRIVACY_RETENTION)",
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-4 py-12 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>
      {missing.length > 0 && (
        <Alert kind="error">Noch nicht vollständig. Es fehlen: {missing.join(", ")}. Vor dem Livegang ergänzen.</Alert>
      )}

      <H>1. Verantwortlicher und Rollen</H>
      <p className="whitespace-pre-line">
        {f["Name / Firma"] ?? <Todo />}
        {"\n"}{f["Anschrift"] ?? <Todo />}
        {"\n"}E-Mail: {f["E-Mail"] ?? <Todo />}
      </p>
      <p>
        {APP_NAME} ist eine Web-Anwendung, mit der Betriebe Entwürfe zur Freigabe an ihre Kunden senden. Wir sind
        <strong> Verantwortlicher</strong> für die Daten der Nutzer (Betriebe mit Konto) sowie für technische Verbindungsdaten
        und den Missbrauchsschutz. Die Daten der Kunden eines Betriebs und der <strong>Freigebenden</strong> (Personen, die einen
        privaten Freigabelink öffnen) verarbeiten wir als <strong>Auftragsverarbeiter</strong> im Auftrag des jeweiligen Betriebs;
        dieser ist dafür verantwortlich. Einen Datenschutzbeauftragten haben wir nicht benannt.
      </p>

      <H>2. Hosting und Server-Protokolle</H>
      <p>
        Die Anwendung wird bei {hosting ?? <Todo>Hosting-Anbieter noch nicht festgelegt</Todo>} betrieben. Beim Aufruf der Seiten
        verarbeitet der Hosting-Anbieter technisch notwendige Verbindungsdaten (z. B. IP-Adresse, Zeitpunkt, aufgerufene Adresse),
        um die Seiten auszuliefern und den Betrieb zu sichern (Art. 6 Abs. 1 lit. f DSGVO). Wir werten diese Daten nicht aus.
      </p>

      <H>3. Konto und Betriebsdaten (Nutzer)</H>
      <p>
        Für das Konto verarbeiten wir E-Mail-Adresse und Passwort (nur als Hash) sowie Firmenname, Antwortadresse und Logo des
        Betriebs. Der Betrieb speichert außerdem Kunden (Firma, Ansprechpartner, E-Mail), Aufträge, Produktionsangaben,
        Entwurfsdokumente, Freigabeentscheidungen und einen Aktivitätsverlauf. Rechtsgrundlage ist die Vertragserfüllung
        (Art. 6 Abs. 1 lit. b DSGVO). Die Bereitstellung der Kontodaten ist für die Nutzung erforderlich; ohne sie können wir den Dienst
        nicht erbringen. Kontobestätigungen und Passwort-Links werden über unseren Authentifizierungsdienst per E-Mail versendet.
      </p>

      <H>4. Freigabeseite (Freigebende)</H>
      <p>
        Wer einen privaten Freigabelink öffnet, sieht den Entwurf und die Produktionsangaben. Bei einer Entscheidung speichern wir
        im Auftrag des Betriebs den eingegebenen Namen, einen optionalen Kommentar, den Zeitpunkt (Serverzeit) und die Version, auf die
        sich die Entscheidung bezieht. Der Link ist ein Zugangsschlüssel und keine geprüfte Identität. Rechtsgrundlage des Betriebs ist
        die Durchführung bzw. Anbahnung des Vertrags und sein berechtigtes Interesse an einer nachvollziehbaren Dokumentation
        (Art. 6 Abs. 1 lit. b und f DSGVO). Die Angabe des Namens ist für eine Freigabe erforderlich; ohne sie ist keine Freigabe möglich.
        Bei Fragen zu Ihren Daten wenden Sie sich bitte zuerst an den Betrieb, der Ihnen den Link geschickt hat. Die Freigabeseite
        setzt keine Cookies und enthält kein Tracking.
      </p>

      <H>5. Schutz vor Missbrauch</H>
      <p>
        Zum Schutz vor übermäßigen Abrufen speichern wir die IP-Adresse nicht im Klartext, sondern nur als gesalzenen Hash in
        kurzlebigen Zählern, die nach einem Tag gelöscht werden (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <H>6. Empfänger und Dienstleister</H>
      <ul className="list-disc space-y-2 pl-6">
        <li><strong>Datenbank, Anmeldung, Dateispeicher:</strong> Supabase (Region der Daten: {region ?? <Todo>noch nicht festgelegt</Todo>}).</li>
        <li><strong>Hosting:</strong> {hosting ?? <Todo />}.</li>
        <li><strong>E-Mail-Versand</strong> (Einladungen, Erinnerungen, Bestätigungen): Resend. Verarbeitet werden Empfängeradresse, Betreff und Inhalt.</li>
        <li>
          <strong>Zahlungsabwicklung:</strong> Stripe. Zahlungsdaten geben Sie direkt bei Stripe ein; wir erhalten Abo-Status, Tarif
          und Abrechnungszeitraum. Stripe verarbeitet Daten teils in unserem Auftrag, teils als eigener Verantwortlicher (z. B.
          Betrugsprävention); dazu gilt die Datenschutzerklärung von Stripe (Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO).
        </li>
      </ul>
      <p>
        Mit den Dienstleistern bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO. Einige von ihnen haben ihren Sitz in den
        USA oder können im Drittland auf Daten zugreifen. Die Übermittlung stützen wir auf die Standardvertragsklauseln der
        EU-Kommission (Beschluss (EU) 2021/914) und, soweit der Anbieter zertifiziert ist, auf den Angemessenheitsbeschluss zum
        EU-US Data Privacy Framework (Art. 45, 46 DSGVO). Eine Kopie der Garantien erhalten Sie auf Anfrage unter der oben genannten
        E-Mail-Adresse.
      </p>

      <H>7. Cookies</H>
      <p>
        Im Betriebsbereich verwenden wir ausschließlich technisch unbedingt erforderliche Cookies für die Anmeldung (Sitzung). Dafür
        ist nach § 25 Abs. 2 Nr. 2 TDDDG keine Einwilligung nötig. Tracking- oder Werbe-Cookies setzen wir nicht ein.
      </p>

      <H>8. Speicherdauer</H>
      <p>{retention ?? <Todo>Speicher- und Löschfristen noch nicht festgelegt</Todo>}</p>

      <H>9. Ihre Rechte</H>
      <p>
        Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung
        (Art. 18) und Datenübertragbarkeit (Art. 20). <strong>Widerspruchsrecht (Art. 21):</strong> Soweit wir Daten auf Grundlage
        berechtigter Interessen verarbeiten (Art. 6 Abs. 1 lit. f DSGVO), können Sie aus Gründen, die sich aus Ihrer besonderen Situation
        ergeben, jederzeit widersprechen. Wenden Sie sich dafür an die oben genannte E-Mail-Adresse. Sie können sich außerdem bei einer
        Datenschutz-Aufsichtsbehörde beschweren, z. B. bei der Berliner Beauftragten für Datenschutz und Informationsfreiheit.
        Eine automatisierte Entscheidungsfindung einschließlich Profiling findet nicht statt.
      </p>

      <p className="pt-6"><Link href="/impressum" className="underline">Impressum</Link> · <Link href="/" className="underline">Zurück</Link></p>
    </main>
  );
}
