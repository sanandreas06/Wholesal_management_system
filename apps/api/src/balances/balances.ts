import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { scopeOf } from "../common/branch/branch-scope";

const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400_000;
const ageOf = (d: Date) => Math.floor((Date.now() - d.getTime()) / DAY);

export class MoneyInDto {
  @IsNumber() @Min(0.01) @Max(100_000_000) amount!: number;
  @IsIn(["CASH", "BANK", "MOBILE_MONEY"]) method!: "CASH" | "BANK" | "MOBILE_MONEY";
  @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  /** customers: only that branch's invoices (people limited to one branch always use their own) */
  @IsOptional() @IsUUID() branchId?: string;
}

/**
 * Money owed, both ways. Customers: every completed sale not yet fully paid, grouped by how old it is.
 * Suppliers: the goods received (at the supplier's invoice amount when it was entered, otherwise at cost) minus what was paid them.
 */
@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  private branchFor(user: AuthUser, asked?: string) { return scopeOf(user) ?? asked ?? undefined; }

  /** Unpaid sales per customer: amount, age buckets, and how much is past their agreed credit days. */
  async customers(user: AuthUser, branchId?: string) {
    const b = this.branchFor(user, branchId);
    const sales = await this.prisma.sale.findMany({
      where: { organizationId: user.organizationId, status: "COMPLETED", customerId: { not: null }, ...(b ? { branchId: b } : {}) },
      select: { id: true, soldAt: true, totalAmount: true, customerId: true, payments: { select: { amount: true } } },
    });
    const by = new Map<string, { owed: number; invoices: number; oldest: Date | null; b30: number; b60: number; b90: number; bOver: number; lastPaid?: Date }>();
    for (const s of sales) {
      const due = Number(s.totalAmount) - s.payments.reduce((t, p) => t + Number(p.amount), 0);
      if (due <= 0.005) continue;
      const row = by.get(s.customerId!) ?? { owed: 0, invoices: 0, oldest: null, b30: 0, b60: 0, b90: 0, bOver: 0 };
      const age = ageOf(s.soldAt);
      row.owed += due; row.invoices++; if (!row.oldest || s.soldAt < row.oldest) row.oldest = s.soldAt;
      if (age <= 30) row.b30 += due; else if (age <= 60) row.b60 += due; else if (age <= 90) row.b90 += due; else row.bOver += due;
      by.set(s.customerId!, row);
    }
    if (!by.size) return [];
    const customers = await this.prisma.customer.findMany({ where: { id: { in: [...by.keys()] } }, select: { id: true, name: true, code: true, phone: true, creditLimit: true, creditDays: true } });
    const lastPay = await this.prisma.payment.groupBy({ by: ["saleId"], where: { organizationId: user.organizationId, sale: { customerId: { in: [...by.keys()] }, ...(b ? { branchId: b } : {}) } }, _max: { receivedAt: true } });
    const saleCust = new Map(sales.map(s => [s.id, s.customerId!]));
    const last = new Map<string, Date>();
    for (const l of lastPay) { const c = saleCust.get(l.saleId); const d = l._max.receivedAt; if (c && d && (!last.get(c) || d > last.get(c)!)) last.set(c, d); }
    return customers.map(c => {
      const r = by.get(c.id)!;
      const days = c.creditDays ?? 30;
      const overdue = sales.filter(s => s.customerId === c.id && ageOf(s.soldAt) > days).reduce((t, s) => t + Math.max(0, Number(s.totalAmount) - s.payments.reduce((x, p) => x + Number(p.amount), 0)), 0);
      return { customer: { ...c, creditLimit: c.creditLimit === null ? null : Number(c.creditLimit) }, owed: r2(r.owed), invoices: r.invoices, oldest: r.oldest, oldestDays: r.oldest ? ageOf(r.oldest) : 0,
        buckets: { d0_30: r2(r.b30), d31_60: r2(r.b60), d61_90: r2(r.b90), d90plus: r2(r.bOver) }, overdue: r2(overdue), creditDays: days, lastPaid: last.get(c.id) ?? null,
        overLimit: c.creditLimit !== null && r.owed > Number(c.creditLimit) + 0.005 };
    }).sort((a, b2) => b2.owed - a.owed);
  }

  /** A customer's statement: every sale and payment in order, with the running balance. */
  async customerStatement(user: AuthUser, id: string, branchId?: string, from?: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true, name: true, code: true, phone: true, email: true, address: true, creditLimit: true, creditDays: true } });
    if (!c) throw new NotFoundException("Customer not found");
    const b = this.branchFor(user, branchId);
    const start = from ? new Date(from) : new Date(Date.now() - 180 * DAY);
    if (isNaN(start.getTime())) throw new BadRequestException("Choose a valid start date.");
    const sales = await this.prisma.sale.findMany({ where: { organizationId: user.organizationId, customerId: id, status: "COMPLETED", ...(b ? { branchId: b } : {}) }, select: { id: true, invoiceNumber: true, soldAt: true, totalAmount: true, branch: { select: { name: true } }, payments: { select: { amount: true, method: true, reference: true, receivedAt: true } } } });
    type Line = { date: Date; kind: "SALE" | "PAYMENT"; ref: string; detail: string; debit: number; credit: number };
    const all: Line[] = [];
    for (const s of sales) {
      all.push({ date: s.soldAt, kind: "SALE", ref: s.invoiceNumber, detail: s.branch.name, debit: Number(s.totalAmount), credit: 0 });
      for (const p of s.payments) all.push({ date: p.receivedAt, kind: "PAYMENT", ref: s.invoiceNumber, detail: `${p.method.replace("_", " ").toLowerCase()}${p.reference ? ` · ${p.reference}` : ""}`, debit: 0, credit: Number(p.amount) });
    }
    all.sort((a, b2) => a.date.getTime() - b2.date.getTime() || (a.kind === "SALE" ? -1 : 1));
    const opening = r2(all.filter(l => l.date < start).reduce((t, l) => t + l.debit - l.credit, 0));
    let bal = opening;
    const lines = all.filter(l => l.date >= start).map(l => { bal = r2(bal + l.debit - l.credit); return { ...l, balance: bal }; });
    const org = await this.prisma.organization.findUnique({ where: { id: user.organizationId }, select: { name: true, logo: true, phone: true, email: true, address: true, currency: true } });
    return { company: org, customer: { ...c, creditLimit: c.creditLimit === null ? null : Number(c.creditLimit) }, from: start, opening, closing: bal, lines };
  }

  /** Money in from a customer, spread over their oldest unpaid invoices first. */
  async customerPayment(user: AuthUser, id: string, dto: MoneyInDto) {
    const b = this.branchFor(user, dto.branchId);
    const c = await this.prisma.customer.findFirst({ where: { id, organizationId: user.organizationId }, select: { name: true } });
    if (!c) throw new NotFoundException("Customer not found");
    const sales = await this.prisma.sale.findMany({ where: { organizationId: user.organizationId, customerId: id, status: "COMPLETED", ...(b ? { branchId: b } : {}) }, orderBy: { soldAt: "asc" }, select: { id: true, invoiceNumber: true, totalAmount: true, payments: { select: { amount: true } } } });
    const open = sales.map(s => ({ ...s, due: r2(Number(s.totalAmount) - s.payments.reduce((t, p) => t + Number(p.amount), 0)) })).filter(s => s.due > 0.005);
    const owed = r2(open.reduce((t, s) => t + s.due, 0));
    if (!open.length) throw new BadRequestException(`${c.name} owes nothing${b ? " at this branch" : ""}.`);
    if (dto.amount > owed + 0.005) throw new BadRequestException(`${c.name} owes ${owed.toFixed(2)}. The payment is more than that.`);
    let left = r2(dto.amount);
    const applied: { invoiceNumber: string; amount: number }[] = [];
    await this.prisma.$transaction(async tx => {
      for (const s of open) {
        if (left <= 0.005) break;
        const take = r2(Math.min(left, s.due));
        await tx.payment.create({ data: { organizationId: user.organizationId, saleId: s.id, method: dto.method, amount: take, reference: dto.reference ?? (dto.note ? dto.note.slice(0, 60) : null), receivedByUserId: user.sub } });
        applied.push({ invoiceNumber: s.invoiceNumber, amount: take }); left = r2(left - take);
      }
    });
    return { applied, owedBefore: owed, owedNow: r2(owed - dto.amount) };
  }

  // ------------------------------------------------------------------ suppliers

  private async supplierRows(org: string, supplierId?: string) {
    const [receipts, payments] = await Promise.all([
      this.prisma.goodsReceipt.findMany({ where: { organizationId: org, ...(supplierId ? { purchaseOrder: { supplierId } } : {}) }, select: { id: true, receivedAt: true, supplierInvoiceNumber: true, supplierInvoiceAmount: true, purchaseOrder: { select: { orderNumber: true, supplierId: true } }, items: { select: { quantityReceived: true, unitCost: true } } } }),
      this.prisma.supplierPayment.findMany({ where: { organizationId: org, ...(supplierId ? { supplierId } : {}) }, select: { id: true, supplierId: true, amount: true, method: true, reference: true, note: true, paidAt: true } }),
    ]);
    const value = (r: (typeof receipts)[number]) => r.supplierInvoiceAmount !== null ? Number(r.supplierInvoiceAmount) : r.items.reduce((t, i) => t + i.quantityReceived * Number(i.unitCost), 0);
    return { receipts: receipts.map(r => ({ ...r, value: r2(value(r)) })), payments };
  }

  /** What each supplier is owed: goods received minus payments, the oldest unpaid delivery first (payments settle the oldest). */
  async suppliers(user: AuthUser) {
    const { receipts, payments } = await this.supplierRows(user.organizationId);
    const ids = [...new Set([...receipts.map(r => r.purchaseOrder.supplierId), ...payments.map(p => p.supplierId)])];
    if (!ids.length) return [];
    const sups = await this.prisma.supplier.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, code: true, phone: true, creditDays: true } });
    return sups.map(s => {
      const rs = receipts.filter(r => r.purchaseOrder.supplierId === s.id).sort((a, b2) => a.receivedAt.getTime() - b2.receivedAt.getTime());
      const received = r2(rs.reduce((t, r) => t + r.value, 0)), paid = r2(payments.filter(p => p.supplierId === s.id).reduce((t, p) => t + Number(p.amount), 0));
      // the oldest delivery not yet covered by payments decides when the next payment is due
      let cover = paid, oldestOpen: Date | null = null;
      for (const r of rs) { if (cover >= r.value - 0.005) { cover -= r.value; continue; } oldestOpen = r.receivedAt; break; }
      const days = s.creditDays ?? 30, dueDate = oldestOpen ? new Date(oldestOpen.getTime() + days * DAY) : null;
      return { supplier: s, received, paid, owed: r2(Math.max(0, received - paid)), credit: r2(Math.max(0, paid - received)), oldestUnpaid: oldestOpen, dueDate, overdue: !!dueDate && dueDate.getTime() < Date.now() && received - paid > 0.005 };
    }).filter(r => r.owed > 0.005 || r.credit > 0.005).sort((a, b2) => (b2.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || b2.owed - a.owed);
  }

  async supplierStatement(user: AuthUser, id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true, name: true, code: true, phone: true, email: true, creditDays: true } });
    if (!s) throw new NotFoundException("Supplier not found");
    const { receipts, payments } = await this.supplierRows(user.organizationId, id);
    const lines = [
      ...receipts.map(r => ({ date: r.receivedAt, kind: "GOODS" as const, ref: r.supplierInvoiceNumber || r.purchaseOrder.orderNumber, detail: r.supplierInvoiceNumber ? `${r.purchaseOrder.orderNumber}` : "at cost (no supplier invoice amount entered)", debit: r.value, credit: 0 })),
      ...payments.map(p => ({ date: p.paidAt, kind: "PAYMENT" as const, ref: p.reference || "", detail: `${p.method.replace("_", " ").toLowerCase()}${p.note ? ` · ${p.note}` : ""}`, debit: 0, credit: Number(p.amount) })),
    ].sort((a, b2) => a.date.getTime() - b2.date.getTime());
    let bal = 0;
    const org = await this.prisma.organization.findUnique({ where: { id: user.organizationId }, select: { name: true, logo: true, phone: true, email: true, address: true, currency: true } });
    return { company: org, supplier: s, lines: lines.map(l => { bal = r2(bal + l.debit - l.credit); return { ...l, balance: bal }; }), closing: bal };
  }

  async supplierPayment(user: AuthUser, id: string, dto: MoneyInDto) {
    const s = await this.prisma.supplier.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true, name: true } });
    if (!s) throw new NotFoundException("Supplier not found");
    const p = await this.prisma.supplierPayment.create({ data: { organizationId: user.organizationId, supplierId: id, amount: r2(dto.amount), method: dto.method, reference: dto.reference ?? null, note: dto.note ?? null, userId: user.sub } });
    return { id: p.id, supplier: s.name, amount: Number(p.amount) };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("balances")
