import { randomUUID } from "crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { reservedAt } from "../releases/reserved";
import { codeFromScan, newOwnCode } from "./own-code";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

const productInclude = {
  categoryRef:{select:{id:true,name:true}},
  brand:{select:{id:true,name:true}},
  unit:{select:{id:true,name:true}}
};

/** Cost is commercially sensitive: only people with PROFIT:READ ever receive it. */
function scrub<T extends { costPrice?: unknown }>(p: T, canSeeCost: boolean): T {
  if (canSeeCost) return p;
  const { costPrice: _omit, ...rest } = p;
  return rest as T;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** A person limited to one branch sees that branch's stock on each product, not the total across all branches. */
  private async atBranch<T extends { id: string; stockQuantity: number }>(organizationId: string, branchId: string, rows: T[]): Promise<T[]> {
    const inv: { productId: string; quantity: number }[] = await this.prisma.inventory.findMany({ where:{organizationId, branchId}, select:{productId:true, quantity:true} });
    const qty = new Map<string, number>(inv.map((i): [string, number] => [i.productId, i.quantity]));
    // goods sold but not yet collected are on the shelf but belong to a customer: they are not offered for sale again
    const owed = await reservedAt(this.prisma, organizationId, branchId);
    return rows.map(r => ({ ...r, stockQuantity: Math.max(0, (qty.get(r.id) ?? 0) - (owed.get(r.id) ?? 0)), ...(owed.get(r.id) ? { reserved: owed.get(r.id) } : {}) }));
  }

  async list(organizationId: string, lowStockOnly?: boolean, canSeeCost = false, branchScope: string | null = null) {
    // pictures are left out of the list (they would make it heavy); the product's own page and the Home screen carry them
    let all = await this.prisma.product.findMany({ where:{organizationId}, orderBy:{name:"asc"}, include:productInclude, omit:{imageUrl:true} });
    if(branchScope) all = await this.atBranch(organizationId, branchScope, all);
    const products = all.map(p => scrub(p, canSeeCost));
    if(!lowStockOnly) return products;
    return products.filter(p => p.stockQuantity <= p.reorderLevel);
  }

  async get(organizationId: string, id: string, canSeeCost = false, branchScope: string | null = null) {
    let product = await this.prisma.product.findFirst({ where:{id,organizationId}, include:productInclude, omit:{imageUrl:false} });
    if(!product) throw new NotFoundException("Product not found");
    if(branchScope) [product] = await this.atBranch(organizationId, branchScope, [product]);
    return scrub(product, canSeeCost);
  }

  /** A category or brand chosen by name (from the ready-made list or typed): found, or made for the company. */
  private async refByName(kind: "category" | "brand", organizationId: string, raw: string | undefined): Promise<string | null | undefined> {
    if (raw === undefined) return undefined;
    const name = raw.replace(/\s+/g, " ").trim();
    if (!name) return null;
    const model = (kind === "category" ? this.prisma.category : this.prisma.brand) as unknown as {
      findFirst(a: object): Promise<{ id: string } | null>; create(a: object): Promise<{ id: string }>;
    };
    const found = await model.findFirst({ where: { organizationId, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    if (found) return found.id;
    const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "ITEM";
    for (let i = 0; i < 20; i++) {
      const code = i ? `${base}-${i + 1}` : base;
      if (!await model.findFirst({ where: { organizationId, code }, select: { id: true } })) return (await model.create({ data: { organizationId, name, code }, select: { id: true } })).id;
    }
    throw new ConflictException(`Could not save the ${kind} "${name}". Try again.`);
  }

  /** categoryName / brandName become the ids the product stores (and replace any id sent alongside). */
  private async namesToRefs<T extends { categoryName?: string; brandName?: string; categoryId?: string; brandId?: string }>(organizationId: string, dto: T) {
    const { categoryName, brandName, ...rest } = dto;
    const out: Record<string, unknown> = { ...rest };
    const c = await this.refByName("category", organizationId, categoryName);
    if (c !== undefined) { out.categoryId = c; out.category = categoryName!.trim() || null; }
    const b = await this.refByName("brand", organizationId, brandName);
    if (b !== undefined) out.brandId = b;
    return out as Omit<T, "categoryName" | "brandName"> & { categoryId?: string | null; brandId?: string | null; category?: string | null };
  }

  private async assertRefsBelongToOrg(organizationId: string, dto: { categoryId?: string; brandId?: string; unitId?: string }) {
    if(dto.categoryId) {
      const c = await this.prisma.category.findFirst({ where:{id:dto.categoryId,organizationId} });
      if(!c) throw new NotFoundException("Category not found in this organization");
    }
    if(dto.brandId) {
      const b = await this.prisma.brand.findFirst({ where:{id:dto.brandId,organizationId} });
      if(!b) throw new NotFoundException("Brand not found in this organization");
    }
    if(dto.unitId) {
      const u = await this.prisma.unit.findFirst({ where:{id:dto.unitId,organizationId} });
      if(!u) throw new NotFoundException("Unit not found in this organization");
    }
  }

  /** Clean barcodes (trimmed, no repeats) and make sure no other product in the company already uses one of them. */
  private async cleanBarcodes(organizationId: string, codes: string[] | undefined, exceptId?: string, keep?: string | null) {
    if (codes === undefined) return undefined;
    // the product's own WHOLESTRA code always stays first: it is printed on its labels and can never be removed
    const clean = [...new Set([...(keep ? [keep] : []), ...codes.map(c => c.trim()).filter(Boolean)])];
    if (clean.length > 11) throw new BadRequestException("A product can have up to 10 barcodes besides its own WHOLESTRA code.");
    if (!clean.length) return clean;
    const clash = await this.prisma.product.findFirst({ where:{ organizationId, barcodes:{ hasSome: clean }, ...(exceptId ? { NOT:{ id: exceptId } } : {}) }, select:{ name:true, barcodes:true } });
    if (clash) {
      const code = clean.find(c => clash.barcodes.includes(c));
      throw new ConflictException(`Barcode ${code} is already on "${clash.name}". One barcode can only belong to one product.`);
    }
    return clean;
  }

  /** Finds the product a scanned barcode belongs to: one of its barcodes, or its SKU (for WHOLESTRA labels printed from the SKU). */
  async lookup(organizationId: string, code: string, branchId: string | null, canSeeCost = false) {
    const c = codeFromScan(code);
    if (!c) throw new NotFoundException("No barcode was read.");
    // a WHOLESTRA item label: that exact item (it must still be on the shelf to be sold or sent)
    const item = /^w/i.test(c) && c.length === 10 ? await this.prisma.stockItem.findFirst({ where:{ organizationId, code: c.toUpperCase() }, select:{ code:true, status:true, branchId:true, productId:true } }) : null;
    const itemBranch = item?.branchId ? (await this.prisma.branch.findUnique({ where:{ id:item.branchId }, select:{ name:true } }))?.name ?? null : null;
    let product = item ? await this.prisma.product.findFirst({ where:{ id: item.productId, organizationId }, include:productInclude })
      : await this.prisma.product.findFirst({ where:{ organizationId, barcodes:{ has: c } }, include:productInclude })
        ?? await this.prisma.product.findFirst({ where:{ organizationId, sku:{ equals: c, mode:"insensitive" } }, include:productInclude });
    if (!product) throw new NotFoundException(`No product has the barcode ${c}. Add it to the product first.`);
    if (branchId) [product] = await this.atBranch(organizationId, branchId, [product]);
    const out = scrub(product, canSeeCost);
    return item ? { ...out, item: { code: item.code, status: item.status, here: !branchId || item.branchId === branchId, branch: itemBranch } } : out;
  }

  async create(organizationId: string, dto: CreateProductDto, canSeeCost = false) {
    if(dto.costPrice !== undefined && !canSeeCost) throw new ForbiddenException("You do not have permission to set cost prices");
    await this.assertRefsBelongToOrg(organizationId, dto);
    if (dto.variants?.length) return this.createTypes(organizationId, dto, canSeeCost);
    const { variants: _v, ...plain } = dto; void _v;
    dto = await this.namesToRefs(organizationId, plain) as CreateProductDto;
    const existing = await this.prisma.product.findFirst({ where:{organizationId,sku:dto.sku} });
    if(existing) throw new ConflictException(`SKU "${dto.sku}" already exists`);
    // every new product gets its own permanent code, printed on its labels
    const ownCode = await newOwnCode(this.prisma, organizationId);
    // "every item gets its own label" switched on for the company: new products too, unless the form says otherwise
    if (dto.trackItems === undefined) dto = { ...dto, trackItems: (await this.prisma.organization.findUnique({ where:{ id: organizationId }, select:{ trackAllItems:true } }))?.trackAllItems ?? false };
    dto = { ...dto, barcodes: await this.cleanBarcodes(organizationId, dto.barcodes ?? [], undefined, ownCode) };
    return scrub(await this.prisma.product.create({ data:{ ...dto, ownCode, imageUrl: dto.imageUrl || null, imageThumb: dto.imageThumb || null, organizationId }, include:productInclude, omit:{imageUrl:true} }), canSeeCost);
  }

  async update(organizationId: string, id: string, dto: UpdateProductDto, canSeeCost = false) {
    if(dto.costPrice !== undefined && !canSeeCost) throw new ForbiddenException("You do not have permission to set cost prices");
    const current = await this.get(organizationId, id) as { ownCode?: string | null };
    await this.assertRefsBelongToOrg(organizationId, dto);
    { const { variants: _v, ...plain } = dto as UpdateProductDto & { variants?: unknown }; void _v; dto = await this.namesToRefs(organizationId, plain) as UpdateProductDto; }
    if(dto.sku) {
      const existing = await this.prisma.product.findFirst({ where:{organizationId,sku:dto.sku,NOT:{id}} });
      if(existing) throw new ConflictException(`SKU "${dto.sku}" already exists`);
    }
    dto = { ...dto, barcodes: await this.cleanBarcodes(organizationId, dto.barcodes, id, current.ownCode) };
    const { imageUrl, imageThumb, ...rest } = dto;
    // setting a selling price on a product the store added while scanning makes it sellable
    return scrub(await this.prisma.product.update({ where:{id}, data:{ ...rest, ...(rest.unitPrice !== undefined && rest.unitPrice > 0 ? { needsPrice:false } : {}), ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}), ...(imageThumb !== undefined ? { imageThumb: imageThumb || null } : {}) }, include:productInclude, omit:{imageUrl:true} }), canSeeCost);
  }

  /**
   * One product in several types (a diffuser in Gardenia, Lilac, Coffee and Wild Flower): each type is its own product, with its own
   * stock, code and labels, so it is counted, sold and tracked on its own; they share a group, a brand, a category and the main name.
   */
  private async createTypes(organizationId: string, dto: CreateProductDto, canSeeCost: boolean) {
    const { variants = [], ...base } = dto;
    const names = variants.map(v => v.name.replace(/\s+/g, " ").trim());
    const dup = names.find((n, i) => names.findIndex(m => m.toLowerCase() === n.toLowerCase()) !== i);
    if (dup) throw new BadRequestException(`The type "${dup}" is listed twice.`);
    const groupId = randomUUID();
    const refs = await this.namesToRefs(organizationId, { categoryName: base.categoryName, brandName: base.brandName, categoryId: base.categoryId, brandId: base.brandId });
    const trackItems = base.trackItems ?? (await this.prisma.organization.findUnique({ where:{ id: organizationId }, select:{ trackAllItems:true } }))?.trackAllItems ?? false;
    const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "T";
    const skus = variants.map((v, i) => (v.sku?.trim() || `${base.sku}-${slug(names[i])}`).toUpperCase());
    const clashSku = skus.find((s, i) => skus.indexOf(s) !== i);
    if (clashSku) throw new BadRequestException(`Two types would get the code ${clashSku}. Give one of them its own code.`);
    const taken = await this.prisma.product.findFirst({ where:{ organizationId, sku:{ in: skus } }, select:{ sku:true } });
    if (taken) throw new ConflictException(`SKU "${taken.sku}" already exists`);
    const allCodes = variants.flatMap(v => v.barcodes ?? []).map(c => c.trim()).filter(Boolean);
    if (new Set(allCodes).size !== allCodes.length) throw new BadRequestException("The same barcode is on two types. Each type needs its own barcode.");
    if (allCodes.length) await this.cleanBarcodes(organizationId, allCodes);
    const made = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i], ownCode = await newOwnCode(this.prisma, organizationId);
      const p = await this.prisma.product.create({ data: {
        organizationId, groupId, variant: names[i], sku: skus[i], name: `${base.name.trim()} – ${names[i]}`, ownCode,
        barcodes: [ownCode, ...[...new Set((v.barcodes ?? []).map(c => c.trim()).filter(Boolean))]],
        categoryId: refs.categoryId ?? null, category: refs.category ?? null, brandId: refs.brandId ?? null, unitId: base.unitId ?? null,
        unitPrice: v.unitPrice ?? base.unitPrice, ...(base.costPrice !== undefined ? { costPrice: base.costPrice } : {}),
        stockQuantity: v.stockQuantity ?? 0, reorderLevel: base.reorderLevel ?? 10, trackItems,
        imageUrl: base.imageUrl || null, imageThumb: base.imageThumb || null,
      }, include: productInclude, omit:{ imageUrl:true } });
      made.push(scrub(p, canSeeCost));
    }
    return { groupId, products: made };
  }

  /** The other types of a product, and a new type added to it later (copying its brand, category, unit, prices and picture). */
  async types(organizationId: string, id: string) {
    const p = await this.prisma.product.findFirst({ where:{ id, organizationId }, select:{ groupId:true } });
    if (!p) throw new NotFoundException("Product not found");
    if (!p.groupId) return [];
    return this.prisma.product.findMany({ where:{ organizationId, groupId: p.groupId }, select:{ id:true, sku:true, name:true, variant:true, stockQuantity:true, unitPrice:true }, orderBy:{ createdAt:"asc" } });
  }

  async addType(organizationId: string, id: string, dto: { name: string; sku?: string; unitPrice?: number; stockQuantity?: number; barcodes?: string[] }, canSeeCost = false) {
    const src = await this.prisma.product.findFirst({ where:{ id, organizationId }, omit:{ imageUrl:false } });
    if (!src) throw new NotFoundException("Product not found");
    const name = dto.name.replace(/\s+/g, " ").trim();
    let groupId = src.groupId, baseName = src.name;
    if (groupId && src.variant) baseName = src.name.replace(new RegExp(`\\s*–\\s*${src.variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    const siblings = groupId ? await this.prisma.product.findMany({ where:{ organizationId, groupId }, select:{ variant:true } }) : [];
    if (siblings.some(s => s.variant?.toLowerCase() === name.toLowerCase())) throw new ConflictException(`"${baseName}" already has the type "${name}".`);
    const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "T";
    const baseSku = src.variant ? src.sku.replace(/-[A-Z0-9]+$/, "") : src.sku;
    const sku = (dto.sku?.trim() || `${baseSku}-${slug}`).toUpperCase();
    if (await this.prisma.product.findFirst({ where:{ organizationId, sku }, select:{ id:true } })) throw new ConflictException(`SKU "${sku}" already exists`);
    const ownCode = await newOwnCode(this.prisma, organizationId);
    const barcodes = await this.cleanBarcodes(organizationId, dto.barcodes ?? [], undefined, ownCode);
    return this.prisma.$transaction(async (tx) => {
      // the first time: the original product becomes the group's first type, keeping its name with its own type label
      if (!groupId) {
        groupId = randomUUID();
        await tx.product.update({ where:{ id: src.id }, data:{ groupId, variant: "Standard" } });
      }
      const p = await tx.product.create({ data: {
        organizationId, groupId, variant: name, sku, name: `${baseName} – ${name}`, ownCode, barcodes: barcodes ?? [ownCode],
        categoryId: src.categoryId, category: src.category, brandId: src.brandId, unitId: src.unitId,
        unitPrice: dto.unitPrice ?? src.unitPrice, costPrice: src.costPrice, stockQuantity: dto.stockQuantity ?? 0, reorderLevel: src.reorderLevel,
        trackItems: src.trackItems, imageUrl: src.imageUrl, imageThumb: src.imageThumb,
      }, include: productInclude, omit:{ imageUrl:true } });
      return scrub(p, canSeeCost);
    });
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    const saleItemCount = await this.prisma.saleItem.count({ where:{productId:id} });
    if(saleItemCount > 0) throw new ConflictException("Cannot delete a product that has sales history");
    await this.prisma.product.delete({ where:{id} });
    return { deleted:true };
  }
}
