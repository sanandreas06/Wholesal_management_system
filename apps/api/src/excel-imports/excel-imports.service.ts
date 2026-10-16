import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UploadImportDto } from "./dto/upload-import.dto";
import { buildTemplate, ParsedRow, parseSalesWorkbook } from "./sales-workbook.parser";
import { normalizeName, similarity } from "./match";

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const MAX_ERRORS_STORED = 500;
const batchSelect = {
  id: true, fileName: true, periodStart: true, periodEnd: true, status: true, totalRows: true, importedRows: true, duplicateRows: true, errorRows: true, createdAt: true,
  branch: { select: { id: true, name: true } }, uploadedBy: { select: { id: true, name: true } }
};

@Injectable()
export class ExcelImportsService {
  constructor(private readonly prisma: PrismaService) {}

  template() { return buildTemplate(); }

  list(organizationId: string, branchId?: string) {
    return this.prisma.importBatch.findMany({ where: { organizationId, ...(branchId ? { branchId } : {}) }, select: batchSelect, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async get(organizationId: string, id: string) {
    const b = await this.prisma.importBatch.findFirst({ where: { id, organizationId }, select: { ...batchSelect, errors: { orderBy: { rowNumber: "asc" } } } });
    if (!b) throw new NotFoundException("Import not found");
    return b;
  }

  /** Weekly sales stored from imports, grouped per branch and week-ending date range. */
  async summary(organizationId: string, from: string, to: string, branchId?: string) {
    const f = new Date(`${from}T00:00:00.000Z`), t = new Date(`${to}T23:59:59.999Z`);
    if (isNaN(f.getTime()) || isNaN(t.getTime())) throw new BadRequestException("from and to must be dates in YYYY-MM-DD format");
    const rows = await this.prisma.weeklySale.findMany({
      where: { organizationId, saleDate: { gte: f, lte: t }, ...(branchId ? { branchId } : {}) },
      select: { branchId: true, quantity: true, lineTotal: true, branch: { select: { name: true } } }
    });
    const m = new Map<string, { branchId: string; branch: string; units: number; revenue: number }>();
    for (const r of rows) {
      const e = m.get(r.branchId) ?? { branchId: r.branchId, branch: r.branch.name, units: 0, revenue: 0 };
      e.units += r.quantity; e.revenue += Number(r.lineTotal); m.set(r.branchId, e);
    }
    return [...m.values()].map(e => ({ ...e, revenue: Math.round(e.revenue * 100) / 100 })).sort((a, b) => a.branch.localeCompare(b.branch));
  }

  /** Checks every parsed row. Product match order: SKU, exact name, saved alias, name ignoring case/punctuation. */
  private async evaluate(organizationId: string, branchId: string, periodStart: Date, periodEnd: Date, parsed: ParsedRow[]) {
    const [products, aliases] = await Promise.all([
      this.prisma.product.findMany({ where: { organizationId }, select: { id: true, sku: true, name: true, unitPrice: true } }),
      this.prisma.productAlias.findMany({ where: { organizationId }, select: { aliasKey: true, productId: true } }),
    ]);
    const byId = new Map(products.map(p => [p.id, p]));
    const bySku = new Map(products.map(p => [p.sku.toLowerCase(), p]));
    const byName = new Map(products.map(p => [p.name.toLowerCase(), p]));
    const byKey = new Map(products.map(p => [normalizeName(p.name), p]));
    const byAlias = new Map(aliases.map(a => [a.aliasKey, byId.get(a.productId)]));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const errors: { rowNumber: number; message: string; rawData: string; unmatchedText?: string }[] = [];
    const valid: { rowNumber: number; productId: string; saleDate: Date; quantity: number; unitPrice: number; lineTotal: number; fingerprint: string }[] = [];
    const seen = new Map<string, number>();

    for (const r of parsed) {
      const fail = (message: string, unmatchedText?: string) => errors.push({ rowNumber: r.rowNumber, message, rawData: r.raw.slice(0, 300), unmatchedText });
      if (!r.date) { fail(r.rawDate ? `Unreadable date "${r.rawDate}" (use YYYY-MM-DD or DD/MM/YYYY)` : "Date is missing"); continue; }
      const day = new Date(`${r.date}T00:00:00.000Z`);
      if (day < periodStart || day > periodEnd) { fail(`Date ${r.date} is outside the selected period ${fmt(periodStart)} to ${fmt(periodEnd)}`); continue; }
      if (r.quantity === null) { fail(r.rawQuantity ? `Quantity "${r.rawQuantity}" is not a number` : "Quantity is missing"); continue; }
      if (!Number.isInteger(r.quantity) || r.quantity < 1) { fail(`Quantity must be a whole number greater than zero (got ${r.quantity})`); continue; }
      if (r.rawPrice && r.unitPrice === null) { fail(`Unit price "${r.rawPrice}" is not a number`); continue; }
      if (r.unitPrice !== null && r.unitPrice < 0) { fail("Unit price cannot be negative"); continue; }
      if (!r.sku && !r.product) { fail("Both SKU and Product are empty"); continue; }
      const product =
        (r.sku && bySku.get(r.sku.toLowerCase())) ||
        (r.product && byName.get(r.product.toLowerCase())) ||
        (r.product && byAlias.get(normalizeName(r.product))) ||
        (r.sku && byAlias.get(normalizeName(r.sku))) ||
        (r.product && byKey.get(normalizeName(r.product))) || null;
      if (!product) { fail(`Unknown product ${r.sku ? `SKU "${r.sku}"` : `"${r.product}"`}; match it to a product (Review unmatched) or add it to Products`, r.product || r.sku); continue; }
      const unitPrice = r.unitPrice ?? Number(product.unitPrice);
      const key = [organizationId, branchId, r.date, product.id, r.quantity, unitPrice.toFixed(2), r.reference.toLowerCase()].join("|");
      const occ = (seen.get(key) ?? 0) + 1; seen.set(key, occ);
      valid.push({ rowNumber: r.rowNumber, productId: product.id, saleDate: day, quantity: r.quantity, unitPrice, lineTotal: Math.round(r.quantity * unitPrice * 100) / 100, fingerprint: sha(`${key}|${occ}`) });
    }
    return { errors, valid };
  }

  /** Names the import could not match, grouped, each with the closest products to choose from. */
  async unmatched(organizationId: string, batchId: string) {
    const batch = await this.get(organizationId, batchId);
    const groups = new Map<string, { text: string; rows: number[] }>();
    for (const e of batch.errors) {
      if (!e.unmatchedText) continue;
      const key = normalizeName(e.unmatchedText);
      const g: { text: string; rows: number[] } = groups.get(key) ?? { text: String(e.unmatchedText), rows: [] };
      g.rows.push(e.rowNumber); groups.set(key, g);
    }
    if (groups.size === 0) return [];
    const products = await this.prisma.product.findMany({ where: { organizationId }, select: { id: true, sku: true, name: true } });
    return [...groups.values()].map(g => ({
      text: g.text, rowCount: g.rows.length, rows: g.rows.slice(0, 20),
      suggestions: products.map(p => ({ productId: p.id, sku: p.sku, name: p.name, score: Math.max(similarity(g.text, p.name), similarity(g.text, p.sku)) }))
        .filter(x => x.score >= 0.35).sort((a, b) => b.score - a.score).slice(0, 3).map(x => ({ ...x, score: Math.round(x.score * 100) / 100 })),
    })).sort((a, b) => b.rowCount - a.rowCount);
  }

  /** Saves the chosen matches as aliases, then re-reads the stored file so the newly matched rows are imported (nothing is imported twice). */
  async resolve(organizationId: string, userId: string, batchId: string, mappings: { text: string; productId: string }[]) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id: batchId, organizationId } });
    if (!batch) throw new NotFoundException("Import not found");
    if (!batch.sourceFile) throw new BadRequestException("The original file was not kept for this import");
    if (!mappings?.length) throw new BadRequestException("Choose at least one product match");
    const productIds = [...new Set(mappings.map(m => m.productId))];
    const owned = await this.prisma.product.count({ where: { organizationId, id: { in: productIds } } });
    if (owned !== productIds.length) throw new BadRequestException("One or more products were not found");