export class BalancesController {
  constructor(private readonly svc: BalancesService) {}
  @Get("customers") @RequirePermissions("PAYMENTS:READ")
  customers(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string) { return this.svc.customers(u, branchId); }
  @Get("customers/:id/statement") @RequirePermissions("PAYMENTS:READ")
  customerStatement(@CurrentUser() u: AuthUser, @Param("id") id: string, @Query("branchId") branchId?: string, @Query("from") from?: string) { return this.svc.customerStatement(u, id, branchId, from); }
  @Post("customers/:id/payments") @RequirePermissions("PAYMENTS:CREATE")
  customerPayment(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: MoneyInDto) { return this.svc.customerPayment(u, id, dto); }
  @Get("suppliers") @RequirePermissions("PURCHASING:READ")
  suppliers(@CurrentUser() u: AuthUser) { return this.svc.suppliers(u); }
  @Get("suppliers/:id/statement") @RequirePermissions("PURCHASING:READ")
  supplierStatement(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.supplierStatement(u, id); }
  /** Paying a supplier is money leaving the business: owners and administrators (who approve expenses) record it. */
  @Post("suppliers/:id/payments") @RequirePermissions("EXPENSES:APPROVE")
  supplierPayment(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: MoneyInDto) { return this.svc.supplierPayment(u, id, dto); }
}

@Module({ controllers: [BalancesController], providers: [BalancesService], exports: [BalancesService] })
export class BalancesModule {}
