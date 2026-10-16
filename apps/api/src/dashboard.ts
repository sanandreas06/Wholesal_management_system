import { Controller, Get, Injectable, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { CurrentUser } from "./common/decorators/current-user.decorator";
import { AuthUser } from "./common/types/auth-user.type";
import { ReorderService } from "./purchase-orders/reorder";
import { returnedLines } from "./sales/returned-lines";
import { limitBranch } from "./common/branch/branch-scope";

const ALLOWED_DAYS = [7, 30, 90];
const DAY_MS = 86_400_000;

function startOfDayUtc(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
const num = (v: unknown) => Number(v ?? 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly reorder: ReorderService) {}

  async summary(user: AuthUser, rawDays?: string, branchId?: string) {
    const orgId = user.organizationId;
    branchId = limitBranch(user, branchId); // someone limited to one branch only ever gets their own
    const parsed = Number(rawDays);
    const days = ALLOWED_DAYS.includes(parsed) ? parsed : 30;
    const can = (p: string) => user.permissions.includes(p);

    const today = startOfDayUtc(new Date());
    const from = new Date(today.getTime() - (days - 1) * DAY_MS);
    const to = new Date(today.getTime() + DAY_MS); // exclusive
    const prevFrom = new Date(from.getTime() - days * DAY_MS);

    const branchFilter = branchId ? { branchId } : {};
    const saleWhere = { organizationId: orgId, status: "COMPLETED" as const, ...branchFilter };

    const [sales, prevAgg, branches, productsAll, topGroups, returnItems, movements, recentSalesRaw] = await Promise.all([
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
        select: { id: true, sku: true, name: true, category: true, unitPrice: true, stockQuantity: true, reorderLevel: true, categoryRef: { select: { name: true } } },
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
      this.prisma.sale.findMany({
        where: { organizationId: orgId, ...branchFilter },
        orderBy: { soldAt: "desc" },
        take: 5,
        select: {
          id: true, invoiceNumber: true, status: true, totalAmount: true, soldAt: true,
          customer: { select: { name: true } },
          branch: { select: { name: true } },
          payments: { select: { amount: true } },
        },
      }),
    ]);

    // Stock on the product row is the total across all branches; when looking at one branch, use that branch's own stock.
    let products = productsAll;
    if (branchId) {
      const mine: { productId: string; quantity: number }[] = await this.prisma.inventory.findMany({ where: { organizationId: orgId, branchId }, select: { productId: true, quantity: true } });
      const qty = new Map<string, number>(mine.map((i): [string, number] => [i.productId, i.quantity]));
      products = productsAll.map((p) => ({ ...p, stockQuantity: qty.get(p.id) ?? 0 }));
    }

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
        return { id: b.id, branch: b.name, amount: round2(mine.reduce((a, s) => a + num(s.totalAmount), 0)), invoices: mine.length };
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

    // ---- inventory by category (top 4 + others)
    const catTotals = new Map<string, number>();
    for (const p of products) {
      const name = p.categoryRef?.name ?? p.category ?? "Uncategorised";
      catTotals.set(name, (catTotals.get(name) ?? 0) + num(p.unitPrice) * p.stockQuantity);
    }
    const catSorted = [...catTotals.entries()].sort((a, b) => b[1] - a[1]);
    const inventoryByCategory = catSorted.slice(0, 4).map(([name, value]) => ({ name, value: round2(value) }));
    const othersValue = catSorted.slice(4).reduce((s2, [, v]) => s2 + v, 0);
    if (othersValue > 0) inventoryByCategory.push({ name: "Others", value: round2(othersValue) });

    // ---- recent sales
    const recentSales = recentSalesRaw.map((r) => {
      const paid = r.payments.reduce((s2, x) => s2 + num(x.amount), 0);
      const total = num(r.totalAmount);
      const payment = r.status === "VOIDED" ? "Voided" : paid >= total - 0.005 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
      return {
        id: r.id, invoiceNumber: r.invoiceNumber, customer: r.customer?.name ?? "Walk-in",
        branch: r.branch.name, amount: round2(total), soldAt: r.soldAt, payment,
      };
    });

    // ---- stock alerts (out of stock first, then lowest)
    // same rules as the Reorder page: per branch, using stock on hand, stock on order and how fast it sells
    const needs = await this.reorder.needs(user, branchId);
    const stockAlerts = needs.slice(0, 5).map((n) => ({
      name: n.name, sku: n.sku, branch: n.branch, stock: n.onHand, daysLeft: n.daysLeft, suggestedQty: n.suggestedQty,
      level: n.onHand === 0 ? "out" : "low",
    }));

    // ---- sections that depend on what the viewer is allowed to see
    const attention: { pendingExpenses?: number; openVarianceCases?: number; importedSales?: number } = {};
    let approvedExpenses: number | null = null;
    let prevExpenses: number | null = null;
    let deposits: number | null = null;
    let prevDeposits: number | null = null;
    let outstanding: number | null = null;
    let profitInfo: { profit: number; previous: number; margin: number | null; coverage: number | null; byBranch: Map<string, number> } | null = null;

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
          .aggregate({
            where: { organizationId: orgId, ...branchFilter, status: "APPROVED", expenseDate: { gte: prevFrom, lt: from } },
            _sum: { amount: true },
          })
          .then((r) => { prevExpenses = round2(num(r._sum.amount)); }),
        this.prisma.expense
          .count({ where: { organizationId: orgId, ...branchFilter, status: "PENDING" } })
          .then((n) => { attention.pendingExpenses = n; }),
      );
    }
    if (can("PROFIT:READ")) {
      const lineSelect = { quantity: true, unitPrice: true, unitCost: true, sale: { select: { branchId: true } } };
      const sum = (rows: { quantity: number; unitPrice: unknown; unitCost: unknown; sale: { branchId: string } }[]) => {
        let profit = 0, knownRev = 0, totalRev = 0;
        const byBranch = new Map<string, number>();
        for (const r of rows) {
          const rev = r.quantity * num(r.unitPrice);
          totalRev += rev;
          if (r.unitCost === null || r.unitCost === undefined) continue;
          const p = rev - r.quantity * num(r.unitCost);
          profit += p; knownRev += rev;
          byBranch.set(r.sale.branchId, (byBranch.get(r.sale.branchId) ?? 0) + p);
        }
        return { profit, knownRev, totalRev, byBranch };
      };
      extras.push(
        Promise.all([
          this.prisma.saleItem.findMany({ where: { sale: { ...saleWhere, soldAt: { gte: from, lt: to } } }, select: lineSelect }),
          this.prisma.saleItem.findMany({ where: { sale: { ...saleWhere, soldAt: { gte: prevFrom, lt: from } } }, select: lineSelect }),
          returnedLines(this.prisma, orgId, from, to, branchId),
          returnedLines(this.prisma, orgId, prevFrom, from, branchId),
        ]).then(([cur, prev, curBack, prevBack]) => {
          // Goods brought back in a period come off that period's profit, at the price and cost they were sold at.
          const c = sum([...cur, ...curBack]), p = sum([...prev, ...prevBack]);
          profitInfo = {
            profit: round2(c.profit), previous: round2(p.profit),
            margin: c.knownRev > 0 ? round2((c.profit / c.knownRev) * 100) : null,
            coverage: c.totalRev > 0 ? round2((c.knownRev / c.totalRev) * 100) : null,
            byBranch: c.byBranch,
          };
        }),
      );
    }
    if (can("DEPOSITS:READ")) {
      extras.push(
        this.prisma.deposit
          .aggregate({ where: { organizationId: orgId, ...branchFilter, depositDate: { gte: from, lt: to } }, _sum: { amount: true } })
          .then((r) => { deposits = round2(num(r._sum.amount)); }),
        this.prisma.deposit
          .aggregate({ where: { organizationId: orgId, ...branchFilter, depositDate: { gte: prevFrom, lt: from } }, _sum: { amount: true } })
          .then((r) => { prevDeposits = round2(num(r._sum.amount)); }),
      );
    }
    if (can("SALES:READ")) {
      extras.push(
        this.prisma.sale
          .findMany({ where: saleWhere, select: { totalAmount: true, payments: { select: { amount: true } } } })
          .then((rows) => {
            outstanding = round2(rows.reduce((t, r) => t + Math.max(0, num(r.totalAmount) - r.payments.reduce((a2, x) => a2 + num(x.amount), 0)), 0));
          }),
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

    // ---- plain, rule-based insights (no model involved)
    const insights: string[] = [];
    if (changePct !== null) insights.push(`Sales are ${changePct >= 0 ? "up" : "down"} ${Math.abs(changePct)}% compared with the previous ${days} days.`);
    if (topProducts[0]) insights.push(`${topProducts[0].name} is the top seller in this period (${topProducts[0].quantity} units).`);
    const reorder = lowList.filter((p) => p.stockQuantity > 0).slice(0, 2).map((p) => p.name);
    if (lowList.some((p) => p.stockQuantity === 0)) insights.push(`${lowList.filter((p) => p.stockQuantity === 0).length} item(s) are out of stock.`);
    if (reorder.length) insights.push(`You may need to reorder ${reorder.join(" and ")}.`);
    const last7 = salesTrend.slice(-7).reduce((t, d) => t + d.amount, 0);
    if (last7 > 0) insights.push(`At the last 7 days' pace, the next 7 days would bring about ${Math.round(last7).toLocaleString("en-GH")} GHS (a simple average, not a forecast model).`);

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
        previousExpenses: prevExpenses,
        deposits,
        previousDeposits: prevDeposits,
        outstanding,
        grossProfit: profitInfo ? (profitInfo as { profit: number }).profit : null,
        previousProfit: profitInfo ? (profitInfo as { previous: number }).previous : null,
        marginPct: profitInfo ? (profitInfo as { margin: number | null }).margin : null,
        costCoverage: profitInfo ? (profitInfo as { coverage: number | null }).coverage : null,
        inventoryValue: round2(inventoryValue),
        products: products.length,
        lowStock: needs.length,
        outOfStock: needs.filter((n) => n.onHand === 0).length,
      },
      salesTrend,
      branchPerformance: branchPerformance.map((b) => ({
        ...b,
        profit: profitInfo ? round2((profitInfo as { byBranch: Map<string, number> }).byBranch.get(b.id) ?? 0) : null,
      })),
      topProducts,
      lowStockItems: lowList.slice(0, 6).map((p) => ({ name: p.name, sku: p.sku, stock: p.stockQuantity, reorderLevel: p.reorderLevel })),
      recentActivity,
      inventoryByCategory,
      recentSales,
      stockAlerts,
      insights,
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
