import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";
import { TrackingService } from "../tracking/tracking.service";

const poInclude = {
  supplier:{select:{id:true,name:true,code:true}},
  branch:{select:{id:true,name:true}},
  items:{include:{product:{select:{id:true,name:true,sku:true}}}},
  receipts:{include:{items:true}}
};

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService, private readonly tracking: TrackingService) {}

  list(organizationId: string, branchId?: string) {
    return this.prisma.purchaseOrder.findMany({ where:{organizationId, ...(branchId ? {branchId} : {})}, orderBy:{orderDate:"desc"}, include:poInclude });
  }

  async get(organizationId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where:{id,organizationId}, include:poInclude });
    if(!po) throw new NotFoundException("Purchase order not found");
    return po;
  }

  private async nextOrderNumber(organizationId: string) {
    const count = await this.prisma.purchaseOrder.count({ where:{organizationId} });
    return `PO-${String(count + 1).padStart(5,"0")}`;
  }

  async create(organizationId: string, dto: CreatePurchaseOrderDto) {
    const supplier = await this.prisma.supplier.findFirst({ where:{id:dto.supplierId,organizationId} });
    if(!supplier) throw new NotFoundException("Supplier not found in this organization");
    const branch = await this.prisma.branch.findFirst({ where:{id:dto.branchId,organizationId} });
    if(!branch) throw new NotFoundException("Branch not found in this organization");

    const productIds = dto.items.map(i => i.productId);
    const products = await this.prisma.product.findMany({ where:{id:{in:productIds},organizationId} });
    if(products.length !== new Set(productIds).size) throw new NotFoundException("One or more products not found in this organization");

    const orderNumber = await this.nextOrderNumber(organizationId);

    return this.prisma.purchaseOrder.create({
      data:{
        organizationId, supplierId:dto.supplierId, branchId:dto.branchId, orderNumber,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        notes: dto.notes,
        items:{ create: dto.items.map(i => ({ productId:i.productId, quantityOrdered:i.quantityOrdered, unitCost:i.unitCost })) }
      },
      include:poInclude
    });
  }

  async update(organizationId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const po = await this.get(organizationId, id);
    if(dto.items && po.status !== "DRAFT") throw new ConflictException("Items can only be edited while the order is in DRAFT status");

    if(dto.items) {
      const productIds = dto.items.map(i => i.productId);
      const products = await this.prisma.product.findMany({ where:{id:{in:productIds},organizationId} });
      if(products.length !== new Set(productIds).size) throw new NotFoundException("One or more products not found in this organization");

      await this.prisma.$transaction([
        this.prisma.purchaseOrderItem.deleteMany({ where:{purchaseOrderId:id} }),
        this.prisma.purchaseOrderItem.createMany({ data: dto.items.map(i => ({ purchaseOrderId:id, productId:i.productId, quantityOrdered:i.quantityOrdered, unitCost:i.unitCost })) })
      ]);
    }

    return this.prisma.purchaseOrder.update({
      where:{id},
      data:{ expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined, notes: dto.notes },
      include:poInclude
    });
  }

  async send(organizationId: string, id: string) {
    const po = await this.get(organizationId, id);
    if(po.status !== "DRAFT") throw new ConflictException("Only DRAFT orders can be sent");
    return this.prisma.purchaseOrder.update({ where:{id}, data:{status:"SENT"}, include:poInclude });
  }

  async cancel(organizationId: string, id: string) {
    const po = await this.get(organizationId, id);
    if(po.status === "RECEIVED" || po.status === "CLOSED") throw new ConflictException("Cannot cancel an order that has already been received or closed");
    if(po.items.some(i => i.quantityReceived > 0)) throw new ConflictException("Cannot cancel an order that has partial receipts — close it instead");
    return this.prisma.purchaseOrder.update({ where:{id}, data:{status:"CANCELLED"}, include:poInclude });
  }

  async remove(organizationId: string, id: string) {
    const po = await this.get(organizationId, id);
    if(po.status !== "DRAFT") throw new ConflictException("Only DRAFT orders can be deleted");
    await this.prisma.purchaseOrder.delete({ where:{id} });
    return { deleted:true };
  }

  async receive(organizationId: string, id: string, userId: string, dto: CreateGoodsReceiptDto) {
    const po = await this.get(organizationId, id);
    if(po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
      throw new ConflictException("Only SENT or PARTIALLY_RECEIVED orders can receive goods");
    }

    const poItemsById = new Map(po.items.map(i => [i.id, i]));

    for(const line of dto.items) {
      const poItem = poItemsById.get(line.purchaseOrderItemId);
      if(!poItem) throw new NotFoundException(`Purchase order item ${line.purchaseOrderItemId} not found on this order`);
      const remaining = poItem.quantityOrdered - poItem.quantityReceived;
      if(line.quantityReceived > remaining) {
        throw new BadRequestException(`Cannot receive ${line.quantityReceived} units of "${poItem.product.name}" — only ${remaining} remain on this order`);
      }
    }

    // scanning: every line must say how many were scanned; anything less than all is questioned (with a reason)
    const info = new Map((await this.prisma.product.findMany({ where:{ id:{ in: dto.items.map(l => poItemsById.get(l.purchaseOrderItemId)!.productId) } }, select:{ id:true, trackItems:true, barcodes:true, ownCode:true } })).map(p => [p.id, p]));
    const tracked = new Set([...info.values()].filter(p => p.trackItems).map(p => p.id));
    const counted = dto.items.map(line => { const it = poItemsById.get(line.purchaseOrderItemId)!, p = info.get(it.productId); return { name: it.product.name, quantity: line.quantityReceived, scanned: dto.byScan ? (line.scannedCount ?? 0) : 0, exempt: !!p && !p.barcodes.some(b => b !== p.ownCode) && !p.trackItems }; }); // no WHOLESTRA label on arriving goods yet
    const byScan = TrackingService.scannedAll(counted);
    const reason = byScan ? undefined : TrackingService.needReason(dto.reason ?? (dto.byScan ? undefined : "Received on the purchase order screen without scanning"));

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data:{
          organizationId, purchaseOrderId:id, receivedByUserId:userId, byScan,
          supplierInvoiceNumber: dto.supplierInvoiceNumber, supplierInvoiceAmount: dto.supplierInvoiceAmount, notes: dto.notes,
          items:{ create: dto.items.map(line => {
            const poItem = poItemsById.get(line.purchaseOrderItemId)!;
            return { purchaseOrderItemId: line.purchaseOrderItemId, productId: poItem.productId, quantityReceived: line.quantityReceived, unitCost: line.unitCost ?? poItem.unitCost, scannedCount: dto.byScan ? (line.scannedCount ?? 0) : null };
          }) }
        },
        include:{items:true}
      });
      const labels: Record<string, string[]> = {};

      for(const line of dto.items) {
        const poItem = poItemsById.get(line.purchaseOrderItemId)!;
        await tx.purchaseOrderItem.update({ where:{id:line.purchaseOrderItemId}, data:{ quantityReceived:{increment:line.quantityReceived} } });
        // keep a weighted-average cost so margin reflects what stock actually cost
        const prod = await tx.product.findUniqueOrThrow({ where:{id:poItem.productId}, select:{ stockQuantity:true, costPrice:true } });
        const paid = Number(line.unitCost ?? poItem.unitCost);
        const held = Math.max(0, prod.stockQuantity);
        const newCost = prod.costPrice !== null && held > 0
          ? (held * Number(prod.costPrice) + line.quantityReceived * paid) / (held + line.quantityReceived)
          : paid;
        await tx.product.update({ where:{id:poItem.productId}, data:{ costPrice: Math.round(newCost * 100) / 100 } });
        await this.inventory.adjustStock(tx, {
          organizationId, productId: poItem.productId, branchId: po.branch.id,
          type: "RECEIPT", quantityDelta: line.quantityReceived,
          referenceType: "GoodsReceipt", referenceId: receipt.id, userId,
          notes: `Received against ${po.orderNumber}${byScan ? " (scanned)" : " (typed by hand)"}`
        });
        if (tracked.has(poItem.productId)) labels[poItem.productId] = [...(labels[poItem.productId] ?? []), ...await this.tracking.labelItems(tx, { organizationId, productId: poItem.productId, branchId: po.branch.id, count: line.quantityReceived, userId, referenceType: "GoodsReceipt", referenceId: receipt.id, note: po.orderNumber })];
      }
      if (!byScan) {
        const missed = TrackingService.missed(counted);
        await this.tracking.raise(tx, { organizationId, branchId: po.branch.id, kind: "NOT_SCANNED_RECEIPT", title: `${po.orderNumber} received without scanning everything`,
          detail: `${missed.join(", ")} were counted by hand at ${po.branch.name}. Reason given: ${reason}`, referenceType: "GoodsReceipt", referenceId: receipt.id, referenceNumber: po.orderNumber, userId });
      }

      const refreshedItems = await tx.purchaseOrderItem.findMany({ where:{purchaseOrderId:id} });
      const allFullyReceived = refreshedItems.every(i => i.quantityReceived >= i.quantityOrdered);
      const someReceived = refreshedItems.some(i => i.quantityReceived > 0);
      const newStatus = allFullyReceived ? "RECEIVED" : someReceived ? "PARTIALLY_RECEIVED" : po.status;

      await tx.purchaseOrder.update({ where:{id}, data:{status:newStatus} });

      return { ...receipt, labels, labelReference: Object.keys(labels).length ? receipt.id : null };
    });
  }
}
