import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { CreateStockCountDto } from "./dto/create-stock-count.dto";
import { UpdateStockCountItemsDto } from "./dto/update-stock-count-items.dto";

const countInclude = {
  branch:{select:{id:true,name:true}},
  createdBy:{select:{id:true,name:true}},
  items:{include:{product:{select:{id:true,name:true,sku:true}}}}
};

@Injectable()
export class StockCountsService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  list(organizationId: string) {
    return this.prisma.stockCount.findMany({ where:{organizationId}, orderBy:{createdAt:"desc"}, include:countInclude });
  }

  async get(organizationId: string, id: string) {
    const count = await this.prisma.stockCount.findFirst({ where:{id,organizationId}, include:countInclude });
    if(!count) throw new NotFoundException("Stock count not found");
    return count;
  }

  private async nextCountNumber(organizationId: string) {
    const total = await this.prisma.stockCount.count({ where:{organizationId} });
    return `SC-${String(total + 1).padStart(5,"0")}`;
  }

  async create(organizationId: string, userId: string, dto: CreateStockCountDto) {
    const branch = await this.prisma.branch.findFirst({ where:{id:dto.branchId,organizationId} });
    if(!branch) throw new NotFoundException("Branch not found in this organization");

    // Snapshot: every product in the org, with its current system quantity at this branch (0 if no inventory row yet)
    const products = await this.prisma.product.findMany({ where:{organizationId} });
    const inventories = await this.prisma.inventory.findMany({ where:{organizationId,branchId:dto.branchId} });
    const qtyByProduct = new Map(inventories.map(i => [i.productId, i.quantity]));

    const countNumber = await this.nextCountNumber(organizationId);

    return this.prisma.stockCount.create({
      data:{
        organizationId, branchId:dto.branchId, countNumber, notes:dto.notes, createdByUserId:userId,
        items:{ create: products.map(p => ({ productId:p.id, systemQuantity: qtyByProduct.get(p.id) ?? 0 })) }
      },
      include:countInclude
    });
  }

  async updateItems(organizationId: string, id: string, dto: UpdateStockCountItemsDto) {
    const count = await this.get(organizationId, id);
    if(count.status !== "DRAFT") throw new ConflictException("Only DRAFT counts can be updated");

    const itemIds = new Set(count.items.map(i => i.id));
    for(const update of dto.items) {
      if(!itemIds.has(update.itemId)) throw new NotFoundException(`Item ${update.itemId} does not belong to this count`);
    }

    await this.prisma.$transaction(
      dto.items.map(u => this.prisma.stockCountItem.update({ where:{id:u.itemId}, data:{countedQuantity:u.countedQuantity} }))
    );

    return this.get(organizationId, id);
  }

  async complete(organizationId: string, id: string, userId: string) {
    const count = await this.get(organizationId, id);
    if(count.status !== "DRAFT") throw new ConflictException("Only DRAFT counts can be completed");

    const uncounted = count.items.filter(i => i.countedQuantity === null);
    if(uncounted.length > 0) {
      throw new BadRequestException(`${uncounted.length} item(s) still need a counted quantity before this count can be completed`);
    }

    return this.prisma.$transaction(async (tx) => {
      for(const item of count.items) {
        const delta = item.countedQuantity! - item.systemQuantity;
        if(delta === 0) continue; // no variance, nothing to record
        await this.inventory.adjustStock(tx, {
          organizationId, productId:item.productId, branchId:count.branchId,
          type:"COUNT_VARIANCE", quantityDelta:delta,
          referenceType:"StockCount", referenceId:count.id, userId,
          notes:`Count ${count.countNumber}: system ${item.systemQuantity}, counted ${item.countedQuantity}`
        });
      }
      return tx.stockCount.update({ where:{id}, data:{status:"COMPLETED", completedByUserId:userId, completedAt:new Date()}, include:countInclude });
    });
  }

  async cancel(organizationId: string, id: string) {
    const count = await this.get(organizationId, id);
    if(count.status !== "DRAFT") throw new ConflictException("Only DRAFT counts can be cancelled");
    return this.prisma.stockCount.update({ where:{id}, data:{status:"CANCELLED"}, include:countInclude });
  }
}
