import { createHmac } from "crypto";

/**
 * The sealing maths, kept free of framework code so the key-change script can use it on its own.
 * Seal = HMAC-SHA256 over an entry's own content and the seal of the entry before it.
 */

export const GENESIS = "GENESIS";

export interface SealInput {
  seq: number; prevHash: string; organizationId: string; userName: string | null; action: string;
  entityType: string; entityId: string | null; summary: string; changes: unknown; createdAt: Date;
}

/** JSON with keys in a fixed order, so the same content always produces the same text however the database returns it. */
export function stable(v: unknown): string {
  if (v === undefined || v === null) return "null";
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export function sealKey(): string {
  return process.env.AUDIT_SEAL_KEY || process.env.JWT_SECRET || "development-secret";
}

export function computeSeal(e: SealInput, key = sealKey()): string {
  const text = stable([e.seq, e.prevHash, e.organizationId, e.userName, e.action, e.entityType, e.entityId, e.summary, e.changes ?? null, e.createdAt.toISOString()]);
  return createHmac("sha256", key).update(text).digest("hex");
}

/** A short code a person can write down or photograph: 12 characters of the seal, in groups of four. */
export const fingerprint = (hash: string) => (hash.slice(0, 12).toUpperCase().match(/.{4}/g) ?? []).join("-");

export interface ChainRow extends SealInput { id: string; hash: string | null }

/**
 * Checks one organization's sealed entries (oldest first) under `oldKey` and, only if every seal is intact, works out the same chain sealed under `newKey`.
 * Nothing is written here. A log that does not verify is never re-sealed, so a key change cannot be used to launder tampering.
 */
export function rechain(rows: ChainRow[], oldKey: string, newKey: string): { ok: true; updates: { id: string; prevHash: string; hash: string }[]; lastSeq: number; lastHash: string } | { ok: false; problem: string } {
  let prevOld = GENESIS, prevNew = GENESIS, expect = 1;
  const updates: { id: string; prevHash: string; hash: string }[] = [];
  for (const r of rows) {
    if (r.seq !== expect) return { ok: false, problem: `entry #${expect} is missing or out of order` };
    if (r.prevHash !== prevOld) return { ok: false, problem: `entry #${r.seq} is not linked to the one before it` };
    if (computeSeal({ ...r, prevHash: prevOld }, oldKey) !== r.hash) return { ok: false, problem: `entry #${r.seq} does not match its seal under the old key` };
    const hash = computeSeal({ ...r, prevHash: prevNew }, newKey);
    updates.push({ id: r.id, prevHash: prevNew, hash });
    prevOld = r.hash as string; prevNew = hash; expect++;
  }
  return { ok: true, updates, lastSeq: expect - 1, lastHash: prevNew };
}
