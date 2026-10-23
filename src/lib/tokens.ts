import { createHash, randomBytes } from "node:crypto";

/** 32 Byte Zufall = 256 Bit, URL-sicher. Der Klartext wird nie gespeichert. */
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isPlausibleToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
