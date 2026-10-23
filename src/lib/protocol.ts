import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { METHODS } from "@/lib/domain";

export type ProtocolData = {
  appName: string;
  businessName: string;
  customerCompany: string;
  contactName: string;
  orderNumber: string;
  title: string;
  versionNumber: number;
  spec: Record<string, unknown>;
  fileName: string;
  fileSha256: string;
  approvedBy: string;
  approvedAt: string; // bereits formatiert
  approvalText: string;
  comment?: string | null;
};

const clean = (s: string) => s.replace(/[^ -~ -ÿ„“”‚‘’–—€]/g, "?");

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const para of clean(text).split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) lines.push(line);
        // sehr lange Wörter (z. B. Prüfsumme) hart umbrechen
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width) {
          let n = rest.length;
          while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > width) n--;
          lines.push(rest.slice(0, n));
          rest = rest.slice(n);
        }
        line = rest;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function buildProtocolPdf(d: ProtocolData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  const margin = 50;
  const width = 595 - margin * 2;
  let y = 842 - margin;

  const ensure = (h: number) => {
    if (y - h < margin) {
      page = pdf.addPage([595, 842]);
      y = 842 - margin;
    }
  };
  const write = (text: string, size = 10.5, f = font, color = rgb(0.1, 0.1, 0.1)) => {
    for (const line of wrap(text, f, size, width)) {
      ensure(size + 4);
      page.drawText(line, { x: margin, y: y - size, size, font: f, color });
      y -= size + 4;
    }
  };
  const row = (label: string, value: string) => {
    ensure(18);
    page.drawText(clean(label), { x: margin, y: y - 10, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    const lines = wrap(value || "–", font, 10.5, width - 150);
    for (const line of lines) {
      ensure(15);
      page.drawText(line, { x: margin + 150, y: y - 10.5, size: 10.5, font });
      y -= 15;
    }
    if (lines.length === 0) y -= 15;
  };
  const section = (title: string) => {
    y -= 12;
    write(title, 12, bold);
    y -= 2;
  };

  write("Produktionszettel mit Freigabeprotokoll", 18, bold);
  write(`${d.businessName}`, 11, font, rgb(0.35, 0.35, 0.35));

  section("Auftrag");
  row("Betrieb", d.businessName);
  row("Kunde", `${d.customerCompany} (${d.contactName})`);
  row("Auftragsnummer", d.orderNumber);
  row("Titel", d.title);
  row("Freigegebene Version", `Version ${d.versionNumber}`);

  const s = d.spec as Record<string, string | number | undefined>;
  section("Produktionsangaben");
  row("Artikel", String(s.garment ?? ""));
  row("Kleidungsfarbe", String(s.garmentColor ?? ""));
  row("Verfahren", METHODS[s.method as keyof typeof METHODS] ?? String(s.method ?? ""));
  row("Motivposition", String(s.position ?? ""));
  row("Motivgröße", s.widthMm || s.heightMm ? `${s.widthMm ?? "?"} × ${s.heightMm ?? "?"} mm (B × H)` : "");
  row("Farben / Garn", String(s.colors ?? ""));
  row("Stückzahl", s.quantity ? String(s.quantity) : "");
  row("Hinweise für den Kunden", String(s.customerNote ?? ""));

  section("Freigabe");
  row("Freigegeben von", d.approvedBy);
  row("Zeitpunkt (Serverzeit)", d.approvedAt);
  row("Bestätigter Text", d.approvalText);
  if (d.comment) row("Anmerkung", d.comment);

  section("Freigegebenes Originaldokument");
  row("Dateiname", d.fileName);
  row("Prüfsumme (SHA-256)", d.fileSha256);

  y -= 16;
  write(
    "Die Freigabe wurde über einen privaten Link erteilt. Der Link ist ein Zugangsschlüssel und keine verifizierte Identität; " +
      "der angegebene Name wurde vom Freigebenden selbst eingetragen. Dieses Protokoll ist keine qualifizierte elektronische Signatur.",
    8.5,
    font,
    rgb(0.4, 0.4, 0.4),
  );
  write(`Erstellt mit ${d.appName}`, 8.5, font, rgb(0.4, 0.4, 0.4));
  return pdf.save();
}