    for (const m of mappings) {
      const key = normalizeName(m.text);
      if (!key) continue;
      await this.prisma.productAlias.upsert({
        where: { organizationId_aliasKey: { organizationId, aliasKey: key } },
        update: { productId: m.productId, alias: m.text },
        create: { organizationId, productId: m.productId, alias: m.text, aliasKey: key, createdByUserId: userId },
      });
    }

    const parsed = await parseSalesWorkbook(Buffer.from(batch.sourceFile), batch.fileName);
    const { errors, valid } = await this.evaluate(organizationId, batch.branchId, batch.periodStart, batch.periodEnd, parsed);
    const existing = valid.length ? await this.prisma.weeklySale.findMany({ where: { organizationId, fingerprint: { in: valid.map(v => v.fingerprint) } }, select: { fingerprint: true } }) : [];
    const existingSet = new Set(existing.map(e => e.fingerprint));
    const fresh = valid.filter(v => !existingSet.has(v.fingerprint));

    return this.prisma.$transaction(async tx => {
      let created = 0;
      if (fresh.length) {
        const res = await tx.weeklySale.createMany({
          data: fresh.map(v => ({ organizationId, branchId: batch.branchId, batchId, productId: v.productId, saleDate: v.saleDate, quantity: v.quantity, unitPrice: v.unitPrice, lineTotal: v.lineTotal, fingerprint: v.fingerprint })),
          skipDuplicates: true,
        });
        created = res.count;
      }
      await tx.importRowError.deleteMany({ where: { batchId } });
      if (errors.length) await tx.importRowError.createMany({ data: errors.slice(0, MAX_ERRORS_STORED).map(e => ({ ...e, batchId })) });
      const importedRows = batch.importedRows + created;
      const status = importedRows === 0 && batch.duplicateRows === 0 ? "FAILED" : errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
      await tx.importBatch.update({ where: { id: batchId }, data: { importedRows, errorRows: errors.length, duplicateRows: parsed.length - errors.length - importedRows, status: status as any } });
      return tx.importBatch.findUniqueOrThrow({ where: { id: batchId }, select: { ...batchSelect, errors: { orderBy: { rowNumber: "asc" } } } });
    });
  }

  async upload(organizationId: string, userId: string, file: Express.Multer.File | undefined, dto: UploadImportDto) {
    if (!file) throw new BadRequestException("Attach a .xlsx or .csv file in the 'file' field");
    if (!/\.(xlsx|csv)$/i.test(file.originalname)) throw new BadRequestException("Only .xlsx and .csv files are supported");
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId } });
    if (!branch) throw new BadRequestException("Branch not found");
    const periodStart = new Date(`${dto.periodStart}T00:00:00.000Z`), periodEnd = new Date(`${dto.periodEnd}T23:59:59.999Z`);
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) throw new BadRequestException("Invalid period dates");
    if (periodStart > periodEnd) throw new BadRequestException("periodStart must not be after periodEnd");
    const endOfToday = new Date(); endOfToday.setUTCHours(23, 59, 59, 999);
    if (periodEnd > endOfToday) throw new BadRequestException("The period cannot end in the future");

    const parsed = await parseSalesWorkbook(file.buffer, file.originalname);
    if (parsed.length === 0) throw new BadRequestException("The file has no data rows below the header");

    const { errors, valid } = await this.evaluate(organizationId, dto.branchId, periodStart, periodEnd, parsed);

    const existing = valid.length ? await this.prisma.weeklySale.findMany({ where: { organizationId, fingerprint: { in: valid.map(v => v.fingerprint) } }, select: { fingerprint: true } }) : [];
    const existingSet = new Set(existing.map(e => e.fingerprint));
    const fresh = valid.filter(v => !existingSet.has(v.fingerprint));

    return this.prisma.$transaction(async tx => {
      const status = fresh.length === 0 && existingSet.size === 0 ? "FAILED" : errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
      const batch = await tx.importBatch.create({
        data: {
          organizationId, branchId: dto.branchId, periodStart, periodEnd, fileName: file.originalname, fileHash: sha(file.buffer), sourceFile: file.buffer,
          status: status as any, totalRows: parsed.length, importedRows: 0, duplicateRows: valid.length - fresh.length, errorRows: errors.length, uploadedByUserId: userId
        }
      });
      let created = 0;
      if (fresh.length) {
        const res = await tx.weeklySale.createMany({
          data: fresh.map(v => ({ organizationId, branchId: dto.branchId, batchId: batch.id, productId: v.productId, saleDate: v.saleDate, quantity: v.quantity, unitPrice: v.unitPrice, lineTotal: v.lineTotal, fingerprint: v.fingerprint })),
          skipDuplicates: true
        });
        created = res.count;
      }
      if (errors.length) await tx.importRowError.createMany({ data: errors.slice(0, MAX_ERRORS_STORED).map(e => ({ ...e, batchId: batch.id })) });
      await tx.importBatch.update({ where: { id: batch.id }, data: { importedRows: created, duplicateRows: parsed.length - errors.length - created } });
      return tx.importBatch.findUniqueOrThrow({ where: { id: batch.id }, select: { ...batchSelect, errors: { orderBy: { rowNumber: "asc" } } } });
    });
  }
}
