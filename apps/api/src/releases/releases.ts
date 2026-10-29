import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpException, HttpStatus, Injectable, Module, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryModule } from "../inventory/inventory.module";
import { InventoryService } from "../inventory/inventory.service";
import { TrackingModule } from "../tracking/tracking.controller";
import { TrackingService } from "../tracking/tracking.service";
import { cleanCodes } from "../tracking/codes";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { assertBranch, scopeOf } from "../common/branch/branch-scope";

type Tx = Prisma.TransactionClient;
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const newToken = () => Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** A sale line going out: how many, how many were scanned, and the item labels for labelled products. */
export interface OutLine { saleItemId: string; productId: string; name: string; quantity: number; scanned: number; codes: string[]; barcoded: boolean; tracked: boolean }

// ------------------------------------------------------------------ input shapes

export class ReleaseLineInput {
  @IsUUID() saleItemId!: string;
  @IsInt() @Min(0) @Max(100000) quantity!: number;
  @IsInt() @Min(0) @Max(100000) scanned!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @IsString({ each: true }) @MaxLength(64, { each: true }) codes?: string[];
}
export class ReleaseDto {
  @IsUUID() saleId!: string;
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ReleaseLineInput) lines!: ReleaseLineInput[];
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @IsString() @MaxLength(120) collectedBy?: string;
  @IsOptional() @IsString() @MaxLength(40) vehicle?: string;
}
export class ConfirmLineInput { @IsUUID() itemId!: string; @IsInt() @Min(0) @Max(100000) received!: number }
export class ConfirmDto {
  @IsBoolean() allReceived!: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ConfirmLineInput) lines?: ConfirmLineInput[];
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
}

/**
 * Goods leave a branch only by being scanned out: at the counter as part of the sale, or later when the customer collects
 * or a delivery goes out. Each release gets a QR code (on the receipt or the release note) that the customer opens to confirm
 * how many items they received. A shortage becomes a question for the branch manager and the owner.
 */
