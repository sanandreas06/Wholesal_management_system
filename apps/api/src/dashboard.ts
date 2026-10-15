import { Controller, Get, Injectable, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { CurrentUser } from "./common/decorators/current-user.decorator";
import { AuthUser } from "./common/types/auth-user.type";

const ALLOWED_DAYS = [7, 30, 90];
const DAY_MS = 86_400_000;

function startOfDayUtc(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
const num = (v: unknown) => Number(v ?? 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthUser, rawDays?: string, branchId?: string) {
    const orgId = user.organizationId;
    const parsed = Number(rawDays);
    const days = ALLOWED_DAYS.includes(parsed) ? parsed : 30;
    const can = (p: string) => user.permissions.includes(p);

    const today = startOfDayUtc(new Date());
    const from = new Date(today.getTime() - (days - 1) * DAY_MS);
    const to = new Date(today.getTime() + DAY_MS); // exclusive
    const prevFrom = new Date(from.getTime() - days * DAY_MS);

    const branchFilter = branchId ? { branchId } : {};
    const saleWhere = { organizationId: orgId, status: "COMPLETED" as const, ...branchFilter };

    const [sales, prevAgg, branches, products, topGroups, returnItems, movements] = await Promise.all([
      this.prisma.sale.findMany({
        where: { ...saleWhere, soldAt: { gte: from, lt: to } },
        select: { id: true, branchId: true, totalAmount: true, soldAt: true },
      }),
      this.prisma.sale.aggregate({
        where: { ...saleWhere, soldAt: { gte: prevFrom, lt: from } },
        _sum: { totalAmount: true },
      }),
      this.prisma.branch.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
      this.prisma.product.findMany({
        where: { organizationId: orgId },
        select: { id: true, sku: true, name: true, unitPrice: true, stockQuantity: true, reorderLevel: true },
      }),
      this.prisma.saleItem.groupBy({
        by: ["productId"],
        where: { sale: { ...saleWhere, soldAt: { gte: from, lt: to } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: "desc" } },
        take: 5,
      }),
      this.prisma.saleReturnItem.findMany({
        where: {
          saleReturn: { organizationId: orgId, createdAt: { gte: from, lt: to }, ...(branchId ? { sale: { branchId } } : {}) },
        },
        select: { quantity: true, saleItem: { select: { unitPrice: true } } },
      }),
      this.prisma.stockMovement.findMany({
        where: { organizationId: orgId, ...branchFilter },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          product: { select: { name: true, sku: true } },
          branch: { select: { name: true } },
          user: { select: { email: true } },
        },
      }),
    ]);

    // ---- headline numbers
    const grossSales = sales.reduce((s, x) => s + num(x.totalAmount), 0);
    const returnsValue = returnItems.reduce((s, r) => s + r.quantity * num(r.saleItem.unitPrice), 0);
    const prevSales = num(prevAgg._sum.totalAmount);
    const changePct = prevSales > 0 ? round2(((grossSales - prevSales) / prevSales) * 100) : null;
    const invoices = sales.length;

    const inventoryValue = products.reduce((s, p) => s + num(p.unitPrice) * p.stockQuantity, 0);
    const lowList = products
      .filter((p) => p.stockQuantity <= p.reorderLevel)
      .sort((a, b) => a.stockQuantity - b.stockQuantity);

    // ---- trend (zero-filled so the chart has no gaps)
    const byDay = new Map<string, number>();
    for (const s of sales) {
      const k = s.soldAt.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + num(s.totalAmount));
    }
    const salesTrend = Array.from({ length: days }, (_, i) => {
      const date = new Date(from.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      return { date, amount: round2(byDay.get(date) ?? 0) };
    });

    // ---- branches
    const branchPerformance = branches
      .filter((b) => !branchId || b.id === branchId)
      .map((b) => {
        const mine = sales.filter((s) => s.branchId === b.id);
        return { branch: b.name, amount: round2(mine.reduce((a, s) => a + num(s.totalAmount), 0)), invoices: mine.length };
      })
      .sort((a, b) => b.amount - a.amount);

    // ---- top products
    const pById = new Map(products.map((p) => [p.id, p]));
    const topProducts = topGroups.map((g) => ({
      productId: g.productId,
      name: pById.get(g.productId)?.name ?? "Unknown product",
      sku: pById.get(g.productId)?.sku ?? "",
      quantity: g._sum.quantity ?? 0,
      revenue: round2(num(g._sum.lineTotal)),
    }));

    // ---- recent activity
    const recentActivity = movements.map((m) => ({
      id: m.id,
      at: m.createdAt,
      type: m.type,
      product: m.product.name,
      sku: m.product.sku,
      branch: m.branch.name,
      quantityDelta: m.quantityDelta,
      by: m.user?.email ?? "System",
      notes: m.notes,
    }));

    // ---- sections that depend on what the viewer is allowed to see
    const attention: { pendingExpenses?: number; openVarianceCases?: number; importedSales?: number } = {};
    let approvedExpenses: number | null = null;

    const extras: Promise<void>[] = [];
    if (can("EXPENSES:READ")) {
      extras.push(
        this.prisma.expense
          .aggregate({
            where: { organizationId: orgId, ...branchFilter, status: "APPROVED", expenseDate: { gte: from, lt: to } },
            _sum: { amount: true },
          })
          .then((r) => { approvedExpenses = round2(num(r._sum.amount)); }),
        this.prisma.expense
          .count({ where: { organizationId: orgId, ...branchFilter, status: "PENDING" } })
          .then((n) => { attention.pendingExpenses = n; }),
      );
    }
    if (can("VARIANCE_CASES:READ")) {
      extras.push(
        this.prisma.varianceCase
          .count({ where: { organizationId: orgId, ...branchFilter, status: { in: ["OPEN", "INVESTIGATING"] } } })
          .then((n) => { attention.openVarianceCases = n; }),
      );
    }
    if (can("EXCEL_IMPORT:READ")) {
      extras.push(
        this.prisma.weeklySale
          .aggregate({
            where: { organizationId: orgId, ...branchFilter, saleDate: { gte: from, lt: to } },
            _sum: { lineTotal: true },
          })
          .then((r) => { attention.importedSales = round2(num(r._sum.lineTotal)); }),
      );
    }
    await Promise.all(extras);

    return {
      period: { days, from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) },
      kpis: {
        totalSales: round2(grossSales),
        returnsValue: round2(returnsValue),
        netSales: round2(grossSales - returnsValue),
        invoices,
        averageInvoice: invoices ? round2(grossSales / invoices) : 0,
        previousPeriodSales: round2(prevSales),
        changePct,
        approvedExpenses,
        inventoryValue: round2(inventoryValue),
        products: products.length,
        lowStock: lowList.length,
      },
      salesTrend,
      branchPerformance,
      topProducts,
      lowStockItems: lowList.slice(0, 6).map((p) => ({ name: p.name, sku: p.sku, stock: p.stockQuantity, reorderLevel: p.reorderLevel })),
      recentActivity,
      attention,
    };
  }
}

@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get("summary")
  summary(@CurrentUser() u: AuthUser, @Query("days") days?: string, @Query("branchId") branchId?: string) {
    return this.dashboard.summary(u, days, branchId);
  }
}
