import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GENESIS, computeSeal, fingerprint } from "./audit-crypto";
export * from "./audit-crypto";

/**
 * Tamper-evident audit log.
 * Every entry gets a number and a seal. The seal is a keyed fingerprint (HMAC-SHA256) of the entry's own content AND the seal of the entry before it,
 * so changing, removing, inserting or reordering any entry breaks that seal and every one after it. The key lives on the server, not in the database,
 * so someone who edits the database directly cannot make a new, matching set of seals.
 */

export type Problem = { seq: number | null; id: string | null; kind: "altered" | "missing" | "relinked" | "tail-removed" | "unsealed-added"; message: string };

interface Row { id: string; seq: number | null; prevHash: string | null; hash: string | null; organizationId: string; userName: string | null; action: string; entityType: string; entityId: string | null; summary: string; changes: unknown; createdAt: Date }

@Injectable()
export class AuditSealService implements OnApplicationBootstrap {
  private readonly log = new Logger("AuditSeal");
  constructor(private readonly prisma: PrismaService) {}

  /** Adds an entry to the end of the organization's chain. Entries are written one at a time per organization so numbers never clash. */
  async append(data: { organizationId: string; userId?: string | null; userName?: string | null; action: string; entityType: string; entityId?: string | null; summary: string; changes?: unknown }) {
    return this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.organizationId}))::text`;
      const head = await tx.auditChainHead.findUnique({ where: { organizationId: data.organizationId } });
      const seq = (head?.seq ?? 0) + 1, prevHash = head?.hash ?? GENESIS, createdAt = new Date();
      const hash = computeSeal({ seq, prevHash, organizationId: data.organizationId, userName: data.userName ?? null, action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, summary: data.summary, changes: data.changes ?? null, createdAt });
      const row = await tx.auditLog.create({ data: { organizationId: data.organizationId, userId: data.userId ?? null, userName: data.userName ?? null, action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, summary: data.summary, changes: (data.changes ?? undefined) as never, createdAt, seq, prevHash, hash, sealedAt: createdAt } });
      await tx.auditChainHead.upsert({ where: { organizationId: data.organizationId }, create: { organizationId: data.organizationId, seq, hash }, update: { seq, hash } });
      return row;
    });
  }

  /** Walks the whole chain and reports anything that no longer adds up. */
  async verify(organizationId: string, code?: string) {
    const problems: Problem[] = [];
    let expectSeq = 1, prevHash = GENESIS, checked = 0, lastHash: string | null = null, lastSeq = 0, firstSealedAt: Date | null = null, afterLegacy = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows: Row[] = await this.prisma.auditLog.findMany({ where: { organizationId, hash: { not: null } }, orderBy: { seq: "asc" }, take: 1000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });
      if (rows.length === 0) break;
      for (const r of rows) {
        checked++;
        const seq = r.seq as number;
        let gap = false;
        if (seq > expectSeq) {
          gap = true;
          problems.push({ seq: expectSeq, id: null, kind: "missing", message: seq - 1 === expectSeq ? `Entry #${expectSeq} is missing from the log.` : `Entries #${expectSeq} to #${seq - 1} are missing from the log.` });
        } else if (seq < expectSeq) {
          problems.push({ seq, id: r.id, kind: "relinked", message: `Entry #${seq} appears out of order or twice.` });
        }
        if (!gap && r.prevHash !== prevHash) problems.push({ seq, id: r.id, kind: "relinked", message: `Entry #${seq} is no longer linked to the entry before it.` });
        const good = computeSeal({ seq, prevHash: r.prevHash ?? "", organizationId: r.organizationId, userName: r.userName, action: r.action, entityType: r.entityType, entityId: r.entityId, summary: r.summary, changes: r.changes, createdAt: r.createdAt });
        if (good !== r.hash) problems.push({ seq, id: r.id, kind: "altered", message: `Entry #${seq} ("${r.summary}") has been changed since it was recorded.` });
        prevHash = r.hash as string; lastHash = r.hash; lastSeq = seq; expectSeq = seq + 1;
        if (!firstSealedAt) firstSealedAt = r.createdAt;
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < 1000) break;
    }
    const head = await this.prisma.auditChainHead.findUnique({ where: { organizationId } });
    if (head && head.seq > lastSeq) { const n = head.seq - lastSeq; problems.push({ seq: null, id: null, kind: "tail-removed", message: `The most recent ${n} entr${n === 1 ? "y was" : "ies were"} removed from the log.` }); }
    else if (head && lastHash && head.seq === lastSeq && head.hash !== lastHash) problems.push({ seq: head.seq, id: null, kind: "tail-removed", message: "The newest entry does not match the record the system kept of it." });
    const unsealed = await this.prisma.auditLog.count({ where: { organizationId, hash: null } });
    if (unsealed > 0) { afterLegacy = unsealed; problems.push({ seq: null, id: null, kind: "unsealed-added", message: `${unsealed} entr${unsealed === 1 ? "y was" : "ies were"} added without a seal, which the application never does.` }); }

    let codeResult: { found: boolean; seq?: number; at?: Date; summary?: string } | undefined;
    if (code) {
      const c = code.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
      if (c.length >= 8) {
        const hit = await this.prisma.auditLog.findFirst({ where: { organizationId, hash: { startsWith: c } }, select: { seq: true, createdAt: true, summary: true } });
        codeResult = hit ? { found: true, seq: hit.seq ?? undefined, at: hit.createdAt, summary: hit.summary } : { found: false };
      }
    }
    return {
      status: checked === 0 && problems.length === 0 ? "empty" : problems.length ? "broken" : "ok",
      checked, unsealed: afterLegacy, problems: problems.slice(0, 25), problemCount: problems.length,
      head: head ? { seq: head.seq, code: fingerprint(head.hash), at: head.updatedAt } : null,
      since: firstSealedAt, verifiedAt: new Date(), codeResult,
    };
  }

  /** On start-up: seal any entries recorded before sealing existed, then (unless switched off) make sealed entries read-only at the database level. */
  async onApplicationBootstrap() {
    try {
      const orgs: { organizationId: string }[] = await this.prisma.auditLog.findMany({ where: { hash: null }, select: { organizationId: true }, distinct: ["organizationId"] });
      for (const { organizationId } of orgs) await this.sealOlder(organizationId);
    } catch (e) { this.log.warn(`could not seal older entries: ${(e as Error).message}`); }
    if (process.env.AUDIT_APPEND_ONLY === "false") return;
    try {
      await this.prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION wms_audit_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.hash IS NOT NULL THEN RAISE EXCEPTION 'Sealed audit entries cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.hash IS NOT NULL AND (to_jsonb(NEW) - 'userId') IS DISTINCT FROM (to_jsonb(OLD) - 'userId') THEN
    RAISE EXCEPTION 'Sealed audit entries cannot be changed';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql`);
      await this.prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS wms_audit_guard ON "AuditLog"`);
      await this.prisma.$executeRawUnsafe(`CREATE TRIGGER wms_audit_guard BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION wms_audit_guard()`);
    } catch (e) { this.log.warn(`could not install the read-only guard: ${(e as Error).message}`); }
  }

  private async sealOlder(organizationId: string) {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))::text`;
      const old: Row[] = await tx.auditLog.findMany({ where: { organizationId, hash: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      if (old.length === 0) return;
      const head = await tx.auditChainHead.findUnique({ where: { organizationId } });
      let seq = head?.seq ?? 0, prev: string = head?.hash ?? GENESIS;
      const now = new Date();
      for (const r of old) {
        seq += 1;
        const hash = computeSeal({ seq, prevHash: prev, organizationId, userName: r.userName, action: r.action, entityType: r.entityType, entityId: r.entityId, summary: r.summary, changes: r.changes, createdAt: r.createdAt });
        await tx.auditLog.update({ where: { id: r.id }, data: { seq, prevHash: prev, hash, sealedAt: now } });
        prev = hash;
      }
      await tx.auditChainHead.upsert({ where: { organizationId }, create: { organizationId, seq, hash: prev }, update: { seq, hash: prev } });
      this.log.log(`sealed ${old.length} older audit entr${old.length === 1 ? "y" : "ies"} for organization ${organizationId}`);
    }, { timeout: 60000 });
  }
}
