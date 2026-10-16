import { Body, Controller, Get, Injectable, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { PrismaService } from "../prisma/prisma.service";
import { PurchaseOrdersService } from "./purchase-orders.service";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { learnedLeadTimes } from "./lead-times";
import { limitBranch, assertBranch } from "../common/branch/branch-scope";

const clamp = (n: number, lo: number, hi: number, dflt: number) => (Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.round(n), lo), hi) : dflt);

@Injectable()
export class ReorderService {
  constructor(private readonly prisma: PrismaService, private readonly orders: PurchaseOrdersService) {}

  /**
   * What to buy, per branch, from recent sales speed.
   * A product is suggested when stock on hand plus stock already on order would run out before a new order could arrive
   * (or is at/below its reorder level). The suggested quantity brings it back up to cover `coverDays` of selling after arrival.
   */
  async suggestions(user: AuthUser, q: { branchId?: string; days?: string; leadDays?: string; coverDays?: string }) {
    const orgId = user.organizationId;
    q = { ...q, branchId: limitBranch(user, q.branchId) }; // limited people only get their own branch
    const days = clamp(Number(q.days), 7, 180, 30), lead = clamp(Number(q.leadDays), 1, 60, 7), cover = clamp(Number(q.coverDays), 1, 90, 14);
    const since = new Date(Date.now() - days * 86_400_000);
    const canCost = user.permissions.includes("PROFIT:READ");
    const branchFilter = q.branchId ? { branchId: q.branchId } : {};

    const [branches, products, inventory, soldRows, openItems, history, learned] = await Promise.all([
      this.prisma.branch.findMany({ where: { organizationId: orgId, ...(q.branchId ? { id: q.branchId } : {}) }, select: { id: true, name: true } }),
      this.prisma.product.findMany({ where: { organizationId: orgId }, select: { id: true, sku: true, name: true, reorderLevel: true, costPrice: true } }),
      this.prisma.inventory.findMany({ where: { organizationId: orgId, ...branchFilter }, select: { productId: true, branchId: true, quantity: true } }),
      this.prisma.saleItem.findMany({
        where: { sale: { organizationId: orgId, status: "COMPLETED", soldAt: { gte: since }, ...branchFilter } },
        select: { productId: true, quantity: true, sale: { select: { branchId: true } } },
      }),
      this.prisma.purchaseOrderItem.findMany({
        where: { purchaseOrder: { organizationId: orgId, status: { in: ["DRAFT", "SENT", "PARTIALLY_RECEIVED"] }, ...branchFilter } },
        select: { productId: true, quantityOrdered: true, quantityReceived: true, purchaseOrder: { select: { branchId: true } } },
      }),
      // last supplier and price paid for each product (also decides how long a new order is expected to take)
      this.prisma.purchaseOrderItem.findMany({
        where: { purchaseOrder: { organizationId: orgId } },
        orderBy: { purchaseOrder: { orderDate: "desc" } },
        select: { productId: true, unitCost: true, purchaseOrder: { select: { supplierId: true, supplier: { select: { name: true, leadTimeDays: true } } } } },
      }),
      learnedLeadTimes(this.prisma, orgId),
    ]);

    const last = new Map<string, { supplierId: string; supplier: string; unitCost: number; leadTimeDays: number | null }>();
    for (const h of history as { productId: string; unitCost: unknown; purchaseOrder: { supplierId: string; supplier: { name: string; leadTimeDays: number | null } } }[]) {
      if (!last.has(h.productId)) last.set(h.productId, { supplierId: h.purchaseOrder.supplierId, supplier: h.purchaseOrder.supplier.name, unitCost: Number(h.unitCost), leadTimeDays: h.purchaseOrder.supplier.leadTimeDays });
    }
    /** Days a new order takes: what the supplier was set to, else what their past deliveries show, else the default on the page. */
    const leadFor = (productId: string): { days: number; source: "supplier" | "learned" | "default"; samples?: number } => {
      const l = last.get(productId);
      if (l?.leadTimeDays) return { days: l.leadTimeDays, source: "supplier" };
      const got = l ? learned.get(l.supplierId) : undefined;
      return got ? { days: got.days, source: "learned", samples: got.samples } : { days: lead, source: "default" };
    };

    const k = (b: string, p: string) => `${b}|${p}`;
    const onHand = new Map<string, number>(inventory.map((i): [string, number] => [k(i.branchId, i.productId), i.quantity]));
    const sold = new Map<string, number>();
    for (const r of soldRows as { productId: string; quantity: number; sale: { branchId: string } }[]) sold.set(k(r.sale.branchId, r.productId), (sold.get(k(r.sale.branchId, r.productId)) ?? 0) + r.quantity);
    const onOrder = new Map<string, number>();
    for (const r of openItems as { productId: string; quantityOrdered: number; quantityReceived: number; purchaseOrder: { branchId: string } }[]) onOrder.set(k(r.purchaseOrder.branchId, r.productId), (onOrder.get(k(r.purchaseOrder.branchId, r.productId)) ?? 0) + Math.max(0, r.quantityOrdered - r.quantityReceived));

    type Row = { branchId: string; branch: string; productId: string; sku: string; name: string; onHand: number; onOrder: number; perDay: number; daysLeft: number | null; suggestedQty: number; urgency: "urgent" | "soon" | "routine"; reason: string; leadDays: number; leadSource: "supplier" | "learned" | "default" };
    const rows: Row[] = [];
    for (const b of branches) {
      for (const p of products) {
        const have = onHand.get(k(b.id, p.id)) ?? 0, ordered = onOrder.get(k(b.id, p.id)) ?? 0, s = sold.get(k(b.id, p.id)) ?? 0;
        const perDay = s / days;
        const L = leadFor(p.id), leadD = L.days;
        if (s === 0 && have > p.reorderLevel) continue;
        const position = have + ordered;
        const trigger = Math.max(p.reorderLevel, Math.ceil(perDay * leadD));
        if (position > trigger) continue;
        const target = Math.max(Math.ceil(perDay * (leadD + cover)), p.reorderLevel * 2);
        const qty = target - position;
        if (qty <= 0) continue;
        const daysLeft = perDay > 0 ? Math.round((have / perDay) * 10) / 10 : null;
        const urgency = have === 0 && perDay > 0 ? "urgent" : daysLeft !== null && daysLeft < leadD ? "soon" : "routine";
        const reason = perDay > 0
          ? `Selling about ${perDay.toFixed(1)}/day; ${have} on hand${ordered ? ` and ${ordered} already on order` : ""} lasts ${daysLeft === null ? "a while" : `${daysLeft} days`}, new stock takes about ${leadD} days to arrive${L.source === "supplier" ? ` (${last.get(p.id)?.supplier}'s lead time)` : L.source === "learned" ? ` (${last.get(p.id)?.supplier} has delivered in about ${leadD} days, from ${L.samples} orders)` : ""}.`
          : `No recent sales, but stock (${have}${ordered ? ` + ${ordered} on order` : ""}) is at or below the reorder level of ${p.reorderLevel}.`;
        rows.push({ branchId: b.id, branch: b.name, productId: p.id, sku: p.sku, name: p.name, onHand: have, onOrder: ordered, perDay: Math.round(perDay * 100) / 100, daysLeft, suggestedQty: qty, urgency, reason, leadDays: leadD, leadSource: L.source });
      }
    }

    const costOf = new Map<string, number | null>(products.map((p): [string, number | null] => [p.id, p.costPrice === null ? null : Number(p.costPrice)]));

    const groups = new Map<string, { branchId: string; branch: string; supplierId: string | null; supplier: string | null; items: (Row & { unitCost: number })[] }>();
    const urgencyRank = { urgent: 0, soon: 1, routine: 2 };
    for (const r of rows) {
      const l = last.get(r.productId);
      const key = `${r.branchId}|${l?.supplierId ?? "none"}`;
      const g = groups.get(key) ?? { branchId: r.branchId, branch: r.branch, supplierId: l?.supplierId ?? null, supplier: l?.supplier ?? null, items: [] };
      g.items.push({ ...r, unitCost: l?.unitCost ?? (canCost ? costOf.get(r.productId) ?? 0 : 0) });
      groups.set(key, g);
    }
    const out = [...groups.values()].map((g) => ({ ...g, items: g.items.sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency] || a.name.localeCompare(b.name)) }));
    out.sort((a, b) => a.branch.localeCompare(b.branch) || (a.supplier ?? "~").localeCompare(b.supplier ?? "~"));
    return { params: { days, leadDays: lead, coverDays: cover }, itemCount: rows.length, groups: out };
  }

  /** Flat list of everything that needs restocking, most urgent first. Same rules as the Reorder page, so every alert in the app agrees with it. */
  async needs(user: AuthUser, branchId?: string) {
    const r = await this.suggestions(user, { branchId });
    const rank = { urgent: 0, soon: 1, routine: 2 };
    return r.groups
      .flatMap((g) => g.items)
      .sort((a, b) => Number(b.onHand === 0) - Number(a.onHand === 0) || rank[a.urgency] - rank[b.urgency] || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  }

  /** One draft purchase order per supplier and branch. Nothing is sent to a supplier; the order stays a draft for a person to review. */
  createDraft(organizationId: string, dto: CreatePurchaseOrderDto) {
    return this.orders.create(organizationId, { ...dto, notes: dto.notes ?? "Created from reorder suggestions" });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("reorder")
export class ReorderController {
  constructor(private readonly reorder: ReorderService) {}

  @Get("suggestions") @RequirePermissions("PURCHASING:READ")
  suggestions(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string, @Query("days") days?: string, @Query("leadDays") leadDays?: string, @Query("coverDays") coverDays?: string) {
    return this.reorder.suggestions(u, { branchId, days, leadDays, coverDays });
  }

  @Post("draft-order") @RequirePermissions("PURCHASING:CREATE")
  draft(@CurrentUser() u: AuthUser, @Body() dto: CreatePurchaseOrderDto) { assertBranch(u, dto.branchId); return this.reorder.createDraft(u.organizationId, dto); }
}
