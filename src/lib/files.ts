import { createHash, randomUUID } from "node:crypto";
import { MAX_FILE_BYTES } from "@/lib/config";

export type DetectedFile = { mime: "application/pdf" | "image/png" | "image/jpeg"; ext: "pdf" | "png" | "jpg" };

/** Erkennt den Typ am Dateiinhalt (Magic Bytes) – der Browser-Typ und die Endung zählen nicht. */
export function detectFileType(bytes: Uint8Array): DetectedFile | null {
  const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" };
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (startsWith([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  return null;
}

export type FileCheck =
  | { ok: true; file: DetectedFile; sha256: string; size: number }
  | { ok: false; error: string };

export function checkUpload(bytes: Uint8Array): FileCheck {
  if (bytes.byteLength === 0) return { ok: false, error: "Die Datei ist leer." };
  if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, error: "Die Datei ist größer als 15 MB." };
  const file = detectFileType(bytes);
  if (!file) return { ok: false, error: "Erlaubt sind nur PDF-, PNG- und JPG-Dateien." };
  return { ok: true, file, size: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** Speicherpfad: {betrieb}/{auftrag}/{zufall}.{ext} – das Präfix wird auch von der Datenbank geprüft. */
export function storagePath(businessId: string, orderId: string, ext: string) {
  return `${businessId}/${orderId}/${randomUUID()}.${ext}`;
}

export function safeFileName(name: string) {
  return name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "datei";
}
