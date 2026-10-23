import { beforeAll, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { decisionSchema, friendlyDbError, specSchema } from "@/lib/domain";
import { checkUpload, detectFileType } from "@/lib/files";
import { buildProtocolPdf } from "@/lib/protocol";
import { generateToken, hashToken, isPlausibleToken } from "@/lib/tokens";

describe("Tokens", () => {
  it("sind lang, eindeutig und URL-sicher; Hash ist stabil", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(isPlausibleToken(a)).toBe(true);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(isPlausibleToken("zu-kurz")).toBe(false);
  });
});

describe("Verschlüsselung", () => {
  beforeAll(() => {
    process.env.LINK_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });
  it("Rundlauf und Manipulationserkennung", () => {
    const t = generateToken();
    const enc = encryptToken(t);
    expect(enc).not.toContain(t);
    expect(decryptToken(enc)).toBe(t);
    const [iv, tag, data] = enc.split(".");
    const tampered = [iv, tag, Buffer.from("x" + data).toString("base64url")].join(".");
    expect(() => decryptToken(tampered)).toThrow();
  });
});

describe("Datei-Upload-Prüfung", () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  it("erkennt Typen am Inhalt", () => {
    expect(detectFileType(pdf)?.mime).toBe("application/pdf");
    expect(detectFileType(png)?.mime).toBe("image/png");
    expect(detectFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
  });
  it("lehnt HTML/SVG/leer/zu groß ab", () => {
    expect(checkUpload(new TextEncoder().encode("<html><script>alert(1)</script>")).ok).toBe(false);
    expect(checkUpload(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")).ok).toBe(false);
    expect(checkUpload(new Uint8Array(0)).ok).toBe(false);
    const big = new Uint8Array(15 * 1024 * 1024 + 1);
    big.set(pdf);
    expect(checkUpload(big).ok).toBe(false);
  });
  it("berechnet die Prüfsumme", () => {
    const r = checkUpload(pdf);
    expect(r.ok && r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Validierung", () => {
  it("Spec: Pflichtfelder, Dezimalkomma, leere Zahlen", () => {
    const ok = specSchema.safeParse({ garment: "Polo", method: "stick", position: "Brust links", widthMm: "80,5", heightMm: "", quantity: "20" });
    expect(ok.success && ok.data.widthMm).toBe(80.5);
    expect(ok.success && ok.data.heightMm).toBeUndefined();
    expect(specSchema.safeParse({ garment: "", method: "stick", position: "x" }).success).toBe(false);
    expect(specSchema.safeParse({ garment: "a", method: "laser", position: "x" }).success).toBe(false);
  });
  it("Freigabe verlangt Name und Bestätigung; Änderungswunsch einen Kommentar", () => {
    expect(decisionSchema.safeParse({ decision: "approve", name: "Anna Beispiel" }).success).toBe(false);
    expect(decisionSchema.safeParse({ decision: "approve", name: "A", confirmed: "on" }).success).toBe(false);
    expect(decisionSchema.safeParse({ decision: "approve", name: "Anna Beispiel", confirmed: "on" }).success).toBe(true);
    expect(decisionSchema.safeParse({ decision: "request_changes", comment: "  " }).success).toBe(false);
    expect(decisionSchema.safeParse({ decision: "request_changes", comment: "Logo größer" }).success).toBe(true);
  });
  it("Datenbankfehler werden verständlich übersetzt", () => {
    expect(friendlyDbError("limit_reached")).toMatch(/Kontingent/);
    expect(friendlyDbError("irgendwas")).toMatch(/nicht geklappt/);
  });
});

describe("Produktionszettel", () => {
  it("erzeugt ein PDF mit Sonderzeichen", async () => {
    const pdf = await buildProtocolPdf({
      appName: "Freigabeklar", businessName: "Stickerei Müller", customerCompany: "Bau GmbH", contactName: "Anna",
      orderNumber: "A-1", title: "Polo – Logo „Brust“ 😀", versionNumber: 2,
      spec: { garment: "Poloshirt", method: "stick", position: "Brust links", widthMm: 80, heightMm: 40 },
      fileName: "logo.pdf", fileSha256: "a".repeat(64), approvedBy: "Anna Beispiel", approvedAt: "23.10.2026, 12:00",
      approvalText: "Ich habe geprüft.", comment: null,
    });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
