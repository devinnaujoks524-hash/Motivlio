# Prüfnotiz Impressum, Datenschutz, AVV (Stand 23.10.2026)

Keine Rechtsberatung. Interne Prüfung der Entwürfe gegen Gesetzestexte und Anbieterverträge; vor Livegang anwaltlich gegenlesen lassen.

## Quellen

- Art. 28 DSGVO (Pflichtinhalte Abs. 3 lit. a–h, Unterauftragsverarbeiter Abs. 2 und 4, Form Abs. 9): <https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679>
- § 5 DDG (Anbieterkennzeichnung): <https://www.gesetze-im-internet.de/ddg/__5.html>
- Supabase DPA: <https://supabase.com/legal/customer-resources/data-processing-addendum>, Subprozessoren: <https://supabase.com/legal/customer-resources/subprocessor-list>
- Vercel DPA: <https://vercel.com/legal/dpa>
- Resend DPA: <https://resend.com/legal/dpa>, Subprozessoren: <https://resend.com/legal/subprocessors>
- Stripe DPA: <https://stripe.com/de/legal/dpa>
- Verfahrensstand EU-US Data Privacy Framework (Latombe, Rechtsmittel C-703/25 P): <https://digitalpolicyalert.org/event/35459>; offizielle Akte: curia.europa.eu

## Gefundene Mängel im ersten Entwurf und Korrektur

| # | Befund | Korrektur |
|---|---|---|
| 1 | Stripe stand als Unterauftragsverarbeiter im AVV. Stripe bekommt aber keine Kundendaten der Betriebe, sondern nur die Zahlungsdaten des Betriebs; teils Auftragsverarbeiter, teils eigener Verantwortlicher. | Aus der AVV-Liste entfernt, in der Datenschutzerklärung als eigene Rolle beschrieben. |
| 2 | AVV nannte „Beschäftigte des Auftraggebers“ als Betroffene. Deren Kontodaten verarbeitet NOVALUS aber als eigener Verantwortlicher, nicht im Auftrag. | Abgrenzung in AVV Abschnitt 2 ergänzt. |
| 3 | Zusage von 30 Tagen Vorankündigung für Unterauftragsverarbeiter war nicht einhaltbar: Resend kündigt mit 14 Tagen an, Vercel mit 5 Tagen Widerspruchsfrist. | Auf 14 Tage gesenkt (Back-to-back mit den Vorlieferanten). |
| 4 | Zusage einer festen 48-Stunden-Meldung bei Datenpannen; Vorlieferanten melden nur „ohne unangemessene Verzögerung“ (Supabase: möglichst 48 h). | Auf „unverzüglich“ (Art. 33 Abs. 2 DSGVO) geändert. |
| 5 | Art. 28 Abs. 3 lit. a verlangt Weisungsbindung auch für Drittlandübermittlungen; fehlte. Art. 28 Abs. 4 (Haftung für Unterauftragsverarbeiter) fehlte. | Beides ergänzt. |
| 6 | Rechtsträger falsch bzw. offen: Supabase-DPA nennt Supabase Pte. Ltd. (Singapur); Resend ist „Plus Five Five, Inc.“ (San Francisco); Vercel Inc. | In Anlage 2 eingetragen. |
| 7 | Datenschutzerklärung: Rollen unklar (Freigebende-Daten verantwortet der Betrieb, nicht NOVALUS). Fehlten: Hinweis auf Bereitstellungspflicht (Art. 13 Abs. 2 lit. e), automatisierte Entscheidung (lit. f), Garantien und Kopie bei Drittland (Art. 13 Abs. 1 lit. f), ausdrücklicher Widerspruchshinweis (Art. 21 Abs. 4), Rechtsgrundlage Cookies (§ 25 Abs. 2 Nr. 2 TDDDG). | Alles ergänzt. |
| 8 | Impressum: Für ein nicht eingetragenes Einzelunternehmen ist der Vor- und Nachname des Inhabers anzugeben; „NOVALUS Studios“ allein reicht nicht. „Vertretungsberechtigte“ gilt nur für juristische Personen. | Name jetzt „NOVALUS Studios, Inhaber: Devin Gene Naujoks“. |

## Noch offen (nicht durch Texte lösbar)

1. **Vercel-Plan:** Das Vercel-DPA gilt laut Vertrag nur für Pro- und Enterprise-Kunden, nicht für den Hobby-Plan. Hobby ist zudem für nicht-kommerzielle Nutzung gedacht. Für den Echtbetrieb braucht es Pro.
2. **Region der Funktionen:** Vercel-Funktionen laufen standardmäßig nicht zwingend in der EU. `vercel.json` setzt jetzt `regions: ["dub1"]` (Dublin); nach dem Deployment in den Projekteinstellungen prüfen.
3. **DPAs aktiv abschließen bzw. bestätigen:** Supabase (Teil der Nutzungsbedingungen, Subprozessor-Benachrichtigung abonnieren), Vercel (Pro/Enterprise), Resend (DPA auf resend.com/legal/dpa), Stripe (durch Vereinbarung eingebunden).
4. **Telefon im Impressum:** § 5 Abs. 1 Nr. 2 DDG verlangt schnelle elektronische Kontaktaufnahme und unmittelbare Kommunikation, „insbesondere E-Mail“. Nach der bisherigen EuGH-Rechtsprechung (C-298/07) war neben der E-Mail ein zweiter schneller Weg nötig (Telefon oder Kontaktformular mit schneller Antwort). Eine Telefonnummer ist die sicherste Variante.
5. **Datenschutz-Folgenabschätzung, Verzeichnis der Verarbeitungstätigkeiten (Art. 30):** nicht erstellt; bei diesem Umfang wahrscheinlich keine DSFA nötig, ein Verzeichnis aber schon.
6. **DPF-Rechtsmittel:** Der Angemessenheitsbeschluss gilt, ist aber unter Rechtsmittel (C-703/25 P). Deshalb stützen wir die Übermittlungen zusätzlich auf Standardvertragsklauseln.
7. **Backups und Betriebssicherheit:** Der kostenlose Supabase-Tarif bietet nach meinem Kenntnisstand keine regulären Backups; dies vor dem Echtbetrieb prüfen und in Anlage 1 des AVV eintragen. MFA für Dashboard-Zugänge aktivieren.
8. **Löschfristen:** Rechtlich zu klären (z. B. handels- und steuerrechtliche Aufbewahrung bei eigenen Abrechnungsdaten); technisch fehlt noch eine automatische Konto- und Datenlöschung.
