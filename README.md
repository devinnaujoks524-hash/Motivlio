# Freigabeklar (Arbeitsname)

B2B-Web-App für Druck- und Motivfreigaben. Ein Veredelungsbetrieb lädt einen Entwurf hoch, ergänzt die
Produktionsangaben und sendet einen privaten Link. Der Kunde fordert Änderungen an oder gibt **genau diese
Version** frei – ohne Konto. Der Betrieb erhält ein Freigabeprotokoll als Produktionszettel (PDF).

Der Produktname steht zentral in `src/lib/config.ts` (`NEXT_PUBLIC_APP_NAME`).

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · Supabase (PostgreSQL, Auth, privater Storage) · Zod ·
Resend · Stripe (Checkout, Customer Portal, Webhooks). Alle Oberflächentexte sind Deutsch.

## Architektur in Kürze

- **Geschäftslogik in der Datenbank** (`supabase/migrations/0001_schema.sql`): Versand, Snapshot, Ersetzen,
  Entscheidung, Kontingent und Erinnerungs-Auswahl sind `security definer`-Funktionen mit Zeilensperren. Dadurch sind
  Doppelklicks, mehrere Tabs und parallele Anfragen serverseitig und transaktionssicher abgesichert.
- **Mandantentrennung**: RLS auf allen Tabellen (`app_owns_business`), zusammengesetzte Fremdschlüssel
  (`(customer_id, business_id)` …) verhindern mandantenübergreifende Verweise. Clients dürfen weder Status, Dateifelder
  noch Tokens direkt schreiben (Spalten-Grants).
- **Snapshots**: `order_versions` ist per Trigger unveränderlich (Angaben, Dateiverweis, SHA-256). Entscheidungen sind
  endgültig. Pro Auftrag gibt es höchstens eine offene Version (Unique-Index).
- **Freigabelinks**: 256-Bit-Zufall, nur der SHA-256-Hash dient der Suche. Zusätzlich liegt der Token
  AES-256-GCM-verschlüsselt (`LINK_ENCRYPTION_KEY`, nur auf dem Server) in der Datenbank, damit Erinnerungen und „Link
  erneut anzeigen“ funktionieren. Wer nur die Datenbank besitzt, kann keine Links bilden. Links sind widerrufbar und laufen
  ab (`SHARE_LINK_VALID_DAYS`). Öffentliche Seiten: `noindex`, `no-store`, `no-referrer`.
- **Dateien**: privater Bucket `drafts` ohne Client-Policies. Typprüfung am Dateiinhalt (Magic Bytes), max. 15 MB,
  SHA-256 beim Upload. Betrieb: kurzlebige signierte URL nach RLS-Prüfung. Kunde: Auslieferung über eine Server-Route, die
  den Link bei jedem Abruf neu prüft (so funktioniert auch die PDF-Vorschau im Browser).
- **Freigabe**: Name, Pflichtbestätigung (fester Text, serverseitig geprüft), Serverzeit und Versionsbezug werden
  gespeichert. Der Link ist ein Zugangsschlüssel, keine verifizierte Identität; das Protokoll sagt das auch.
- **E-Mails** sind idempotent (`claim_email` mit Dedupe-Key, z. B. `reminder:<version>:<n>`). Ein Versandfehler macht
  nie eine gespeicherte Entscheidung rückgängig.
- **Stripe**: Webhook mit Signaturprüfung; Zustand wird von Stripe abgerufen und zusammen mit der Event-ID in **einer**
  Transaktion gespeichert (`apply_subscription_event`) → Wiederholungen und veraltete Events sind wirkungslos.
  Maßgeblich ist der gespeicherte Abo-Status, nicht die Checkout-Rückleitung.

## Setup (lokal)

1. `npm install`
2. Supabase-Projekt anlegen (Entwicklungsprojekt!). Im SQL-Editor oder per `supabase db push` nacheinander ausführen:
   `supabase/migrations/0001_schema.sql`, `0002_storage.sql`.
3. Auth: unter *Authentication > URL Configuration* Site URL = `NEXT_PUBLIC_APP_URL` und Redirect-URL
   `…/auth/callback` eintragen. E-Mail-Texte (Bestätigung/Passwort-Reset) in Supabase auf Deutsch anpassen.
4. `.env.example` nach `.env.local` kopieren und ausfüllen (siehe Kommentare dort). Ohne Resend-Schlüssel kann lokal
   `EMAIL_DRIVER=console` gesetzt werden: Mails werden dann **nicht gesendet**, nur protokolliert; in Produktion wirkungslos.
5. `npm run dev`, Konto unter `/registrieren` anlegen, Betrieb anlegen. Zum Testen des Versands einen Tarif setzen: entweder
   Stripe (Testmodus) einrichten oder im Entwicklungsprojekt `supabase/seed.dev.sql` ausführen (nur Entwicklung!).