@Injectable()
export class ReleasesService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService, private readonly tracking: TrackingService) {}

  /** Labelled products: the scanned labels (and for any not scanned, the oldest labelled items on the shelf) are marked sold. */
  async sellItems(tx: Tx, org: string, branchId: string, saleId: string, invoice: string, userId: string, p: { id: string; name: string }, quantity: number, codes: string[], lenient = false) {
    if (codes.length > quantity) throw new BadRequestException(`"${p.name}": ${codes.length} labels were scanned for ${quantity}.`);
    // offline sales: labels scanned while the internet was down may no longer be on the shelf here; keep the ones that are
    if (lenient && codes.length) {
      const ok = await tx.stockItem.findMany({ where: { organizationId: org, productId: p.id, branchId, status: "IN_STOCK", code: { in: codes } }, select: { code: true } });
      codes = codes.filter(c => ok.some(o => o.code === c)).filter((c, i, a) => a.indexOf(c) === i);
    }
    const scanned = await this.tracking.checkItemCodes(tx, org, p.name, p.id, codes, { status: "IN_STOCK", branchId });
    const rest = quantity > scanned.length ? await tx.stockItem.findMany({ where: { organizationId: org, productId: p.id, branchId, status: "IN_STOCK", id: { notIn: scanned.map(i => i.id) } }, orderBy: { createdAt: "asc" }, take: quantity - scanned.length, select: { id: true } }) : [];
    const items = [...scanned, ...rest];
    await tx.stockItem.updateMany({ where: { id: { in: items.map(i => i.id) } }, data: { status: "SOLD", branchId: null, saleId } });
    await this.tracking.events(tx, org, items.map(i => i.id), { type: "SOLD", branchId, userId, referenceType: "Sale", referenceId: saleId, note: `${invoice}${codes.length === quantity ? "" : " (label not scanned)"}` });
    return items.length;
  }

  /** Labelled items go back on the shelf (a voided sale or a return). */
  async unsellItems(tx: Tx, org: string, branchId: string, saleId: string, productId: string, quantity: number, userId: string, note: string) {
    const items = await tx.stockItem.findMany({ where: { organizationId: org, saleId, productId, status: "SOLD" }, orderBy: { updatedAt: "desc" }, take: quantity, select: { id: true } });
    if (!items.length) return;
    await tx.stockItem.updateMany({ where: { id: { in: items.map(i => i.id) } }, data: { status: "IN_STOCK", branchId, saleId: null } });
    await this.tracking.events(tx, org, items.map(i => i.id), { type: "RETURNED", branchId, userId, referenceType: "Sale", referenceId: saleId, note });
  }

  /** Whether everything that can be scanned was scanned. Products with no barcode at all cannot be scanned and are not held against anyone. */
  static check(lines: OutLine[]) {
    for (const l of lines) if (l.scanned > l.quantity) throw new BadRequestException(`"${l.name}": ${l.scanned} were scanned but ${l.quantity} are going out.`);
    return lines.every(l => !(l.barcoded || l.tracked) || l.scanned >= l.quantity);
  }

  private async nextNumber(tx: Tx, org: string) {
    const n = await tx.goodsRelease.count({ where: { organizationId: org } });
    return `REL-${String(n + 1).padStart(5, "0")}`;
  }

  /** Records goods leaving for a sale, inside the caller's transaction. `deduct` is false at the counter (the sale already took the stock). */
  async record(tx: Tx, p: { org: string; sale: { id: string; branchId: string; invoiceNumber: string; branchName: string }; userId: string; lines: OutLine[]; reason?: string; collectedBy?: string; vehicle?: string; deduct: boolean; confirmToken?: string; lenient?: boolean }) {
    const going = p.lines.filter(l => l.quantity > 0);
    if (!going.length) throw new BadRequestException("Nothing is going out: every line is zero.");
    const byScan = ReleasesService.check(going);
    const reason = byScan ? undefined : TrackingService.needReason(p.reason);
    const number = await this.nextNumber(tx, p.org);
    // the counter may bring its own QR code (printed on an offline receipt); use it unless it is somehow taken
    const token = p.confirmToken && !(await tx.goodsRelease.findUnique({ where: { confirmToken: p.confirmToken }, select: { id: true } })) ? p.confirmToken : newToken();
    const release = await tx.goodsRelease.create({
      data: { organizationId: p.org, saleId: p.sale.id, branchId: p.sale.branchId, number, releasedByUserId: p.userId, byScan, reason, collectedBy: p.collectedBy?.trim() || null, vehicle: p.vehicle?.trim() || null, confirmToken: token,
        items: { create: going.map(l => ({ saleItemId: l.saleItemId, productId: l.productId, quantity: l.quantity, scanned: l.scanned, itemCodes: l.codes })) } },
    });
    for (const l of going) {
      if (p.deduct) await this.inventory.adjustStock(tx, { organizationId: p.org, productId: l.productId, branchId: p.sale.branchId, type: "SALE", quantityDelta: -l.quantity, referenceType: "GoodsRelease", referenceId: release.id, userId: p.userId, notes: `${number} for ${p.sale.invoiceNumber}${byScan ? "" : " (not all scanned)"}` });
      if (l.tracked) await this.sellItems(tx, p.org, p.sale.branchId, p.sale.id, p.sale.invoiceNumber, p.userId, { id: l.productId, name: l.name }, l.quantity, l.codes, p.lenient);
      await tx.saleItem.update({ where: { id: l.saleItemId }, data: { releasedQuantity: { increment: l.quantity } } });
    }
    const after = await tx.saleItem.findMany({ where: { saleId: p.sale.id }, select: { quantity: true, releasedQuantity: true } });
    const fulfilment = after.every(i => (i.releasedQuantity ?? i.quantity) >= i.quantity) ? "RELEASED" : "PARTLY";
    await tx.sale.update({ where: { id: p.sale.id }, data: { fulfilment } });
    if (!byScan) {
      const missed = going.filter(l => (l.barcoded || l.tracked) && l.scanned < l.quantity).map(l => `${l.quantity - l.scanned} × ${l.name}`);
      await this.tracking.raise(tx, { organizationId: p.org, branchId: p.sale.branchId, kind: "NOT_SCANNED_RELEASE", title: `${p.sale.invoiceNumber}: goods went out without scanning everything`,
        detail: `${missed.join(", ")} left ${p.sale.branchName} for the customer without being scanned (${number}). Reason given: ${reason}`, referenceType: "GoodsRelease", referenceId: release.id, referenceNumber: p.sale.invoiceNumber, userId: p.userId });
    }
    return { id: release.id, number, confirmToken: release.confirmToken, byScan, fulfilment };
  }

  // ------------------------------------------------------------------ releasing goods later (collection or delivery)

  private saleFor(org: string, where: Prisma.SaleWhereInput) {
    return this.prisma.sale.findFirst({
      where: { organizationId: org, ...where },
      include: {
        branch: { select: { id: true, name: true } }, customer: { select: { id: true, name: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, barcodes: true, trackItems: true } } } },
        releases: { orderBy: { createdAt: "asc" }, select: { id: true, number: true, createdAt: true, byScan: true, collectedBy: true, vehicle: true, confirmToken: true, items: { select: { saleItemId: true, quantity: true } }, confirmation: { select: { status: true, createdAt: true } } } },
      },
    });
  }

  /** Scan the QR on a receipt or release note, or type the invoice number: the sale and what is still to go out. */
  async findSale(user: AuthUser, raw: string) {
    const code = (raw ?? "").trim();
    if (!code) throw new BadRequestException("Scan the receipt or type the invoice number.");
    const token = code.match(/\/c\/([2-9A-HJKMNP-Z]{16})\b/i)?.[1]?.toUpperCase();
    const sale = token
      ? await this.saleFor(user.organizationId, { releases: { some: { confirmToken: token } } })
      : await this.saleFor(user.organizationId, { invoiceNumber: { equals: code, mode: "insensitive" } });
    if (!sale) throw new NotFoundException(`No sale found for ${code}.`);
    const mine = scopeOf(user);
    if (mine && sale.branchId !== mine) throw new NotFoundException("This sale belongs to another branch.");
    return this.shape(sale);
  }

  async saleById(user: AuthUser, id: string) {
    const sale = await this.saleFor(user.organizationId, { id });
    const mine = scopeOf(user);
    if (!sale || (mine && sale.branchId !== mine)) throw new NotFoundException("Sale not found");
    return this.shape(sale);
  }

  private shape(sale: NonNullable<Awaited<ReturnType<ReleasesService["saleFor"]>>>) {
    return {
      id: sale.id, invoiceNumber: sale.invoiceNumber, status: sale.status, fulfilment: sale.fulfilment, soldAt: sale.soldAt, branch: sale.branch, customer: sale.customer,
      items: sale.items.map(i => ({ id: i.id, productId: i.productId, product: i.product, quantity: i.quantity, released: i.releasedQuantity ?? i.quantity, outstanding: Math.max(0, i.quantity - (i.releasedQuantity ?? i.quantity)) })),
      releases: sale.releases.map(r => ({ id: r.id, number: r.number, createdAt: r.createdAt, byScan: r.byScan, collectedBy: r.collectedBy, vehicle: r.vehicle, confirmToken: r.confirmToken, units: r.items.reduce((s, x) => s + x.quantity, 0), confirmation: r.confirmation })),
    };
  }

  async release(user: AuthUser, dto: ReleaseDto) {
    const org = user.organizationId;
    const sale = await this.saleFor(org, { id: dto.saleId });
    if (!sale) throw new NotFoundException("Sale not found");
    assertBranch(user, sale.branchId);
    if (sale.status !== "COMPLETED") throw new ConflictException("This sale was voided, so nothing can go out for it.");
    if (sale.fulfilment === "RELEASED") throw new ConflictException(`Everything on ${sale.invoiceNumber} has already gone out.`);
    const given = new Map(dto.lines.map(l => [l.saleItemId, l]));
    for (const id of given.keys()) if (!sale.items.some(i => i.id === id)) throw new BadRequestException("A line does not belong to this sale.");
    const lines: OutLine[] = sale.items.map(i => {
      const g = given.get(i.id), owed = Math.max(0, i.quantity - (i.releasedQuantity ?? i.quantity)), q = g?.quantity ?? 0;
      if (q > owed) throw new BadRequestException(`"${i.product.name}": only ${owed} still to go out.`);
      return { saleItemId: i.id, productId: i.productId, name: i.product.name, quantity: q, scanned: g?.scanned ?? 0, codes: cleanCodes(g?.codes), barcoded: i.product.barcodes.length > 0, tracked: i.product.trackItems };
    });
    // the goods are still on the shelf until now: check they are really there
    for (const l of lines.filter(x => x.quantity > 0)) {
      const inv = await this.prisma.inventory.findUnique({ where: { productId_branchId: { productId: l.productId, branchId: sale.branchId } } });
      if ((inv?.quantity ?? 0) < l.quantity) throw new BadRequestException(`Only ${inv?.quantity ?? 0} "${l.name}" are in stock at ${sale.branch.name}.`);
    }
    return this.prisma.$transaction(tx => this.record(tx, { org, sale: { id: sale.id, branchId: sale.branchId, invoiceNumber: sale.invoiceNumber, branchName: sale.branch.name }, userId: user.sub, lines, reason: dto.reason, collectedBy: dto.collectedBy, vehicle: dto.vehicle, deduct: true }));
  }

  /** Sales whose goods are still waiting to be collected or delivered. */
  async owed(user: AuthUser, branchId?: string) {
    const mine = scopeOf(user), b = mine ?? branchId;
    const sales = await this.prisma.sale.findMany({
      where: { organizationId: user.organizationId, status: "COMPLETED", fulfilment: { in: ["AWAITING", "PARTLY"] }, ...(b ? { branchId: b } : {}) },
      orderBy: { soldAt: "asc" }, take: 300,
      select: { id: true, invoiceNumber: true, soldAt: true, fulfilment: true, branch: { select: { name: true } }, customer: { select: { name: true, phone: true } }, items: { select: { quantity: true, releasedQuantity: true, product: { select: { name: true } } } } },
    });
    return sales.map(s => ({ id: s.id, invoiceNumber: s.invoiceNumber, soldAt: s.soldAt, fulfilment: s.fulfilment, branch: s.branch.name, customer: s.customer,
      owed: s.items.map(i => ({ name: i.product.name, quantity: Math.max(0, i.quantity - (i.releasedQuantity ?? 0)) })).filter(i => i.quantity > 0) }));
  }

  /** A release note to print (or reprint). */
  async note(user: AuthUser, id: string) {
    const r = await this.prisma.goodsRelease.findFirst({ where: { id, organizationId: user.organizationId }, include: { items: true, sale: { select: { invoiceNumber: true, soldAt: true, customer: { select: { name: true, phone: true } } } } } });
    const mine = scopeOf(user);
    if (!r || (mine && r.branchId !== mine)) throw new NotFoundException("Release not found");
    const [products, branch, by, org] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: r.items.map(i => i.productId) } }, select: { id: true, name: true, sku: true } }),
      this.prisma.branch.findUnique({ where: { id: r.branchId }, select: { name: true, location: true } }),
      this.prisma.user.findUnique({ where: { id: r.releasedByUserId }, select: { name: true } }),
      this.prisma.organization.findUnique({ where: { id: user.organizationId }, select: { name: true, logo: true, phone: true } }),
    ]);
    const pn = new Map(products.map(p => [p.id, p]));
    return { id: r.id, number: r.number, createdAt: r.createdAt, byScan: r.byScan, collectedBy: r.collectedBy, vehicle: r.vehicle, confirmToken: r.confirmToken, invoiceNumber: r.sale.invoiceNumber, soldAt: r.sale.soldAt, customer: r.sale.customer,
      branch, releasedBy: by?.name ?? "", company: org, items: r.items.map(i => ({ name: pn.get(i.productId)?.name ?? "", sku: pn.get(i.productId)?.sku ?? "", quantity: i.quantity, itemCodes: i.itemCodes })) };
  }

  // ------------------------------------------------------------------ the customer's side (no sign-in: the QR code is the key)

  private async byToken(token: string) {
    const t = (token ?? "").trim().toUpperCase();
    if (!/^[2-9A-HJKMNP-Z]{16}$/.test(t)) throw new NotFoundException("This confirmation link is not valid.");
    const r = await this.prisma.goodsRelease.findUnique({ where: { confirmToken: t }, include: { items: true, confirmation: true, sale: { select: { invoiceNumber: true, soldAt: true, status: true, customer: { select: { name: true } } } } } });
    if (!r) throw new NotFoundException("This confirmation link is not valid.");
    return r;
  }

  async confirmInfo(token: string) {
    const r = await this.byToken(token);
    const [products, branch, org] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: r.items.map(i => i.productId) } }, select: { id: true, name: true } }),
      this.prisma.branch.findUnique({ where: { id: r.branchId }, select: { name: true } }),
      this.prisma.organization.findUnique({ where: { id: r.organizationId }, select: { name: true, logo: true, phone: true } }),
    ]);
    const pn = new Map(products.map(p => [p.id, p.name]));
    return {
      company: org?.name ?? "", logo: org?.logo ?? null, phone: org?.phone ?? null, branch: branch?.name ?? "", invoiceNumber: r.sale.invoiceNumber, number: r.number, date: r.createdAt, customer: r.sale.customer?.name ?? null,
      items: r.items.map(i => ({ id: i.id, name: pn.get(i.productId) ?? "", quantity: i.quantity })), total: r.items.reduce((s, i) => s + i.quantity, 0),
      confirmed: r.confirmation ? { status: r.confirmation.status, at: r.confirmation.createdAt } : null,
    };
  }

  private hits = new Map<string, number[]>();
  async confirm(token: string, dto: ConfirmDto, ip?: string) {
    const key = ip ?? "?", now = Date.now(), list = (this.hits.get(key) ?? []).filter(t => t > now - 10 * 60_000);
    if (list.length >= 20) throw new HttpException("Too many answers from this phone. Please wait a few minutes.", HttpStatus.TOO_MANY_REQUESTS);
    list.push(now); this.hits.set(key, list);
    const r = await this.byToken(token);
    if (r.confirmation) throw new ConflictException("These goods were already confirmed. Thank you!");
    const products = await this.prisma.product.findMany({ where: { id: { in: r.items.map(i => i.productId) } }, select: { id: true, name: true } });
    const pn = new Map(products.map(p => [p.id, p.name]));
    const said = new Map((dto.lines ?? []).map(l => [l.itemId, l.received]));
    const lines = r.items.map(i => {
      const got = dto.allReceived ? i.quantity : Math.min(i.quantity, said.get(i.id) ?? i.quantity);
      return { name: pn.get(i.productId) ?? "", expected: i.quantity, received: got };
    });
    const short = lines.filter(l => l.received < l.expected);
    const comment = dto.comment?.trim() || null;
    const problem = !dto.allReceived && (short.length > 0 || !!comment);
    const branch = await this.prisma.branch.findUnique({ where: { id: r.branchId }, select: { name: true } });
    await this.prisma.$transaction(async tx => {
      await tx.customerConfirmation.create({ data: { organizationId: r.organizationId, releaseId: r.id, saleId: r.saleId, branchId: r.branchId, status: problem ? "PROBLEM" : "CONFIRMED", lines, comment, name: dto.name?.trim() || null, phone: dto.phone?.trim() || null, ip: ip ?? null } });
      if (problem) {
        const missing = short.map(l => `${l.expected - l.received} × ${l.name}`);
        const who = [dto.name?.trim() || r.sale.customer?.name, dto.phone?.trim()].filter(Boolean).join(", ");
        await this.tracking.raise(tx, { organizationId: r.organizationId, branchId: r.branchId, kind: "CUSTOMER_SHORT",
          title: short.length ? `Customer says ${missing.join(", ")} missing on ${r.sale.invoiceNumber}` : `Customer reported a problem with ${r.sale.invoiceNumber}`,
          detail: `${short.length ? `Released from ${branch?.name ?? "the branch"} on ${r.number}: ${lines.map(l => `${l.name} ${l.received} of ${l.expected}`).join("; ")}.` : `Released on ${r.number}.`}${comment ? ` Customer wrote: "${comment}"` : ""}${who ? ` (${who})` : ""}`,
          quantity: short.reduce((s, l) => s + l.expected - l.received, 0) || null, referenceType: "GoodsRelease", referenceId: r.id, referenceNumber: r.sale.invoiceNumber, userId: r.releasedByUserId });
      }
    });
    return { status: problem ? "PROBLEM" : "CONFIRMED" };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("releases")
export class ReleasesController {
  constructor(private readonly svc: ReleasesService) {}
  @Get("find") @RequirePermissions("SALES:READ", "STOCK_TRANSFERS:UPDATE")
  find(@CurrentUser() u: AuthUser, @Query("code") code: string) { return this.svc.findSale(u, code); }
  @Get("owed") @RequirePermissions("SALES:READ", "STOCK_TRANSFERS:READ")
  owed(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string) { return this.svc.owed(u, branchId); }
  @Get("sale/:id") @RequirePermissions("SALES:READ", "STOCK_TRANSFERS:UPDATE")
  sale(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.saleById(u, id); }
  @Get(":id") @RequirePermissions("SALES:READ", "STOCK_TRANSFERS:UPDATE")
  note(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.note(u, id); }
  /** Goods going out for a sale (collection or delivery), scanned. */
  @Post() @RequirePermissions("SALES:CREATE", "SALES:UPDATE", "STOCK_TRANSFERS:UPDATE")
  release(@CurrentUser() u: AuthUser, @Body() dto: ReleaseDto) { return this.svc.release(u, dto); }
}

/** The customer's confirmation page talks to these. No sign-in: the code in the QR is the key, and it works once. */
@Controller("public/confirm")
export class ConfirmController {
  constructor(private readonly svc: ReleasesService) {}
  @Get(":token") info(@Param("token") token: string) { return this.svc.confirmInfo(token); }
  @Post(":token") @HttpCode(200) confirm(@Param("token") token: string, @Body() dto: ConfirmDto, @Req() req: { ip?: string }) { return this.svc.confirm(token, dto, req.ip); }
}

@Module({ imports: [InventoryModule, TrackingModule], controllers: [ReleasesController, ConfirmController], providers: [ReleasesService], exports: [ReleasesService] })
export class ReleasesModule {}
