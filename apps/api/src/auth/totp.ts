import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

/**
 * Authenticator-app codes (RFC 6238, the kind Google Authenticator, Microsoft Authenticator and Authy make) and the small helpers around them.
 * Everything here is pure, so it can be tested without a database.
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("Not a valid authenticator key");
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** A new secret: 160 random bits, written in base32 so it can be typed or scanned. */
export function generateSecret(bytes = 20): string { return base32Encode(randomBytes(bytes)); }

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const h = createHmac("sha1", secret).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, "0");
}

export const STEP_SECONDS = 30;
export function stepAt(atMs: number, step = STEP_SECONDS): number { return Math.floor(atMs / 1000 / step); }
export function totp(secretB32: string, atMs = Date.now(), digits = 6): string { return hotp(base32Decode(secretB32), stepAt(atMs), digits); }

const eq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

/** Accepts the code for this 30-second step and the one either side of it (phone clocks drift). Returns the step that matched, or null. */
export function verifyTotp(secretB32: string, code: string, atMs = Date.now(), window = 1): number | null {
  const clean = String(code).replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const secret = base32Decode(secretB32), now = stepAt(atMs);
  for (let d = -window; d <= window; d++) if (eq(hotp(secret, now + d), clean)) return now + d;
  return null;
}

export function otpauthUri(o: { secret: string; account: string; issuer: string }): string {
  const label = `${encodeURIComponent(o.issuer)}:${encodeURIComponent(o.account)}`;
  return `otpauth://totp/${label}?secret=${o.secret}&issuer=${encodeURIComponent(o.issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

// ---- keeping the secret safe in the database: AES-256-GCM with a key that lives on the server, not in the database
export function keyFrom(secret: string, label: string): Buffer { return createHash("sha256").update(`${label}:${secret}`).digest(); }
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
export function decryptSecret(blob: string, key: Buffer): string {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// ---- one-time recovery codes, for a lost phone. Only their fingerprints are stored.
const RC = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alike letters
export function generateRecoveryCodes(n = 8): string[] {
  return Array.from({ length: n }, () => { const s = Array.from({ length: 10 }, () => RC[randomInt(RC.length)]).join(""); return `${s.slice(0, 5)}-${s.slice(5)}`; });
}
export const normaliseRecovery = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, "");
export const hashRecovery = (c: string) => createHash("sha256").update(normaliseRecovery(c)).digest("hex");
