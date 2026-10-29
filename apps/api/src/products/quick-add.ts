import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Logger, NotFoundException, Post, Query, UseGuards } from "@nestjs/common";
import { IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { newOwnCode } from "./own-code";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";

const CODE = /^[\x21-\x7E]{3,64}$/;

export class QuickProductDto {
  @IsString() @Matches(CODE, { message: "The barcode can only contain letters, digits and symbols." }) barcode!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsUUID() categoryId?: string;
  /** Only people who may set prices (Products: create) can fill these; for anyone else the product waits for a manager to price it. */
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
}
export class AttachBarcodeDto {
  @IsUUID() productId!: string;
  @IsString() @Matches(CODE, { message: "The barcode can only contain letters, digits and symbols." }) barcode!: string;
}

/** What the free product databases say a barcode is (packaged food, drinks, toiletries, household goods). */
export interface BarcodeInfo { found: boolean; name?: string; brand?: string; size?: string; source?: string }

/**
 * Adding products while scanning. A barcode is only a number: the first time one arrives, somebody has to say what it is.
 * - Look it up in Open Food Facts / Open Beauty Facts / Open Products Facts (free, public) to suggest a name.
 * - Create the product on the spot, from the Goods in screen. A store person who may not set prices can still add it;
 *   it is then marked "needs a price" and cannot be sold until a manager prices it.
 * - Or attach the barcode to a product that already exists (the carton has a code nobody recorded yet).
 */
@Injectable()
export class QuickAddService {
  private readonly log = new Logger("QuickAdd");
  private cache = new Map<string, { at: number; info: BarcodeInfo }>();
  constructor(private readonly prisma: PrismaService) {}

  get lookupOn() { return (process.env.BARCODE_LOOKUP || "on").toLowerCase() !== "off"; }

  async barcodeInfo(raw: string): Promise<BarcodeInfo> {
    const code = (raw ?? "").trim();
    // only real product numbers (EAN-8, UPC-A, EAN-13, GTIN-14) are in these databases; WHOLESTRA's own codes and SKUs are not
    if (!this.lookupOn || !/^\d{8}$|^\d{12,14}$/.test(code) || /^2/.test(code) && code.length === 13) return { found: false };
    const hit = this.cache.get(code);
    if (hit && hit.at > Date.now() - 24 * 3600_000) return hit.info;
    const sources = [["Open Food Facts", "world.openfoodfacts.org"], ["Open Beauty Facts", "world.openbeautyfacts.org"], ["Open Products Facts", "world.openproductsfacts.org"]];
    let info: BarcodeInfo = { found: false };
    for (const [label, host] of sources) {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
      try {
        const res = await fetch(`https://${host}/api/v2/product/${code}.json?fields=product_name,product_name_en,generic_name,brands,quantity`, { signal: ctl.signal, headers: { "User-Agent": "WHOLESTRA/1.0 (wholesale management; contact sanshubster@gmail.com)", accept: "application/json" } });
        if (!res.ok) continue;
        const data = await res.json() as { status?: number; product?: { product_name?: string; product_name_en?: string; generic_name?: string; brands?: string; quantity?: string } };
        const p = data.status === 1 ? data.product : undefined;
        const name = (p?.product_name_en || p?.product_name || p?.generic_name || "").trim();
        if (!name) continue;
        const brand = (p?.brands || "").split(",")[0]?.trim() || undefined, size = (p?.quantity || "").trim() || undefined;
        info = { found: true, name: [brand && !name.toLowerCase().includes(brand.toLowerCase()) ? brand : "", name, size && !name.includes(size) ? size : ""].filter(Boolean).join(" ").slice(0, 160), brand, size, source: label };
        break;
      } catch (e) { this.log.debug(`${host}: ${(e as Error).message}`); }
      finally { clearTimeout(t); }
    }
    this.cache.set(code, { at: Date.now(), info });
    if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value as string);
    return info;
  }

  private async assertFree(org: string, code: string) {
    const clash = await this.prisma.product.findFirst({ where: { organizationId: org, OR: [{ barcodes: { has: code } }, { sku: { equals: code, mode: "insensitive" } }] }, select: { name: true } });
    if (clash) throw new ConflictException(`This barcode is already on "${clash.name}".`);
  }

  /** A short unique product code from the name: "Gino Tomato Paste 70g" -> GINO-TOMA-4821. */
  private async newSku(org: string, name: string) {
    const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.slice(0, 4));
    const base = (words.join("-") || "ITEM").slice(0, 12);
    for (let i = 0; i < 20; i++) {
      const sku = `${base}-${1000 + Math.floor(Math.random() * 9000)}`;
      if (!await this.prisma.product.findFirst({ where: { organizationId: org, sku }, select: { id: true } })) return sku;
    }
    throw new ConflictException("Could not make a product code. Try again.");
  }

  async create(user: AuthUser, dto: QuickProductDto) {
    const org = user.organizationId, code = dto.barcode.trim(), name = dto.name.trim();
    await this.assertFree(org, code);
    if (dto.categoryId && !await this.prisma.category.findFirst({ where: { id: dto.categoryId, organizationId: org }, select: { id: true } })) throw new NotFoundException("Category not found");
    const same = await this.prisma.product.findFirst({ where: { organizationId: org, name: { equals: name, mode: "insensitive" } }, select: { name: true } });
    if (same) throw new ConflictException(`A product called "${same.name}" already exists. If it is the same product, choose "We already have it" and pick it, so the barcode is added to it.`);
    const mayPrice = user.permissions.includes("PRODUCTS:CREATE"), maySeeCost = user.permissions.includes("PROFIT:READ");
    if (mayPrice && dto.unitPrice === undefined) throw new BadRequestException("Set the selling price.");
    const category = dto.categoryId ? await this.prisma.category.findUnique({ where: { id: dto.categoryId }, select: { name: true } }) : null;
    const p = await this.prisma.product.create({
      data: { organizationId: org, sku: await this.newSku(org, name), name, ...await (async () => { const own = await newOwnCode(this.prisma, org); return { ownCode: own, barcodes: [own, code] }; })(), categoryId: dto.categoryId ?? null, category: category?.name ?? null,
        unitPrice: mayPrice ? dto.unitPrice! : 0, costPrice: mayPrice && maySeeCost && dto.costPrice !== undefined ? dto.costPrice : null, needsPrice: !mayPrice, stockQuantity: 0 },
      select: { id: true, sku: true, name: true, barcodes: true, ownCode: true, trackItems: true, needsPrice: true, unitPrice: true },
    });
    return { ...p, unitPrice: Number(p.unitPrice) };
  }

  async attach(user: AuthUser, dto: AttachBarcodeDto) {
    const org = user.organizationId, code = dto.barcode.trim();
    const p = await this.prisma.product.findFirst({ where: { id: dto.productId, organizationId: org }, select: { id: true, name: true, barcodes: true } });
    if (!p) throw new NotFoundException("Product not found");
    await this.assertFree(org, code);
    if (p.barcodes.length >= 11) throw new BadRequestException(`"${p.name}" already has 10 barcodes. Remove an old one on the product first.`);
    const u = await this.prisma.product.update({ where: { id: p.id }, data: { barcodes: [...p.barcodes, code] }, select: { id: true, sku: true, name: true, barcodes: true, trackItems: true, needsPrice: true } });
    return u;
  }

  /** Products added by the store that still need a selling price. */
  waitingForPrice(user: AuthUser) {
    return this.prisma.product.findMany({ where: { organizationId: user.organizationId, needsPrice: true }, select: { id: true, name: true, sku: true, barcodes: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("products/quick")
export class QuickAddController {
  constructor(private readonly svc: QuickAddService) {}
  /** What the public product databases say this barcode is (to suggest a name). Never fails: an unknown barcode just says found: false. */
  @Get("barcode-info") @RequirePermissions("PRODUCTS:CREATE", "GOODS_RECEIVING:CREATE")
  info(@Query("code") code: string) { return this.svc.barcodeInfo(code); }
  /** A new product from a scanned barcode (from Goods in). */
  @Post() @RequirePermissions("PRODUCTS:CREATE", "GOODS_RECEIVING:CREATE")
  create(@CurrentUser() u: AuthUser, @Body() dto: QuickProductDto) { return this.svc.create(u, dto); }
  /** "We already have it": the scanned barcode is added to an existing product. */
  @Post("attach") @RequirePermissions("PRODUCTS:UPDATE", "GOODS_RECEIVING:CREATE", "STOCK_TRANSFERS:UPDATE")
  attach(@CurrentUser() u: AuthUser, @Body() dto: AttachBarcodeDto) { return this.svc.attach(u, dto); }
  @Get("needs-price") @RequirePermissions("PRODUCTS:READ")
  needsPrice(@CurrentUser() u: AuthUser) { return this.svc.waitingForPrice(u); }
}
