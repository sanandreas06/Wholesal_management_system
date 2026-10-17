import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
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
    return rows.map(r => ({ ...r, stockQuantity: qty.get(r.id) ?? 0 }));
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

  async create(organizationId: string, dto: CreateProductDto, canSeeCost = false) {
    if(dto.costPrice !== undefined && !canSeeCost) throw new ForbiddenException("You do not have permission to set cost prices");
    await this.assertRefsBelongToOrg(organizationId, dto);
    const existing = await this.prisma.product.findFirst({ where:{organizationId,sku:dto.sku} });
    if(existing) throw new ConflictException(`SKU "${dto.sku}" already exists`);
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
