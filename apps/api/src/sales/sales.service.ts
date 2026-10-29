import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { CreateSaleReturnDto } from "./dto/create-sale-return.dto";
import { cleanCodes } from "../tracking/codes";
import { ReleasesService } from "../releases/releases";
import { TrackingService } from "../tracking/tracking.service";
import { reservedAt } from "../releases/reserved";

const saleInclude = {
  branch: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, creditLimit: true } },
  user: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
  payments: { orderBy: { receivedAt: "asc" as const } },
  returns: { include: { items: true }, orderBy: { createdAt: "asc" as const } },
  releases: { orderBy: { createdAt: "asc" as const }, select: { id: true, number: true, createdAt: true, byScan: true, collectedBy: true, confirmToken: true, items: { select: { saleItemId: true, quantity: true } }, confirmation: { select: { status: true, createdAt: true, comment: true } } } }
};

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService, private readonly releases: ReleasesService, private readonly tracking: TrackingService) {}

  list(organizationId: string, branchId?: string) {
    return this.prisma.sale.findMany({
      where: { organizationId, ...(branchId ? { branchId } : {}) },
      include: saleInclude,
      orderBy: { soldAt: "desc" },
      take: 200
    });
  }

  /** One chronological record of everything that happened to a sale: who, what, when. */
  async auditTrail(organizationId: string, id: string) {
    const sale = await this.get(organizationId, id);
    const returnIds = sale.returns.map(r => r.id);
    const [movements, payments, returns] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { organizationId, referenceId: { in: [id, ...returnIds] }, referenceType: { in: ["Sale", "SaleReturn"] } },
        include: { product: { select: { name: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.payment.findMany({ where: { saleId: id }, include: { receivedBy: { select: { name: true } } }, orderBy: { receivedAt: "asc" } }),
      this.prisma.saleReturn.findMany({ where: { saleId: id }, include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } })
    ]);
    const events = [
      { at: sale.soldAt, kind: "SALE", text: `Invoice ${sale.invoiceNumber} created, total ${Number(sale.totalAmount).toFixed(2)}`, by: sale.user.name },
      ...payments.map(p => ({ at: p.receivedAt, kind: "PAYMENT", text: `Payment ${Number(p.amount).toFixed(2)} by ${p.method.replace("_", " ").toLowerCase()}${p.reference ? ` (ref ${p.reference})` : ""}`, by: p.receivedBy.name })),
      ...returns.map(r => ({ at: r.createdAt, kind: "RETURN", text: `Return recorded: ${r.reason}`, by: r.createdBy.name })),
      ...movements.map(m => ({ at: m.createdAt, kind: "STOCK", text: `${m.product.name}: ${m.quantityDelta > 0 ? "+" : ""}${m.quantityDelta} (stock now ${m.resultingQuantity})${m.notes ? `, ${m.notes}` : ""}`, by: m.user?.name ?? "System" }))
    ];
    if (sale.status === "VOIDED") events.push({ at: sale.soldAt, kind: "VOID", text: "Sale is voided; stock was restored", by: "" });
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return events;
  }

  async get(organizationId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, organizationId }, include: saleInclude });
    if (!sale) throw new NotFoundException("Sale not found");
    return sale;
  }

  private async nextInvoiceNumber(organizationId: string) {
    const count = await this.prisma.sale.count({ where: { organizationId } });
    let n = count + 1;
    // guard against gaps/collisions (invoiceNumber is globally unique)
    for (;;) {
      const candidate = `INV-${String(n).padStart(5, "0")}`;
      const exists = await this.prisma.sale.findUnique({ where: { invoiceNumber: candidate } });
      if (!exists) return candidate;
      n++;
    }
  }

  private async assertWithinCreditLimit(organizationId: string, customerId: string, additionalAmount: number) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, organizationId } });
    if (!customer) throw new BadRequestException("Customer not found");
    if (customer.creditLimit === null) return;
    const sales = await this.prisma.sale.findMany({
      where: { organizationId, customerId, status: "COMPLETED" },
      include: { payments: true }
    });
    const outstanding = sales.reduce((sum, s) => sum + Math.max(0, Number(s.totalAmount) - s.payments.reduce((p, x) => p + Number(x.amount), 0)), 0);
    const limit = Number(customer.creditLimit);
    if (outstanding + additionalAmount > limit + 0.001) {
      throw new BadRequestException(
        `Credit limit exceeded for ${customer.name}: owes ${outstanding.toFixed(2)}, this sale adds ${additionalAmount.toFixed(2)}, limit is ${limit.toFixed(2)}`
      );
    }
  }

  async create(organizationId: string, userId: string, dto: CreateSaleDto) {
    // the same sale sent again (a retry, or the counter catching up after the internet came back): answer with the one already saved
    if (dto.clientRef) {
      const seen = await this.prisma.sale.findFirst({ where: { organizationId, clientRef: dto.clientRef }, include: saleInclude });
      if (seen) return { ...seen, release: seen.releases[0] ? { id: seen.releases[0].id, number: seen.releases[0].number, confirmToken: seen.releases[0].confirmToken, byScan: seen.releases[0].byScan, fulfilment: seen.fulfilment } : null, duplicate: true };
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId } });
    if (!branch) throw new BadRequestException("Branch not found");
    // a sale made while the internet was down already happened: the goods and the money changed hands. It is saved as it was,
    // at the time it was made, and anything that no longer adds up (stock) becomes a question instead of a refusal.
    const offline = !!dto.offline;
    let soldAt: Date | undefined;
    if (offline && dto.soldAt) {
      const t = new Date(dto.soldAt);
      if (t.getTime() > Date.now() + 5 * 60_000 || t.getTime() < Date.now() - 30 * 86400_000) throw new BadRequestException("The time of this offline sale is not believable (more than 30 days ago, or in the future).");
      soldAt = t;
    }
    if (offline && dto.handover === "later") throw new BadRequestException("Goods to collect later need the internet. Sell them when the connection is back.");

    const productIds = [...new Set(dto.items.map(i => i.productId))];
    if (productIds.length !== dto.items.length) throw new BadRequestException("Each product may appear only once in a sale");
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, organizationId } });
    if (products.length !== productIds.length) throw new BadRequestException("One or more products not found");
    const unpriced = products.find(p => p.needsPrice);
    if (unpriced) throw new BadRequestException(`"${unpriced.name}" has no selling price yet. Ask your manager to set it (Products, then Edit).`);

    const inv = await this.prisma.inventory.findMany({ where: { organizationId, branchId: dto.branchId, productId: { in: productIds } } });
    const stock = new Map<string, number>(inv.map((i): [string, number] => [i.productId, i.quantity]));
    const owed = await reservedAt(this.prisma, organizationId, dto.branchId, productIds); // sold earlier, still waiting to be collected
    const oversold: string[] = [];
    for (const item of dto.items) {
      const have = (stock.get(item.productId) ?? 0) - (owed.get(item.productId) ?? 0);
      if (item.quantity > have && offline) { oversold.push(`${item.quantity - Math.max(0, have)} × ${products.find(x => x.id === item.productId)!.name}`); continue; }
      if (item.quantity > have) {
        const p = products.find(x => x.id === item.productId)!;
        throw new BadRequestException(`Insufficient stock for ${p.name} at ${branch.name}: ${Math.max(0, have)} available${owed.get(item.productId) ? ` (${owed.get(item.productId)} more are sold and waiting to be collected)` : ""}, ${item.quantity} requested`);
      }
    }

    const total = dto.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const pays = (dto.payments ?? []).filter(p => p.amount > 0);
    if (pays.some(p => p.method === "CREDIT")) throw new BadRequestException("A sale on credit is a sale with no payment yet: leave the payment out and choose the customer.");
    const paidNow = pays.reduce((s, p) => s + p.amount, 0);
    if (paidNow > total + 0.01) throw new BadRequestException(`Payments (${paidNow.toFixed(2)}) are more than the sale total (${total.toFixed(2)}).`);
    if (dto.customerId && paidNow < total - 0.01) await this.assertWithinCreditLimit(organizationId, dto.customerId, total - paidNow);
    if (!dto.customerId && dto.payments && paidNow < total - 0.01) throw new BadRequestException("A walk-in customer must pay the full amount. Choose a customer to sell on credit.");
    const invoiceNumber = await this.nextInvoiceNumber(organizationId);

    const later = dto.handover === "later";
    // scanned at the counter: check before saving anything, so a missing reason does not leave a half-made sale
    if (dto.handover === "now") {
      const lines = dto.items.map(i => { const p = products.find(x => x.id === i.productId)!; return { name: p.name, quantity: i.quantity, scanned: Math.max(i.scanned ?? 0, cleanCodes(i.itemCodes).length), barcoded: p.barcodes.length > 0, tracked: p.trackItems }; });
      if (!ReleasesService.check(lines.map(l => ({ ...l, saleItemId: "", productId: "", codes: [] })))) TrackingService.needReason(dto.reason);
    }

    return this.prisma.$transaction(async tx => {
      const sale = await tx.sale.create({
        data: {
          organizationId, branchId: dto.branchId, userId, invoiceNumber,
          customerId: dto.customerId ?? null,
          totalAmount: total,
          fulfilment: later ? "AWAITING" : "RELEASED",
          clientRef: dto.clientRef ?? null, offline, ...(soldAt ? { soldAt } : {}),
          items: { create: dto.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, unitCost: products.find(p => p.id === i.productId)?.costPrice ?? null, lineTotal: i.quantity * i.unitPrice, releasedQuantity: later ? 0 : dto.handover === "now" ? 0 : null })) }
        },
        include: { items: true }
      });
      for (const p of pays) {
        await tx.payment.create({ data: { organizationId, saleId: sale.id, method: p.method, amount: p.amount, reference: p.reference ?? null, receivedByUserId: userId, ...(soldAt ? { receivedAt: soldAt } : {}) } });
      }
      // goods to be collected later stay on the shelf (reserved for this customer) until they are scanned out
      if (later) return { ...await tx.sale.findUniqueOrThrow({ where: { id: sale.id }, include: saleInclude }), release: null };
      for (const i of dto.items) {
        await this.inventory.adjustStock(tx, {
          organizationId, productId: i.productId, branchId: dto.branchId, type: "SALE",
          quantityDelta: -i.quantity, referenceType: "Sale", referenceId: sale.id, userId, notes: invoiceNumber
        });
        const p = products.find(x => x.id === i.productId)!;
        if (p.trackItems && dto.handover !== "now") await this.releases.sellItems(tx, organizationId, dto.branchId, sale.id, invoiceNumber, userId, p, i.quantity, cleanCodes(i.itemCodes));
      }
      // handed over at the counter: recorded as a release, with a QR on the receipt for the customer to confirm
      const release = dto.handover === "now" ? await this.releases.record(tx, {
        org: organizationId, sale: { id: sale.id, branchId: dto.branchId, invoiceNumber, branchName: branch.name }, userId, reason: dto.reason, deduct: false, confirmToken: dto.confirmToken, lenient: offline,
        lines: dto.items.map(i => { const p = products.find(x => x.id === i.productId)!, codes = cleanCodes(i.itemCodes); return { saleItemId: sale.items.find(x => x.productId === i.productId)!.id, productId: p.id, name: p.name, quantity: i.quantity, scanned: Math.max(i.scanned ?? 0, codes.length), codes, barcoded: p.barcodes.length > 0, tracked: p.trackItems }; }),
      }) : null;
      if (oversold.length) await this.tracking.raise(tx, { organizationId, branchId: dto.branchId, kind: "OFFLINE_OVERSOLD", title: `${invoiceNumber}: sold offline, more than the records show`,
        detail: `While the internet was down, ${branch.name} sold ${oversold.join(", ")} more than the stock on record. Count these products: either stock arrived that was not recorded, or the numbers are wrong.`, referenceType: "Sale", referenceId: sale.id, referenceNumber: invoiceNumber, userId });
      return { ...await tx.sale.findUniqueOrThrow({ where: { id: sale.id }, include: saleInclude }), release };
    });
  }

  async void(organizationId: string, id: string, userId: string) {
    const sale = await this.get(organizationId, id);
    if (sale.status === "VOIDED") throw new BadRequestException("Sale is already voided");
    if (sale.returns.length > 0) throw new BadRequestException("Cannot void a sale that has returns");
    return this.prisma.$transaction(async tx => {
      for (const i of sale.items) {
        const out = i.releasedQuantity ?? i.quantity; // goods never collected never left the shelf
        if (!out) continue;
        await this.inventory.adjustStock(tx, {
          organizationId, productId: i.productId, branchId: sale.branchId, type: "RETURN",
          quantityDelta: out, referenceType: "Sale", referenceId: sale.id, userId, notes: `Void ${sale.invoiceNumber}`
        });
        await this.releases.unsellItems(tx, organizationId, sale.branchId, sale.id, i.productId, out, userId, `Sale ${sale.invoiceNumber} voided`);
      }
      await tx.sale.update({ where: { id }, data: { status: "VOIDED" } });
      return tx.sale.findUniqueOrThrow({ where: { id }, include: saleInclude });
    });
  }

  async recordPayment(organizationId: string, id: string, userId: string, dto: CreatePaymentDto) {
    const sale = await this.get(organizationId, id);
    if (sale.status === "VOIDED") throw new BadRequestException("Cannot take payment on a voided sale");
    const paid = sale.payments.reduce((s, p) => s + Number(p.amount), 0);
    const remaining = Number(sale.totalAmount) - paid;
    if (dto.amount > remaining + 0.01) throw new BadRequestException(`Payment exceeds balance: ${remaining.toFixed(2)} remaining`);
    await this.prisma.payment.create({
      data: { organizationId, saleId: id, method: dto.method, amount: dto.amount, reference: dto.reference ?? null, receivedByUserId: userId }
    });
    return this.get(organizationId, id);
  }

  async createReturn(organizationId: string, id: string, userId: string, dto: CreateSaleReturnDto) {
    const sale = await this.get(organizationId, id);
    if (sale.status === "VOIDED") throw new BadRequestException("Cannot return items on a voided sale");

    const returned = new Map<string, number>();
    for (const r of sale.returns) for (const ri of r.items) returned.set(ri.saleItemId, (returned.get(ri.saleItemId) ?? 0) + ri.quantity);

    const seen = new Set<string>();
    for (const ri of dto.items) {
      if (seen.has(ri.saleItemId)) throw new BadRequestException("Each line may appear only once in a return");
      seen.add(ri.saleItemId);
      const line = sale.items.find(x => x.id === ri.saleItemId);
      if (!line) throw new BadRequestException("Return line does not belong to this sale");
      const available = (line.releasedQuantity ?? line.quantity) - (returned.get(line.id) ?? 0); // only goods the customer took can come back
      if (ri.quantity > available) throw new BadRequestException(`Cannot return ${ri.quantity} of ${line.product.name}: only ${available} left to return`);
    }

    return this.prisma.$transaction(async tx => {
      const ret = await tx.saleReturn.create({
        data: {
          organizationId, saleId: id, reason: dto.reason, createdByUserId: userId,
          items: { create: dto.items.map(i => ({ saleItemId: i.saleItemId, quantity: i.quantity })) }
        }
      });
      for (const ri of dto.items) {
        const line = sale.items.find(x => x.id === ri.saleItemId)!;
        await this.inventory.adjustStock(tx, {
          organizationId, productId: line.productId, branchId: sale.branchId, type: "RETURN",
          quantityDelta: ri.quantity, referenceType: "SaleReturn", referenceId: ret.id, userId, notes: `Return on ${sale.invoiceNumber}`
        });
        await this.releases.unsellItems(tx, organizationId, sale.branchId, sale.id, line.productId, ri.quantity, userId, `Returned on ${sale.invoiceNumber}`);
      }
      return tx.sale.findUniqueOrThrow({ where: { id }, include: saleInclude });
    });
  }
}
