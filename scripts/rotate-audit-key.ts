/**
 * Moves the audit log from its old seal key to the new one, without losing the proof that it is intact.
 *
 *   1. checks every entry under the OLD key (any entry that does not match, and nothing is changed at all)
 *   2. re-seals the whole chain under the NEW key, in one all-or-nothing step
 *   3. adds one last entry saying the key was changed, so the change itself is on the record
 *
 * Run it (API stopped) after `pnpm secrets:set`:   pnpm audit:rotate-key
 * Reads AUDIT_SEAL_KEY (new) and AUDIT_SEAL_KEY_OLD (one or more old keys, comma separated) from .env.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { ChainRow, computeSeal, rechain } from "../apps/api/src/audit/audit-crypto";

if (existsSync(".env")) process.loadEnvFile(".env");
const newKey = process.env.AUDIT_SEAL_KEY ?? "";
const oldKeys = (process.env.AUDIT_SEAL_KEY_OLD ?? "").split(",").map((k) => k.trim()).filter(Boolean);
const fail = (m: string): never => { console.error(`\n${m}\n`); process.exit(1); };

async function main() {
  if (newKey.length < 32) fail("AUDIT_SEAL_KEY is missing or too short. Run `pnpm secrets:set` first.");
  if (!oldKeys.length) fail("AUDIT_SEAL_KEY_OLD is not set in .env, so there is nothing to change. (If you already ran this successfully, you are done.)");
  const prisma: any = new PrismaClient();
  try {
    const orgs: { organizationId: string }[] = await prisma.auditLog.findMany({ distinct: ["organizationId"], select: { organizationId: true } });
    const plan: { organizationId: string; updates: { id: string; prevHash: string; hash: string }[]; lastSeq: number; lastHash: string }[] = [];

    for (const { organizationId } of orgs) {
      const unsealed = await prisma.auditLog.count({ where: { organizationId, hash: null } });
      if (unsealed) fail(`${unsealed} audit entries are not sealed yet. Start the API once with your OLD settings so it seals them, then try again.`);
      const rows: ChainRow[] = await prisma.auditLog.findMany({ where: { organizationId }, orderBy: { seq: "asc" } });
      if (!rows.length) continue;
      const head = await prisma.auditChainHead.findUnique({ where: { organizationId } });
      let done = false, why = "";
      for (const oldKey of oldKeys) {
        const r = rechain(rows, oldKey, newKey);
        if (!r.ok) { why = r.problem; continue; }
        const last = rows[rows.length - 1];
        if (!head || head.seq !== last.seq || head.hash !== last.hash) { why = "the newest entry does not match the record the system kept of it (entries may have been removed)"; continue; }
        plan.push({ organizationId, updates: r.updates, lastSeq: r.lastSeq, lastHash: r.lastHash }); done = true; break;
      }
      if (!done) fail(`The audit log for organization ${organizationId} does NOT check out under the old key(s), because ${why}.\nNothing was changed. Do not force this: find out why first (the Change log screen shows what is wrong).`);
    }

    // every organization checked out; now change them all together, or not at all
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER USER`); // the read-only rule, lifted only inside this step
      for (const p of plan) {
        for (let i = 0; i < p.updates.length; i += 50) {
          await Promise.all(p.updates.slice(i, i + 50).map((u) => tx.auditLog.update({ where: { id: u.id }, data: { prevHash: u.prevHash, hash: u.hash, sealedAt: new Date() } })));
        }
        const now = new Date(), seq = p.lastSeq + 1;
        const entry = { seq, prevHash: p.lastHash, organizationId: p.organizationId, userName: "system", action: "SEAL KEY CHANGED", entityType: "Audit log", entityId: null, summary: "The audit seal key was changed. Every earlier entry was checked and re-sealed.", changes: null, createdAt: now };
        const hash = computeSeal(entry, newKey);
        const { changes: _none, ...data } = entry; // no `changes` column value: stored as empty, sealed as null (same as every other entry without changes)
        await tx.auditLog.create({ data: { ...data, hash, sealedAt: now } });
        await tx.auditChainHead.upsert({ where: { organizationId: p.organizationId }, create: { organizationId: p.organizationId, seq, hash }, update: { seq, hash } });
      }
      await tx.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER USER`);
    }, { timeout: 300_000, maxWait: 30_000 });

    const total = plan.reduce((t, p) => t + p.updates.length, 0);
    // the old key is no longer needed: take it out of .env
    if (existsSync(".env")) { const t = readFileSync(".env", "utf8"), eol = t.includes("\r\n") ? "\r\n" : "\n"; writeFileSync(".env", t.split(/\r?\n/).filter((l) => !/^\s*AUDIT_SEAL_KEY_OLD\s*=/.test(l)).join(eol)); }
    console.log(`\nDone. ${total} audit entr${total === 1 ? "y was" : "ies were"} checked and re-sealed under the new key, and one entry recording the change was added.\nThe old key was removed from .env. You can start the API now.\n`);
  } finally { await prisma.$disconnect(); }
}
main().catch((e) => { console.error("\nThe key change failed and nothing was changed:", e instanceof Error ? e.message : e, "\n"); process.exit(1); });
