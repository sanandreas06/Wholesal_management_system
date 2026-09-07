import { Injectable } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AdjustStockParams {
  organizationId: string;
  productId: string;
  branchId: string;
  type: StockMovementType;
  quantityDelta: number; // positive to increase, negative to decrease
  referenceType?: string;
  referenceId?: string;
  userId?: string;
  notes?: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The single path every stock-changing feature should go through:
   * goods receiving, adjustments, transfers, sales (later).
   * Must be called with a transaction client so it composes safely
   * into a larger atomic operation (e.g. goods receiving also updates
   * a PurchaseOrderItem in the same transaction).
   */
  async adjustStock(tx: Prisma.TransactionClient, params: AdjustStockParams) {
    const inventory = await tx.inventory.upsert({
      where:{ productId_branchId:{ productId:params.productId, branchId:params.branchId } },
      update:{ quantity:{ increment: params.quantityDelta } },
      create:{ organizationId:params.organizationId, productId:params.productId, branchId:params.branchId, quantity: Math.max(params.quantityDelta,0) }
    });

    await tx.stockMovement.create({
      data:{
        organizationId: params.organizationId,
        productId: params.productId,
        branchId: params.branchId,
        type: params.type,
        quantityDelta: params.quantityDelta,
        resultingQuantity: inventory.quantity,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        userId: params.userId,
        notes: params.notes
      }
    });

    // Keep Product.stockQuantity as a maintained aggregate across all branches,
    // so existing Products UI/API (built before branch-level tracking existed)
    // keeps working without changes.
    await tx.product.update({ where:{id:params.productId}, data:{ stockQuantity:{ increment: params.quantityDelta } } });

    return inventory;
  }

  list(organizationId: string, branchId?: string) {
    return this.prisma.inventory.findMany({
      where:{ organizationId, ...(branchId ? {branchId} : {}) },
      include:{ product:{select:{id:true,name:true,sku:true,reorderLevel:true}}, branch:{select:{id:true,name:true}} },
      orderBy:[{branch:{name:"asc"}},{product:{name:"asc"}}]
    });
  }

  async lowStock(organizationId: string, branchId?: string) {
    const rows = await this.list(organizationId, branchId);
    return rows.filter(r => r.quantity <= r.product.reorderLevel);
  }

  movements(organizationId: string, filters: { productId?: string; branchId?: string }) {
    return this.prisma.stockMovement.findMany({
      where:{ organizationId, ...(filters.productId ? {productId:filters.productId} : {}), ...(filters.branchId ? {branchId:filters.branchId} : {}) },
      include:{ product:{select:{id:true,name:true,sku:true}}, branch:{select:{id:true,name:true}}, user:{select:{id:true,name:true}} },
      orderBy:{createdAt:"desc"},
      take:200
    });
  }
}
