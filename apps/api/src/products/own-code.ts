import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/** The check digit that makes 12 digits a valid EAN-13. */
export function ean13Check(d12: string) {
  const sum = d12.split("").reduce((s, ch, i) => s + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}
export const isEan13 = (c: string) => /^\d{13}$/.test(c) && ean13Check(c.slice(0, 12)) === c[12];

type Db = { product: { findFirst(a: unknown): Promise<{ id: string } | null> } };

/**
 * A new permanent product code: "2" (the EAN range shops use for their own codes, never printed by makers) + 11 digits + check digit.
 * Every barcode scanner and phone camera reads it, and an ink-jet coder can print it straight onto packaging.
 * Unique within the company (checked against every barcode already on its products).
 */
export async function newOwnCode(db: Db, organizationId: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    let d = "2";
    for (let k = 0; k < 11; k++) d += String(randomInt(10));
    const code = d + ean13Check(d);
    const clash = await db.product.findFirst({ where: { organizationId, OR: [{ ownCode: code }, { barcodes: { has: code } }] }, select: { id: true } } as never);
    if (!clash) return code;
  }
  throw new Error("Could not make a free product code");
}

/** Strips the address from a scanned WHOLESTRA QR (https://…/f/<code>) so the code underneath is what gets looked up. */
export function codeFromScan(raw: string) {
  const s = (raw ?? "").trim();
  const m = s.match(/^https?:\/\/[^/\s]+(?:\/w\/[a-z0-9-]+)?\/f\/([\x21-\x7E]{3,64})\/?$/i);
  return m ? decodeURIComponent(m[1]) : s;
}

/** Products made before own codes existed get theirs once, when the server starts. */
@Injectable()
export class OwnCodeBackfill implements OnApplicationBootstrap {
  private readonly log = new Logger("ProductCodes");
  constructor(private readonly prisma: PrismaService) {}
  async onApplicationBootstrap() {
    try {
      const missing = await this.prisma.product.findMany({ where: { ownCode: null }, select: { id: true, organizationId: true, barcodes: true }, take: 20000 });
      for (const p of missing) {
        const code = await newOwnCode(this.prisma, p.organizationId);
        await this.prisma.product.update({ where: { id: p.id }, data: { ownCode: code, barcodes: [code, ...p.barcodes.filter(b => b !== code)].slice(0, 11) } });
      }
      if (missing.length) this.log.log(`gave ${missing.length} product(s) their own permanent code`);
    } catch (e) { this.log.warn(`could not give products their codes: ${(e as Error).message}`); }
  }
}
