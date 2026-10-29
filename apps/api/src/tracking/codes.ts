import { randomInt } from "node:crypto";

/** Letters and digits that cannot be mistaken for each other when read off a label (no 0/O, 1/I/L). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** A new item label code: "W" + 9 characters, e.g. W7K3F9Q2M. About 26 trillion possibilities, so collisions are practically impossible
 *  (and the database refuses a repeat anyway). Short enough for a 1D barcode that cheap USB scanners read. */
export function newItemCode(): string {
  let s = "W";
  for (let i = 0; i < 9; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** True when a scanned code has the shape of a WHOLESTRA item label. */
export const looksLikeItemCode = (c: string) => /^W[2-9A-HJKMNP-Z]{9}$/.test(c);

/** Cleans a list of scanned codes: trimmed, upper-case for item labels, no blanks. Repeats are kept so they can be refused. */
export const cleanCodes = (codes: string[] | undefined) => (codes ?? []).map((c) => c.trim()).filter(Boolean).map((c) => (/^w/i.test(c) && c.length === 10 ? c.toUpperCase() : c));
