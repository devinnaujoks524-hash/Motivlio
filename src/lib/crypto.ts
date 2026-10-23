import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const raw = process.env.LINK_ENCRYPTION_KEY;
  if (!raw) throw new Error("LINK_ENCRYPTION_KEY fehlt (siehe .env.example)");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("LINK_ENCRYPTION_KEY muss 32 Byte (base64) lang sein");
  return buf;
}

/** AES-256-GCM. Format: iv.tag.ciphertext (base64url). */
export function encryptToken(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(blob: string) {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
