import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { CreateSaleReturnDto } from "./dto/create-sale-return.dto";

const saleInclude = {
  branch: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, creditLimit: true } },
  user: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
  payments: { orderBy: { receivedAt: "asc" as const } },
  returns: { include: { items: true }, orderBy: { createdAt: "asc" as const } }
};

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  list(organizationId: string, branchId?: string) {
    return this.prisma.sale.findMany({
      where: { organizationId, ...(branchId ? { branchId } : {}) },
      include: saleInclude,
      orderBy: { soldAt: "desc" },
      take: 200
    });
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
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId } });
    if (!branch) throw new BadRequestException("Branch not found");

    const productIds = [...new Set(dto.items.map(i => i.productId))];
    if (productIds.length !== dto.items.length) throw new BadRequestException("Each product may appear only once in a sale");
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, organizationId } });
    if (products.length !== productIds.length) throw new BadRequestException("One or more products not found");

    const inv = await this.prisma.inventory.findMany({ where: { organizationId, branchId: dto.branchId, productId: { in: productIds } } });
    const stock = new Map<string, number>(inv.map((i): [string, number] => [i.productId, i.quantity]));
    for (const item of dto.items) {
      const have = stock.get(item.productId) ?? 0;
      if (item.quantity > have) {
        const p = products.find(x => x.id === item.productId)!;
        throw new BadRequestException(`Insufficient stock for ${p.name} at ${branch.name}: ${have} available, ${item.quantity} requested`);
      }
    }

    const total = dto.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    if (dto.customerId) await this.assertWithinCreditLimit(organizationId, dto.customerId, total);
    const invoiceNumber = await this.nextInvoiceNumber(organizationId);

    return this.prisma.$transaction(async tx => {
      const sale = await tx.sale.create({
        data: {
          organizationId, branchId: dto.branchId, userId, invoiceNumber,
          customerId: dto.customerId ?? null,
          totalAmount: total,
          items: { create: dto.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.quantity * i.unitPrice })) }
        }
      });
      for (const i of dto.items) {
        await this.inventory.adjustStock(tx, {
          organizationId, productId: i.productId, branchId: dto.branchId, type: "SALE",
          quantityDelta: -i.quantity, referenceType: "Sale", referenceId: sale.id, userId, notes: invoiceNumber
        });
      }
      return tx.sale.findUniqueOrThrow({ where: { id: sale.id }, include: saleInclude });
    });
  }

  async void(organizationId: string, id: string, userId: string) {
    const sale = await this.get(organizationId, id);
    if (sale.status === "VOIDED") throw new BadRequestException("Sale is already voided");
    if (sale.returns.length > 0) throw new BadRequestException("Cannot void a sale that has returns");
    return this.prisma.$transaction(async tx => {
      for (const i of sale.items) {
        await this.inventory.adjustStock(tx, {
          organizationId, productId: i.productId, branchId: sale.branchId, type: "RETURN",
          quantityDelta: i.quantity, referenceType: "Sale", referenceId: sale.id, userId, notes: `Void ${sale.invoiceNumber}`
        });
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
      const available = line.quantity - (returned.get(line.id) ?? 0);
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
      }
      return tx.sale.findUniqueOrThrow({ where: { id }, include: saleInclude });
    });
  }
}
