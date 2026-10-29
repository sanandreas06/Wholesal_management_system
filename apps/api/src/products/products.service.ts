import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { reservedAt } from "../releases/reserved";
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
  private async cleanBarcodes(organizationId: string, codes: string[] | undefined, exceptId?: string) {
    if (codes === undefined) return undefined;
    const clean = [...new Set(codes.map(c => c.trim()).filter(Boolean))];
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
    const c = (code ?? "").trim();
    if (!c) throw new NotFoundException("No barcode was read.");
    // a WHOLESTRA item label: that exact item (it must still be on the shelf to be sold or sent)
    const item = /^w/i.test(c) && c.length === 10 ? await this.prisma.stockItem.findFirst({ where:{ organizationId, code: c.toUpperCase() }, select:{ code:true, status:true, branchId:true, productId:true } }) : null;
    let product = item ? await this.prisma.product.findFirst({ where:{ id: item.productId, organizationId }, include:productInclude })
      : await this.prisma.product.findFirst({ where:{ organizationId, barcodes:{ has: c } }, include:productInclude })
        ?? await this.prisma.product.findFirst({ where:{ organizationId, sku:{ equals: c, mode:"insensitive" } }, include:productInclude });
    if (!product) throw new NotFoundException(`No product has the barcode ${c}. Add it to the product first.`);
    if (branchId) [product] = await this.atBranch(organizationId, branchId, [product]);
    const out = scrub(product, canSeeCost);
    return item ? { ...out, item: { code: item.code, status: item.status, here: !branchId || item.branchId === branchId } } : out;
  }

  async create(organizationId: string, dto: CreateProductDto, canSeeCost = false) {
    if(dto.costPrice !== undefined && !canSeeCost) throw new ForbiddenException("You do not have permission to set cost prices");
    await this.assertRefsBelongToOrg(organizationId, dto);
    const existing = await this.prisma.product.findFirst({ where:{organizationId,sku:dto.sku} });
    if(existing) throw new ConflictException(`SKU "${dto.sku}" already exists`);
    dto = { ...dto, barcodes: await this.cleanBarcodes(organizationId, dto.barcodes) };
    return scrub(await this.prisma.product.create({ data:{ ...dto, imageUrl: dto.imageUrl || null, imageThumb: dto.imageThumb || null, organizationId }, include:productInclude, omit:{imageUrl:true} }), canSeeCost);
  }

  async update(organizationId: string, id: string, dto: UpdateProductDto, canSeeCost = false) {
    if(dto.costPrice !== undefined && !canSeeCost) throw new ForbiddenException("You do not have permission to set cost prices");
    await this.get(organizationId, id);
    await this.assertRefsBelongToOrg(organizationId, dto);
    if(dto.sku) {
      const existing = await this.prisma.product.findFirst({ where:{organizationId,sku:dto.sku,NOT:{id}} });
      if(existing) throw new ConflictException(`SKU "${dto.sku}" already exists`);
    }
    dto = { ...dto, barcodes: await this.cleanBarcodes(organizationId, dto.barcodes, id) };
    const { imageUrl, imageThumb, ...rest } = dto;
    return scrub(await this.prisma.product.update({ where:{id}, data:{ ...rest, ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}), ...(imageThumb !== undefined ? { imageThumb: imageThumb || null } : {}) }, include:productInclude, omit:{imageUrl:true} }), canSeeCost);
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    const saleItemCount = await this.prisma.saleItem.count({ where:{productId:id} });
    if(saleItemCount > 0) throw new ConflictException("Cannot delete a product that has sales history");
    await this.prisma.product.delete({ where:{id} });
    return { deleted:true };
  }
}
