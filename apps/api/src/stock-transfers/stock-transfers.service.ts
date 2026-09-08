import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { CreateStockTransferDto } from "./dto/create-stock-transfer.dto";

const transferInclude = {
  fromBranch:{select:{id:true,name:true}},
  toBranch:{select:{id:true,name:true}},
  createdBy:{select:{id:true,name:true}},
  items:{include:{product:{select:{id:true,name:true,sku:true}}}}
};

@Injectable()
export class StockTransfersService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  list(organizationId: string) {
    return this.prisma.stockTransfer.findMany({ where:{organizationId}, orderBy:{createdAt:"desc"}, include:transferInclude });
  }

  async get(organizationId: string, id: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({ where:{id,organizationId}, include:transferInclude });
    if(!transfer) throw new NotFoundException("Stock transfer not found");
    return transfer;
  }

  private async nextTransferNumber(organizationId: string) {
    const count = await this.prisma.stockTransfer.count({ where:{organizationId} });
    return `ST-${String(count + 1).padStart(5,"0")}`;
  }

  async create(organizationId: string, userId: string, dto: CreateStockTransferDto) {
    if(dto.fromBranchId === dto.toBranchId) throw new BadRequestException("Source and destination branch must be different");

    const fromBranch = await this.prisma.branch.findFirst({ where:{id:dto.fromBranchId,organizationId} });
    if(!fromBranch) throw new NotFoundException("Source branch not found in this organization");
    const toBranch = await this.prisma.branch.findFirst({ where:{id:dto.toBranchId,organizationId} });
    if(!toBranch) throw new NotFoundException("Destination branch not found in this organization");

    const productIds = dto.items.map(i => i.productId);
    const products = await this.prisma.product.findMany({ where:{id:{in:productIds},organizationId} });
    if(products.length !== new Set(productIds).size) throw new NotFoundException("One or more products not found in this organization");

    const transferNumber = await this.nextTransferNumber(organizationId);

    return this.prisma.stockTransfer.create({
      data:{
        organizationId, fromBranchId:dto.fromBranchId, toBranchId:dto.toBranchId, transferNumber,
        notes: dto.notes, createdByUserId: userId,
        items:{ create: dto.items.map(i => ({ productId:i.productId, quantity:i.quantity })) }
      },
      include:transferInclude
    });
  }

  async approve(organizationId: string, id: string, userId: string) {
    const transfer = await this.get(organizationId, id);
    if(transfer.status !== "DRAFT") throw new ConflictException("Only DRAFT transfers can be approved");
    return this.prisma.stockTransfer.update({ where:{id}, data:{status:"APPROVED", approvedByUserId:userId, approvedAt:new Date()}, include:transferInclude });
  }

  async dispatch(organizationId: string, id: string, userId: string) {
    const transfer = await this.get(organizationId, id);
    if(transfer.status !== "APPROVED") throw new ConflictException("Only APPROVED transfers can be dispatched");

    // Verify sufficient stock exists at the source branch for every item before moving anything
    for(const item of transfer.items) {
      const inv = await this.prisma.inventory.findUnique({ where:{ productId_branchId:{productId:item.productId,branchId:transfer.fromBranchId} } });
      const available = inv?.quantity ?? 0;
      if(available < item.quantity) {
        throw new BadRequestException(`Cannot dispatch ${item.quantity} units of "${item.product.name}" — only ${available} available at ${transfer.fromBranch.name}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      for(const item of transfer.items) {
        await this.inventory.adjustStock(tx, {
          organizationId, productId:item.productId, branchId:transfer.fromBranchId,
          type:"TRANSFER_OUT", quantityDelta: -item.quantity,
          referenceType:"StockTransfer", referenceId:transfer.id, userId,
          notes: `Dispatched to ${transfer.toBranch.name} (${transfer.transferNumber})`
        });
      }
      return tx.stockTransfer.update({ where:{id}, data:{status:"DISPATCHED", dispatchedByUserId:userId, dispatchedAt:new Date()}, include:transferInclude });
    });
  }

  async receive(organizationId: string, id: string, userId: string) {
    const transfer = await this.get(organizationId, id);
    if(transfer.status !== "DISPATCHED") throw new ConflictException("Only DISPATCHED transfers can be received");

    return this.prisma.$transaction(async (tx) => {
      for(const item of transfer.items) {
        await this.inventory.adjustStock(tx, {
          organizationId, productId:item.productId, branchId:transfer.toBranchId,
          type:"TRANSFER_IN", quantityDelta: item.quantity,
          referenceType:"StockTransfer", referenceId:transfer.id, userId,
          notes: `Received from ${transfer.fromBranch.name} (${transfer.transferNumber})`
        });
      }
      return tx.stockTransfer.update({ where:{id}, data:{status:"RECEIVED", receivedByUserId:userId, receivedAt:new Date()}, include:transferInclude });
    });
  }

  async cancel(organizationId: string, id: string) {
    const transfer = await this.get(organizationId, id);
    if(transfer.status === "DISPATCHED" || transfer.status === "RECEIVED") {
      throw new ConflictException("Cannot cancel a transfer that has already been dispatched — stock is in transit");
    }
    return this.prisma.stockTransfer.update({ where:{id}, data:{status:"CANCELLED"}, include:transferInclude });
  }
}
