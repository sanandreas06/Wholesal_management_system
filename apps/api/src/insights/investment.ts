import { Controller, Get, Injectable, Module, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { PrismaService } from "../prisma/prisma.service";
import { returnedLines } from "../sales/returned-lines";
import { limitBranch } from "../common/branch/branch-scope";

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => Math.round(n * 1000) / 10;
const ALLOWED = [30, 90, 180, 365];

type Evidence = { label: string; value: string };
type Link = { label: string; href: string };
export type Recommendation = {
  id: string; kind: "invest" | "review" | "data"; title: string; detail: string; evidence: Evidence[]; links: Link[]; amount?: number;
};

interface P { id: string; sku: string; name: string; costPrice: unknown; unitPrice: unknown; categoryRef: { name: string } | null }
interface Agg { units: number; revenue: number; costedRevenue: number; cost: number; uncostedUnits: number }

/**
 * Where money is working hard and where it is sitting idle.
 * Everything here is arithmetic on the organization's own sales, cost and stock figures. It cannot see seasons, supplier terms or plans,
 * so every item is phrased as "worth reviewing" and shows the numbers behind it.
 */
@Injectable()
export class InvestmentService {
  constructor(private readonly prisma: PrismaService) {}

  async report(user: AuthUser, q: { days?: string; branchId?: string }) {
    const org = user.organizationId;
    q = { ...q, branchId: limitBranch(user, q.branchId) }; // limited people only get their own branch
    const asked = Number(q.days);
    const days = ALLOWED.includes(asked) ? asked : 90;
    const since = new Date(Date.now() - days * 86_400_000);
    const branchFilter = q.branchId ? { branchId: q.branchId } : {};

    const [branches, products, inventory, soldItems, backItems] = await Promise.all([
      this.prisma.branch.findMany({ where: { organizationId: org }, select: { id: true, name: true } }),
      this.prisma.product.findMany({ where: { organizationId: org }, select: { id: true, sku: true, name: true, costPrice: true, unitPrice: true, categoryRef: { select: { name: true } } } }),
      this.prisma.inventory.findMany({ where: { organizationId: org, ...branchFilter }, select: { productId: true, branchId: true, quantity: true } }),
      this.prisma.saleItem.findMany({
        where: { sale: { organizationId: org, status: "COMPLETED", soldAt: { gte: since }, ...branchFilter } },
        select: { productId: true, quantity: true, unitPrice: true, unitCost: true, sale: { select: { branchId: true } } },
      }),
      returnedLines(this.prisma, org, since, null, q.branchId || undefined),
    ]);
    // Goods customers brought back in the period come off units, revenue and profit (negative lines at their original price and cost).
    const items = [...(soldItems as unknown[]), ...backItems];
    const returnedValue = backItems.reduce((t, r) => t + Math.abs(r.quantity) * Number(r.unitPrice), 0);

    const prods = products as P[];
    const byId = new Map<string, P>(prods.map((p): [string, P] => [p.id, p]));
    const costOf = (id: string): number | null => { const c = byId.get(id)?.costPrice; return c === null || c === undefined ? null : Number(c); };
    const empty = (): Agg => ({ units: 0, revenue: 0, costedRevenue: 0, cost: 0, uncostedUnits: 0 });

    // ---- sales by product, by branch, by category
    const prodAgg = new Map<string, Agg>(), branchAgg = new Map<string, Agg>(), catAgg = new Map<string, Agg>(), pbAgg = new Map<string, Agg>();
    const add = (m: Map<string, Agg>, key: string, qty: number, rev: number, unitCost: number | null) => {
      const a = m.get(key) ?? empty();
      a.units += qty; a.revenue += rev;
      if (unitCost === null) a.uncostedUnits += qty; else { a.costedRevenue += rev; a.cost += unitCost * qty; }
      m.set(key, a);
    };
    for (const it of items as { productId: string; quantity: number; unitPrice: unknown; unitCost: unknown; sale: { branchId: string } }[]) {
      const rev = it.quantity * Number(it.unitPrice);
      const uc = it.unitCost === null || it.unitCost === undefined ? null : Number(it.unitCost);
      const cat = byId.get(it.productId)?.categoryRef?.name ?? "Uncategorised";
      add(prodAgg, it.productId, it.quantity, rev, uc);
      add(branchAgg, it.sale.branchId, it.quantity, rev, uc);
      add(catAgg, cat, it.quantity, rev, uc);
      add(pbAgg, `${it.sale.branchId}|${it.productId}`, it.quantity, rev, uc);
    }

    // ---- stock on hand
    const onHand = new Map<string, number>(), stockByBranch = new Map<string, number>(), stockByCat = new Map<string, number>();
    const pbHand = new Map<string, number>();
    let uncostedStock = 0;
    for (const i of inventory as { productId: string; branchId: string; quantity: number }[]) {
      onHand.set(i.productId, (onHand.get(i.productId) ?? 0) + i.quantity);
      pbHand.set(`${i.branchId}|${i.productId}`, i.quantity);
      const c = costOf(i.productId);
      if (c === null) { if (i.quantity > 0) uncostedStock += 1; continue; }
      const v = c * i.quantity;
      stockByBranch.set(i.branchId, (stockByBranch.get(i.branchId) ?? 0) + v);
      const cat = byId.get(i.productId)?.categoryRef?.name ?? "Uncategorised";
      stockByCat.set(cat, (stockByCat.get(cat) ?? 0) + v);
    }

    const profitOf = (a: Agg) => a.costedRevenue - a.cost;
    const marginOf = (a: Agg) => (a.costedRevenue > 0 ? profitOf(a) / a.costedRevenue : null);
    let totalRevenue = 0, totalCosted = 0, totalCost = 0;
    for (const a of prodAgg.values()) { totalRevenue += a.revenue; totalCosted += a.costedRevenue; totalCost += a.cost; }
    const totalProfit = totalCosted - totalCost;
    const overallMargin = totalCosted > 0 ? totalProfit / totalCosted : null;
    const stockValue = [...stockByBranch.values()].reduce((s, v) => s + v, 0);

    // ---- per product rows
    type Row = { id: string; sku: string; name: string; onHand: number; units: number; revenue: number; profit: number | null; margin: number | null; perDay: number; coverDays: number | null; stockValue: number | null };
    const rows: Row[] = prods.map((p) => {
      const a = prodAgg.get(p.id) ?? empty();
      const have = onHand.get(p.id) ?? 0, c = costOf(p.id), perDay = a.units / days;
      return {
        id: p.id, sku: p.sku, name: p.name, onHand: have, units: a.units, revenue: r2(a.revenue),
        profit: a.costedRevenue > 0 ? r2(profitOf(a)) : null, margin: marginOf(a) === null ? null : pct(marginOf(a) as number),
        perDay: r2(perDay), coverDays: perDay > 0 ? Math.round((have / perDay) * 10) / 10 : null, stockValue: c === null ? null : r2(c * have),
      };
    });

    // ---- slow / idle stock (cash sitting on shelves)
    const slowDays = Math.max(90, days);
    const slow = rows
      .filter((r) => r.onHand > 0 && r.stockValue !== null && r.stockValue > 0 && (r.units === 0 || (r.coverDays !== null && r.coverDays > slowDays)))
      .sort((a, b) => (b.stockValue as number) - (a.stockValue as number));
    const slowValue = slow.reduce((s, r) => s + (r.stockValue as number), 0);

    // ---- products earning well but running short
    const winners = rows
      .filter((r) => r.profit !== null && r.profit > 0 && r.margin !== null && overallMargin !== null && r.margin >= pct(overallMargin) && r.coverDays !== null && r.coverDays < 21)
      .sort((a, b) => (b.profit as number) - (a.profit as number));

    // ---- thin margin on products that sell a lot
    const revs = rows.filter((r) => r.revenue > 0).map((r) => r.revenue).sort((a, b) => a - b);
    const medianRev = revs.length ? revs[Math.floor(revs.length / 2)] : 0;
    const thin = rows
      .filter((r) => r.margin !== null && overallMargin !== null && r.revenue >= medianRev && r.revenue > 0 && r.margin < Math.max(5, pct(overallMargin) / 2))
      .sort((a, b) => b.revenue - a.revenue);

    // ---- branches
    const branchRows = (branches as { id: string; name: string }[]).filter((b) => !q.branchId || b.id === q.branchId).map((b) => {
      const a = branchAgg.get(b.id) ?? empty(), sv = stockByBranch.get(b.id) ?? 0;
      let slowHere = 0;
      for (const p of prods) {
        const have = pbHand.get(`${b.id}|${p.id}`) ?? 0, c = costOf(p.id);
        if (have <= 0 || c === null) continue;
        const sold = pbAgg.get(`${b.id}|${p.id}`)?.units ?? 0, perDay = sold / days;
        if (sold === 0 || have / perDay > slowDays) slowHere += c * have;
      }
      const cogsPerDay = a.cost / days;
      return {
        id: b.id, name: b.name, revenue: r2(a.revenue), profit: a.costedRevenue > 0 ? r2(profitOf(a)) : null,
        margin: marginOf(a) === null ? null : pct(marginOf(a) as number), stockValue: r2(sv), slowValue: r2(slowHere),
        slowPct: sv > 0 ? pct(slowHere / sv) : 0, stockDays: cogsPerDay > 0 ? Math.round(sv / cogsPerDay) : null,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // ---- categories: share of profit against share of money tied up
    const catNames = new Set<string>([...catAgg.keys(), ...stockByCat.keys()]);
    const catRows = [...catNames].map((name) => {
      const a = catAgg.get(name) ?? empty(), sv = stockByCat.get(name) ?? 0;
      const profitShare = totalProfit > 0 ? profitOf(a) / totalProfit : 0, stockShare = stockValue > 0 ? sv / stockValue : 0;
      return { name, revenue: r2(a.revenue), profit: a.costedRevenue > 0 ? r2(profitOf(a)) : null, stockValue: r2(sv), profitShare: pct(profitShare), stockShare: pct(stockShare), ratio: stockShare > 0 ? Math.round((profitShare / stockShare) * 100) / 100 : null };
    }).sort((a, b) => b.stockValue - a.stockValue);

    // ---- plain-language recommendations, each with its evidence
    const recs: Recommendation[] = [];
    const money = (n: number) => r2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const prodLinks = (r: Row): Link[] => [{ label: "See its sales", href: `/sales?productId=${r.id}` }, { label: "Reorder", href: "/reorder" }];

    for (const w of winners.slice(0, 5)) {
      recs.push({
        id: `invest-${w.id}`, kind: "invest", title: `${w.name} may be worth stocking more of`,
        detail: `It earns a margin of ${w.margin}% (company average ${pct(overallMargin as number)}%) and the ${w.onHand} on hand would last about ${w.coverDays} days at the current pace.`,
        evidence: [{ label: `Gross profit, last ${days} days`, value: money(w.profit as number) }, { label: "Margin", value: `${w.margin}%` }, { label: "Selling", value: `${w.perDay}/day` }, { label: "On hand", value: String(w.onHand) }, { label: "Days of stock", value: String(w.coverDays) }],
        links: prodLinks(w),
      });
    }
    if (slow.length) {
      recs.push({
        id: "review-slow-stock", kind: "review", title: `${money(slowValue)} is tied up in slow or unsold stock`,
        detail: `${slow.length} product${slow.length === 1 ? "" : "s"} either did not sell at all in ${days} days or hold more than ${slowDays} days of stock. That is ${stockValue > 0 ? pct(slowValue / stockValue) : 0}% of the stock you hold at cost. Worth reviewing before buying more of them.`,
        evidence: slow.slice(0, 5).map((r) => ({ label: `${r.name} (${r.onHand} on hand)`, value: `${money(r.stockValue as number)}${r.units === 0 ? ", no sales" : `, ${r.coverDays} days of stock`}` })),
        links: [{ label: "Open stock levels", href: "/inventory" }], amount: r2(slowValue),
      });
    }
    for (const t of thin.slice(0, 3)) {
      recs.push({
        id: `review-margin-${t.id}`, kind: "review", title: `${t.name} sells well but earns very little per sale`,
        detail: `Its margin is ${t.margin}% against ${pct(overallMargin as number)}% for the business. Worth checking whether the selling price or the supplier cost can improve.`,
        evidence: [{ label: "Revenue", value: money(t.revenue) }, { label: "Margin", value: `${t.margin}%` }, { label: "Gross profit", value: money(t.profit as number) }], links: prodLinks(t),
      });
    }
    const worstBranch = [...branchRows].filter((b) => b.stockValue > 0).sort((a, b) => b.slowPct - a.slowPct)[0];
    if (!q.branchId && branchRows.length > 1 && worstBranch && worstBranch.slowPct >= 30) {
      recs.push({
        id: `review-branch-${worstBranch.id}`, kind: "review", title: `${worstBranch.name} holds the most idle stock`,
        detail: `${worstBranch.slowPct}% of the stock there (${money(worstBranch.slowValue)}) is slow or unsold. Moving some to a busier branch may be better than buying new stock.`,
        evidence: [{ label: "Stock at cost", value: money(worstBranch.stockValue) }, { label: "Slow or unsold", value: money(worstBranch.slowValue) }],
        links: [{ label: "See its sales", href: `/sales?branchId=${worstBranch.id}` }, { label: "Stock transfers", href: "/stock-transfers" }],
      });
    }
    for (const c of catRows.filter((x) => x.ratio !== null && x.ratio < 0.6 && x.stockShare >= 10)) {
      recs.push({
        id: `review-cat-${c.name}`, kind: "review", title: `${c.name} ties up more money than it earns`,
        detail: `It holds ${c.stockShare}% of your stock at cost but produces ${c.profitShare}% of gross profit. Worth reviewing how much of it you carry.`,
        evidence: [{ label: "Share of stock", value: `${c.stockShare}%` }, { label: "Share of profit", value: `${c.profitShare}%` }], links: [{ label: "Open products", href: "/products" }],
      });
    }
    const uncostedSold = rows.filter((r) => r.units > 0 && r.profit === null).length;
    if (uncostedSold > 0 || uncostedStock > 0) {
      recs.push({
        id: "data-missing-cost", kind: "data", title: "Some products have no cost price, so these figures are incomplete",
        detail: `${uncostedSold} product${uncostedSold === 1 ? "" : "s"} that sold and ${uncostedStock} stock line${uncostedStock === 1 ? "" : "s"} have no cost recorded and are left out of profit and stock value. Adding costs makes every number on this page more trustworthy.`,
        evidence: [], links: [{ label: "Open products", href: "/products" }],
      });
    }

    return {
      params: { days, branchId: q.branchId ?? null },
      summary: {
        revenue: r2(totalRevenue), grossProfit: totalCosted > 0 ? r2(totalProfit) : null, margin: overallMargin === null ? null : pct(overallMargin),
        stockValue: r2(stockValue), slowValue: r2(slowValue), slowPct: stockValue > 0 ? pct(slowValue / stockValue) : 0,
        profitPerStock: stockValue > 0 && totalCosted > 0 ? Math.round((totalProfit / stockValue) * 100) / 100 : null,
        costCoverage: totalRevenue > 0 ? pct(totalCosted / totalRevenue) : null,
      },
      recommendations: recs,
      branches: branchRows,
      categories: catRows,
      slowStock: slow.slice(0, 15),
      topEarners: [...rows].filter((r) => r.profit !== null).sort((a, b) => (b.profit as number) - (a.profit as number)).slice(0, 10),
      notes: [
        "These are calculations on your own sales, cost and stock figures, not predictions.",
        "They cannot see seasons, supplier terms, promotions or upcoming orders, so treat each item as a prompt to review, not an instruction.",
        "Gross profit only counts sales where a cost was recorded. Goods customers brought back in the period are taken off units, revenue and profit" + (returnedValue > 0 ? ` (${money(returnedValue)} returned in this period).` : "."),
      ],
    };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("insights")
export class InvestmentController {
  constructor(private readonly svc: InvestmentService) {}
  @Get("investment") @RequirePermissions("PROFIT:READ")
  investment(@CurrentUser() u: AuthUser, @Query("days") days?: string, @Query("branchId") branchId?: string) { return this.svc.report(u, { days, branchId }); }
}

@Module({ controllers: [InvestmentController], providers: [InvestmentService] })
export class InsightsModule {}