6. Stripe (Testmodus): zwei wiederkehrende Preise (29 € / 49 € netto, monatlich) anlegen, Preis-IDs eintragen;
   Webhook auf `/api/webhooks/stripe` mit den Events `checkout.session.completed`, `customer.subscription.created|updated|deleted`;
   lokal z. B. mit `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Customer Portal im Stripe-Dashboard aktivieren.

## Deployment (z. B. Vercel)

- Alle Variablen aus `.env.example` im Hosting setzen (Secrets nie mit `NEXT_PUBLIC_`).
- `vercel.json` ruft täglich `/api/cron/reminders` auf; Vercel sendet `Authorization: Bearer $CRON_SECRET`. Bei anderem
  Hosting einen täglichen Scheduler mit demselben Header einrichten. Wiederholte Läufe sind harmlos.
- Resend: Absenderdomain verifizieren (SPF/DKIM), `EMAIL_FROM` setzen.
- Stripe: Live-Schlüssel, Live-Preise und Live-Webhook-Secret getrennt von Test hinterlegen.

## Prüfung

```bash
npm run typecheck
npm run lint
npm test          # Datenbank- (PGlite = echtes PostgreSQL im Prozess) und Bibliothekstests
npm run build
```

### Getestete Abläufe (automatisiert)

| Anforderung | Test |
|---|---|
| Betrieb A sieht/ändert/versendet nichts von Betrieb B; kein mandantenübergreifender Kundenverweis | `tests/db.test.ts` – Mandantentrennung |
| Clients können Status, Dateifelder, Tokens nicht direkt setzen/lesen | dito |
| Link erschließt nur seine Version, ohne interne Notiz | dito |
| Ersetzte Version nicht freigebbar; alter Link zeigt „nicht mehr aktuell“ | dito |
| Freigabe bleibt am unveränderten Snapshot (Trigger blockiert Änderungen/Löschen) | dito |
| Doppelte/widersprüchliche Entscheidungen → genau eine | dito (sequenziell, siehe Grenzen) |
| Erinnerungen fällig → einmalig → stoppen nach Entscheidung | dito |
| Stripe-Event wirkt einmal, ältere Events überschreiben nichts | dito |
| Kontingent zählt nur beim Erstversand; Limit/kein Abo blockiert Versand | dito |
| Upload-Prüfung (Typ, Größe), Tokens, Verschlüsselung, Validierung, PDF-Erzeugung | `tests/lib.test.ts` |

### Nicht automatisch getestet / Grenzen der Prüfung

- **Ende-zu-Ende gegen echtes Supabase/Stripe/Resend wurde nicht ausgeführt** (keine Zugangsdaten in der Entwicklungsumgebung).
  Die Seiten und Server Actions sind typgeprüft, gelintet und bauen, wurden aber nicht im Browser gegen eine Live-Datenbank
  durchgeklickt. Der Smartphone-Ablauf (Punkt 8) ist per Layout (mobile-first, 44-px-Touchflächen) vorbereitet, aber **noch nicht
  auf einem Gerät geprüft**.
- Parallelität: PGlite arbeitet mit einer Verbindung. Die Absicherung beruht auf `FOR UPDATE`-Sperren und dem Unique-Index;
  ein echter Mehrverbindungs-Test steht aus.
- RLS wurde mit simulierter `auth.uid()`-Funktion getestet, nicht mit echten Supabase-JWTs.

## Bewusste Annahmen

- Ohne aktives Abo (`active`/`trialing`) kein Versand; Entwürfe sind immer möglich. Es gibt keinen kostenlosen Test-Tarif,
  weil keine Konditionen vorgegeben waren.
- Das Kontingent bezieht sich auf die Stripe-Abrechnungsperiode. Mit Abo-Wechsel gilt die neue Periode.
- Erinnerungen nach 2 und 5 Tagen (`due_reminders`); verpasst der Scheduler Tage, werden fällige Stufen nachgeholt.
- Ein Auftrag mit versendeten Versionen kann nur archiviert, nicht gelöscht werden.
- Erinnerung-Fehlversuche (`email_log.status = failed`) werden nicht automatisch wiederholt.

## Offene Produktionsvoraussetzungen

1. **Betreiberangaben und Rechtstexte** (Impressum, Datenschutzerklärung, AGB, AV-Vertrag) – bewusst nicht erfunden.
   Platzhalter-Seiten fehlen noch und müssen vor dem Livegang verlinkt werden (Footer, Registrierung).
2. **Lösch- und Aufbewahrungsregeln festlegen und umsetzen**: Aktuell werden Dateien und Freigabehistorie nicht automatisch
   gelöscht; versendete Dokumente bleiben unveränderlich erhalten. Es fehlen eine Kontolöschung inkl. Storage-Bereinigung und
   eine Frist für Altdaten. E-Mail-Log (`email_log`) enthält Empfängeradressen und braucht eine Aufbewahrungsfrist.
3. Ende-zu-Ende-Test mit echten Diensten (Supabase-Auth-Flows, Resend-Zustellung, Stripe-Checkout/Portal/Webhook).
4. Durchklick auf Smartphone (iOS Safari / Android Chrome), insbesondere PDF-Vorschau.
5. Deutsche Supabase-Auth-E-Mail-Vorlagen und SMTP-Absender für Auth-Mails konfigurieren.
6. Rate Limits sind datenbankbasiert (gehashte IP, kurzlebig) – für höheren Traffic einen vorgelagerten Schutz (WAF/CDN) ergänzen.
7. Monitoring/Alerting (Webhook-Fehler, fehlgeschlagene Mails), Backups und Wiederherstellungstest der Datenbank.
8. Optional später: Teamverwaltung, mehrere Ausführungen je Auftrag, konfigurierbare Erinnerungen.
