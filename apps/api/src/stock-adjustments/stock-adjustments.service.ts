import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { CreateStockAdjustmentDto } from "./dto/create-stock-adjustment.dto";

@Injectable()
export class StockAdjustmentsService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  list(organizationId: string) {
    return this.prisma.stockMovement.findMany({
      where:{ organizationId, type:"ADJUSTMENT" },
      include:{ product:{select:{id:true,name:true,sku:true}}, branch:{select:{id:true,name:true}}, user:{select:{id:true,name:true}} },
      orderBy:{createdAt:"desc"},
      take:200
    });
  }

  async create(organizationId: string, userId: string, dto: CreateStockAdjustmentDto) {
    const product = await this.prisma.product.findFirst({ where:{id:dto.productId,organizationId} });
    if(!product) throw new NotFoundException("Product not found in this organization");
    const branch = await this.prisma.branch.findFirst({ where:{id:dto.branchId,organizationId} });
    if(!branch) throw new NotFoundException("Branch not found in this organization");

    if(dto.quantityDelta < 0) {
      const current = await this.prisma.inventory.findUnique({ where:{ productId_branchId:{productId:dto.productId,branchId:dto.branchId} } });
      const currentQty = current?.quantity ?? 0;
      if(currentQty + dto.quantityDelta < 0) {
        throw new BadRequestException(`Cannot reduce stock by ${Math.abs(dto.quantityDelta)} — only ${currentQty} units of "${product.name}" available at ${branch.name}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      return this.inventory.adjustStock(tx, {
        organizationId, productId:dto.productId, branchId:dto.branchId,
        type:"ADJUSTMENT", quantityDelta:dto.quantityDelta,
        referenceType:"StockAdjustment", userId, notes:dto.reason
      });
    });
  }
}
