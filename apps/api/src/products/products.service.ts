import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

const productInclude = {
  categoryRef:{select:{id:true,name:true}},
  brand:{select:{id:true,name:true}},
  unit:{select:{id:true,name:true}}
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, lowStockOnly?: boolean) {
    const products = await this.prisma.product.findMany({ where:{organizationId}, orderBy:{name:"asc"}, include:productInclude });
    if(!lowStockOnly) return products;
    return products.filter(p => p.stockQuantity <= p.reorderLevel);
  }

  async get(organizationId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where:{id,organizationId}, include:productInclude });
    if(!product) throw new NotFoundException("Product not found");
    return product;
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

  async create(organizationId: string, dto: CreateProductDto) {
    await this.assertRefsBelongToOrg(organizationId, dto);
    const existing = await this.prisma.product.findFirst({ where:{organizationId,sku:dto.sku} });
    if(existing) throw new ConflictException(`SKU "${dto.sku}" already exists`);
    return this.prisma.product.create({ data:{ ...dto, organizationId }, include:productInclude });
  }

  async update(organizationId: string, id: string, dto: UpdateProductDto) {
    await this.get(organizationId, id);
    await this.assertRefsBelongToOrg(organizationId, dto);
    if(dto.sku) {
      const existing = await this.prisma.product.findFirst({ where:{organizationId,sku:dto.sku,NOT:{id}} });
      if(existing) throw new ConflictException(`SKU "${dto.sku}" already exists`);
    }
    return this.prisma.product.update({ where:{id}, data:dto, include:productInclude });
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    const saleItemCount = await this.prisma.saleItem.count({ where:{productId:id} });
    if(saleItemCount > 0) throw new ConflictException("Cannot delete a product that has sales history");
    await this.prisma.product.delete({ where:{id} });
    return { deleted:true };
  }
}
