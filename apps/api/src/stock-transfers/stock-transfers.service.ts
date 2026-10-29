import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { CreateStockTransferDto } from "./dto/create-stock-transfer.dto";
import { HandoverDto } from "./dto/handover.dto";
import { TrackingService } from "../tracking/tracking.service";
import { cleanCodes } from "../tracking/codes";
import { reservedAt } from "../releases/reserved";

const transferInclude = {
  fromBranch:{select:{id:true,name:true}},
  toBranch:{select:{id:true,name:true}},
  createdBy:{select:{id:true,name:true}},
  items:{include:{product:{select:{id:true,name:true,sku:true,barcodes:true,trackItems:true}}}}
};

@Injectable()
export class StockTransfersService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService, private readonly tracking: TrackingService) {}

  list(organizationId: string, branchId?: string) {
    return this.prisma.stockTransfer.findMany({ where:{organizationId, ...(branchId ? {OR:[{fromBranchId:branchId},{toBranchId:branchId}]} : {})}, orderBy:{createdAt:"desc"}, include:transferInclude });
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

  /** The counted lines for a handover. Lines left out count as zero; with no lines at all, the full amount is taken as counted by hand. */
  private lines(transfer: Awaited<ReturnType<StockTransfersService["get"]>>, dto: HandoverDto | undefined, max: (i: { quantity: number; sentQuantity: number | null }) => number) {
    const given = new Map((dto?.lines ?? []).map(l => [l.itemId, l]));
    for (const id of given.keys()) if (!transfer.items.some(i => i.id === id)) throw new BadRequestException("A counted line does not belong to this transfer.");
    return transfer.items.map(i => {
      const g = given.get(i.id), cap = max(i);
      const quantity = dto?.lines ? (g?.quantity ?? 0) : cap;
      if (quantity > cap) throw new BadRequestException(`"${i.product.name}": ${quantity} is more than the ${cap} on this transfer.`);
      return { item: i, name: i.product.name, quantity, scanned: g?.scanned ?? 0, codes: cleanCodes(g?.codes), exempt: !i.product.barcodes.length && !i.product.trackItems };
    });
  }

  async dispatch(organizationId: string, id: string, userId: string, dto?: HandoverDto) {
    const transfer = await this.get(organizationId, id);
    if(transfer.status !== "APPROVED") throw new ConflictException("Only APPROVED transfers can be dispatched");
    const lines = this.lines(transfer, dto, i => i.quantity);
    if (!lines.some(l => l.quantity > 0)) throw new BadRequestException("Nothing to send: every line is zero.");
    const byScan = TrackingService.scannedAll(lines);
    const reason = byScan ? undefined : TrackingService.needReason(dto?.reason ?? (dto?.lines ? undefined : "Sent with the old Dispatch button, without scanning"));

    // Verify sufficient stock exists at the source branch for every item before moving anything (goods sold and awaiting collection stay)
    const owed = await reservedAt(this.prisma, organizationId, transfer.fromBranchId, lines.map(l => l.item.productId));
    for(const l of lines) {
      if (!l.quantity) continue;
      const inv = await this.prisma.inventory.findUnique({ where:{ productId_branchId:{productId:l.item.productId,branchId:transfer.fromBranchId} } });
      const available = (inv?.quantity ?? 0) - (owed.get(l.item.productId) ?? 0);
      if(available < l.quantity) {
        throw new BadRequestException(`Cannot dispatch ${l.quantity} units of "${l.name}" — only ${available} available at ${transfer.fromBranch.name}`);
      }
    }
    const tracked = new Set((await this.prisma.product.findMany({ where:{ id:{ in: lines.map(l => l.item.productId) }, trackItems:true }, select:{ id:true } })).map(p => p.id));

    return this.prisma.$transaction(async (tx) => {
      for(const l of lines) {
        await tx.stockTransferItem.update({ where:{ id:l.item.id }, data:{ sentQuantity:l.quantity, sentScanned:l.scanned } });
        if (!l.quantity) continue;
        await this.inventory.adjustStock(tx, {
          organizationId, productId:l.item.productId, branchId:transfer.fromBranchId,
          type:"TRANSFER_OUT", quantityDelta: -l.quantity,
          referenceType:"StockTransfer", referenceId:transfer.id, userId,
          notes: `Dispatched to ${transfer.toBranch.name} (${transfer.transferNumber})${byScan ? "" : " - not scanned"}`
        });
        if (tracked.has(l.item.productId)) {
          // labelled goods: the scanned labels go on the truck; counted by hand, the oldest labelled items on the shelf are taken
          let items: { id: string }[];
          if (l.codes.length) {
            if (l.codes.length !== l.quantity) throw new BadRequestException(`"${l.name}" has a label on each item: scan ${l.quantity} labels (you scanned ${l.codes.length}).`);
            items = await this.tracking.checkItemCodes(tx, organizationId, l.name, l.item.productId, l.codes, { status:"IN_STOCK", branchId:transfer.fromBranchId });
          } else {
            items = await tx.stockItem.findMany({ where:{ organizationId, productId:l.item.productId, branchId:transfer.fromBranchId, status:"IN_STOCK" }, orderBy:{ createdAt:"asc" }, take:l.quantity, select:{ id:true } });
          }
          await tx.stockItem.updateMany({ where:{ id:{ in: items.map(i => i.id) } }, data:{ status:"IN_TRANSIT", branchId:null, transferId:transfer.id } });
          await this.tracking.events(tx, organizationId, items.map(i => i.id), { type:"SENT", branchId:transfer.fromBranchId, userId, referenceType:"StockTransfer", referenceId:transfer.id, note:`${transfer.transferNumber} to ${transfer.toBranch.name}${l.codes.length ? "" : " (not scanned)"}` });
        }
      }
      if (!byScan) {
        const missed = TrackingService.missed(lines);
        await this.tracking.raise(tx, { organizationId, branchId:transfer.fromBranchId, otherBranchId:transfer.toBranchId, kind:"NOT_SCANNED_SEND",
          title:`${transfer.transferNumber} sent without scanning everything`, detail:`${missed.join(", ")} left ${transfer.fromBranch.name} for ${transfer.toBranch.name} counted by hand. Reason given: ${reason}`,
          referenceType:"StockTransfer", referenceId:transfer.id, referenceNumber:transfer.transferNumber, userId });
      }
      return tx.stockTransfer.update({ where:{id}, data:{status:"DISPATCHED", dispatchedByUserId:userId, dispatchedAt:new Date(), sentByScan:byScan}, include:transferInclude });
    });
  }

  async receive(organizationId: string, id: string, userId: string, dto?: HandoverDto) {
    const transfer = await this.get(organizationId, id);
    if(transfer.status !== "DISPATCHED") throw new ConflictException("Only DISPATCHED transfers can be received");
    const lines = this.lines(transfer, dto, i => i.sentQuantity ?? i.quantity);
    const byScan = TrackingService.scannedAll(lines);
    const reason = byScan ? undefined : TrackingService.needReason(dto?.reason ?? (dto?.lines ? undefined : "Received with the old Receive button, without scanning"));
    const tracked = new Set((await this.prisma.product.findMany({ where:{ id:{ in: lines.map(l => l.item.productId) }, trackItems:true }, select:{ id:true } })).map(p => p.id));

    return this.prisma.$transaction(async (tx) => {
      for(const l of lines) {
        const sent = l.item.sentQuantity ?? l.item.quantity;
        await tx.stockTransferItem.update({ where:{ id:l.item.id }, data:{ receivedQuantity:l.quantity, receivedScanned:l.scanned } });
        if (l.quantity) await this.inventory.adjustStock(tx, {
          organizationId, productId:l.item.productId, branchId:transfer.toBranchId,
          type:"TRANSFER_IN", quantityDelta: l.quantity,
          referenceType:"StockTransfer", referenceId:transfer.id, userId,
          notes: `Received from ${transfer.fromBranch.name} (${transfer.transferNumber})${byScan ? "" : " - not scanned"}`
        });
        let missingCodes: string[] = [];
        if (tracked.has(l.item.productId)) {
          const onTruck = await tx.stockItem.findMany({ where:{ organizationId, productId:l.item.productId, transferId:transfer.id, status:"IN_TRANSIT" }, orderBy:{ createdAt:"asc" }, select:{ id:true, code:true } });
          let arrived: { id: string; code: string }[];
          if (l.codes.length) {
            if (l.codes.length !== l.quantity) throw new BadRequestException(`"${l.name}" has a label on each item: scan ${l.quantity} labels (you scanned ${l.codes.length}).`);
            arrived = await this.tracking.checkItemCodes(tx, organizationId, l.name, l.item.productId, l.codes, { status:"IN_TRANSIT", transferId:transfer.id });
          } else arrived = onTruck.slice(0, l.quantity);
          const got = new Set(arrived.map(a => a.id)), lost = onTruck.filter(t => !got.has(t.id));
          missingCodes = lost.map(t => t.code);
          await tx.stockItem.updateMany({ where:{ id:{ in:[...got] } }, data:{ status:"IN_STOCK", branchId:transfer.toBranchId, transferId:null } });
          await this.tracking.events(tx, organizationId, [...got], { type:"ARRIVED", branchId:transfer.toBranchId, userId, referenceType:"StockTransfer", referenceId:transfer.id, note:`${transfer.transferNumber} from ${transfer.fromBranch.name}${l.codes.length ? "" : " (not scanned)"}` });
          if (lost.length) {
            await tx.stockItem.updateMany({ where:{ id:{ in: lost.map(t => t.id) } }, data:{ status:"MISSING" } });
            await this.tracking.events(tx, organizationId, lost.map(t => t.id), { type:"MISSING", branchId:null, userId, referenceType:"StockTransfer", referenceId:transfer.id, note:`Not scanned in at ${transfer.toBranch.name} on ${transfer.transferNumber}` });
          }
        }
        if (l.quantity < sent) {
          const short = sent - l.quantity;
          await this.tracking.raise(tx, { organizationId, branchId:transfer.fromBranchId, otherBranchId:transfer.toBranchId, kind:"SHORT_TRANSFER",
            title:`${short} × ${l.name} short on ${transfer.transferNumber}`,
            detail:`${transfer.fromBranch.name} sent ${sent}${l.item.sentScanned === sent ? " (all scanned)" : ""}; ${transfer.toBranch.name} counted ${l.quantity}${byScan ? " (all scanned)" : ""}.${missingCodes.length ? ` Missing labels: ${missingCodes.join(", ")}.` : ""}`,
            productId:l.item.productId, quantity:short, itemCodes:missingCodes, referenceType:"StockTransfer", referenceId:transfer.id, referenceNumber:transfer.transferNumber, userId:transfer.dispatchedByUserId });
        }
      }
      if (!byScan) {
        const missed = TrackingService.missed(lines);
        await this.tracking.raise(tx, { organizationId, branchId:transfer.toBranchId, otherBranchId:transfer.fromBranchId, kind:"NOT_SCANNED_RECEIVE",
          title:`${transfer.transferNumber} received without scanning everything`, detail:`${missed.join(", ")} came into ${transfer.toBranch.name} counted by hand. Reason given: ${reason}`,
          referenceType:"StockTransfer", referenceId:transfer.id, referenceNumber:transfer.transferNumber, userId });
      }
      return tx.stockTransfer.update({ where:{id}, data:{status:"RECEIVED", receivedByUserId:userId, receivedAt:new Date(), receivedByScan:byScan}, include:transferInclude });
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
