import { Controller, Get, Injectable, Module, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { limitBranch } from "../common/branch/branch-scope";
import { PrismaService } from "../prisma/prisma.service";

const DAY = 86_400_000;
const num = (v: unknown) => Number(v ?? 0);

/** The extra screens on the Home page: where goods are, what is waiting for someone, and how far along the company's set-up is. */
@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async tracking(u: AuthUser) {
    const org = u.organizationId, can = (p: string) => u.permissions.includes(p);
    const branch = limitBranch(u, undefined);
    const bf = branch ? { branchId: branch } : {};
    const since = new Date(Date.now() - 30 * DAY);

    // ---- products: what sells, what is on the shelves, what is running out (with pictures)
    let topSelling: unknown[] = [], topStocked: unknown[] = [], lowStock: unknown[] = [], byBranch: unknown[] = [];
    if (can("PRODUCTS:READ") || can("INVENTORY:READ")) {
      const inv = await this.prisma.inventory.findMany({ where: { organizationId: org, ...bf }, select: { productId: true, quantity: true, branch: { select: { id: true, name: true } } } });
      const qtyByProduct = new Map<string, { total: number; branches: { name: string; qty: number }[] }>();
      for (const i of inv) { const e = qtyByProduct.get(i.productId) ?? { total: 0, branches: [] }; e.total += i.quantity; e.branches.push({ name: i.branch.name, qty: i.quantity }); qtyByProduct.set(i.productId, e); }
      const products = await this.prisma.product.findMany({ where: { organizationId: org }, select: { id: true, name: true, sku: true, unitPrice: true, reorderLevel: true, imageThumb: true, unit: { select: { name: true } } } });
      const shape = (p: (typeof products)[number], extra: Record<string, unknown> = {}) => {
        const q = qtyByProduct.get(p.id) ?? { total: 0, branches: [] };
        return { id: p.id, name: p.name, sku: p.sku, imageUrl: p.imageThumb, unit: p.unit?.name ?? null, onHand: q.total, reorderLevel: p.reorderLevel, price: num(p.unitPrice), branches: q.branches.sort((a, b) => b.qty - a.qty), ...extra };
      };
      const sold = await this.prisma.saleItem.groupBy({ by: ["productId"], where: { sale: { organizationId: org, status: "COMPLETED", soldAt: { gte: since }, ...bf } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { quantity: "desc" } }, take: 6 });
      const pById = new Map(products.map((p) => [p.id, p]));
      topSelling = sold.filter((s) => pById.has(s.productId)).map((s) => shape(pById.get(s.productId)!, { sold: s._sum.quantity ?? 0, revenue: num(s._sum.lineTotal) }));
      topStocked = [...products].map((p) => shape(p)).sort((a, b) => b.onHand - a.onHand).slice(0, 6);
      // low in at least one branch (a product can be fine overall and still empty in one shop)
      const minQty = (p: ReturnType<typeof shape>) => Math.min(...p.branches.map((b) => b.qty));
      lowStock = products.map((p) => shape(p)).filter((p) => p.branches.some((b) => b.qty <= p.reorderLevel))
        .map((p) => ({ ...p, lowAt: p.branches.filter((b) => b.qty <= p.reorderLevel).map((b) => b.name) }))
        .sort((a, b) => b.lowAt.length - a.lowAt.length || minQty(a) - minQty(b)).slice(0, 8);
      const branches = await this.prisma.branch.findMany({ where: { organizationId: org, ...(branch ? { id: branch } : {}) }, select: { id: true, name: true } });
      const price = new Map(products.map((p) => [p.id, num(p.unitPrice)]));
      const reorder = new Map(products.map((p) => [p.id, p.reorderLevel]));
      byBranch = branches.map((b) => {
        const rows = inv.filter((i) => i.branch.id === b.id);
        return { id: b.id, name: b.name, units: rows.reduce((t, i) => t + i.quantity, 0), value: rows.reduce((t, i) => t + i.quantity * (price.get(i.productId) ?? 0), 0), items: rows.length, low: rows.filter((i) => i.quantity <= (reorder.get(i.productId) ?? 0)).length };
      });
    }

    // ---- what is waiting for someone
    const pending: Record<string, number | null> = { ordersToReceive: null, ordersPartlyReceived: null, transfersInTransit: null, transfersWaiting: null, expensesToApprove: null, unpaidInvoices: null, countsInProgress: null, openVariance: null };
    let unpaidAmount: number | null = null;
    const jobs: Promise<void>[] = [];
    if (can("PURCHASING:READ")) jobs.push(
      this.prisma.purchaseOrder.count({ where: { organizationId: org, ...bf, status: "SENT" } }).then((n) => { pending.ordersToReceive = n; }),
      this.prisma.purchaseOrder.count({ where: { organizationId: org, ...bf, status: "PARTIALLY_RECEIVED" } }).then((n) => { pending.ordersPartlyReceived = n; }));
    if (can("STOCK_TRANSFERS:READ")) {
      const ends = branch ? { OR: [{ fromBranchId: branch }, { toBranchId: branch }] } : {};
      jobs.push(
        this.prisma.stockTransfer.count({ where: { organizationId: org, ...ends, status: "DISPATCHED" } }).then((n) => { pending.transfersInTransit = n; }),
        this.prisma.stockTransfer.count({ where: { organizationId: org, ...ends, status: { in: ["DRAFT", "APPROVED"] } } }).then((n) => { pending.transfersWaiting = n; }));
    }
    if (can("EXPENSES:READ")) jobs.push(this.prisma.expense.count({ where: { organizationId: org, ...bf, status: "PENDING" } }).then((n) => { pending.expensesToApprove = n; }));
    if (can("STOCK_COUNTS:READ")) jobs.push(this.prisma.stockCount.count({ where: { organizationId: org, ...bf, status: "DRAFT" } }).then((n) => { pending.countsInProgress = n; }));
    if (can("VARIANCE_CASES:READ")) jobs.push(this.prisma.varianceCase.count({ where: { organizationId: org, ...bf, status: { in: ["OPEN", "INVESTIGATING"] } } }).then((n) => { pending.openVariance = n; }));
    if (can("SALES:READ")) jobs.push((async () => {
      const sales = await this.prisma.sale.findMany({ where: { organizationId: org, ...bf, status: "COMPLETED", soldAt: { gte: new Date(Date.now() - 180 * DAY) } }, select: { totalAmount: true, payments: { select: { amount: true } } }, take: 5000 });
      let n = 0, amt = 0;
      for (const s of sales) { const owed = num(s.totalAmount) - s.payments.reduce((t, p) => t + num(p.amount), 0); if (owed > 0.005) { n++; amt += owed; } }
      pending.unpaidInvoices = n; unpaidAmount = Math.round(amt * 100) / 100;
    })());
    await Promise.all(jobs);

    // ---- goods on the way
    let transfers: unknown[] = [], orders: unknown[] = [];
    if (can("STOCK_TRANSFERS:READ")) {
      const rows = await this.prisma.stockTransfer.findMany({ where: { organizationId: org, status: "DISPATCHED", ...(branch ? { OR: [{ fromBranchId: branch }, { toBranchId: branch }] } : {}) }, orderBy: { dispatchedAt: "desc" }, take: 6, select: { id: true, transferNumber: true, dispatchedAt: true, fromBranch: { select: { name: true } }, toBranch: { select: { name: true } }, items: { select: { quantity: true, product: { select: { name: true } } } } } });
      transfers = rows.map((t) => ({ id: t.id, number: t.transferNumber, from: t.fromBranch.name, to: t.toBranch.name, dispatchedAt: t.dispatchedAt, units: t.items.reduce((s, i) => s + i.quantity, 0), items: t.items.slice(0, 3).map((i) => i.product.name) }));
    }
    if (can("PURCHASING:READ")) {
      const rows = await this.prisma.purchaseOrder.findMany({ where: { organizationId: org, ...bf, status: { in: ["SENT", "PARTIALLY_RECEIVED"] } }, orderBy: { expectedDate: "asc" }, take: 6, select: { id: true, orderNumber: true, status: true, expectedDate: true, supplier: { select: { name: true } }, branch: { select: { name: true } }, items: { select: { quantityOrdered: true, quantityReceived: true } } } });
      orders = rows.map((o) => ({ id: o.id, number: o.orderNumber, status: o.status, supplier: o.supplier.name, branch: o.branch.name, expectedDate: o.expectedDate, ordered: o.items.reduce((s, i) => s + i.quantityOrdered, 0), received: o.items.reduce((s, i) => s + i.quantityReceived, 0) }));
    }
    return { topSelling, topStocked, lowStock, byBranch, pending, unpaidAmount, onTheWay: { transfers, orders } };
  }

  /** Plain counts the Getting Started checklist turns into ticks. */
  async gettingStarted(u: AuthUser) {
    const org = u.organizationId;
    const [o, branches, products, customers, suppliers, sales, users, orders, imports, movements] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: org }, select: { setupPending: true, logo: true, referralCode: true, createdAt: true, isDemo: true } }),
      this.prisma.branch.count({ where: { organizationId: org } }),
      this.prisma.product.count({ where: { organizationId: org } }),
      this.prisma.customer.count({ where: { organizationId: org } }),
      this.prisma.supplier.count({ where: { organizationId: org } }),
      this.prisma.sale.count({ where: { organizationId: org } }),
      this.prisma.user.count({ where: { organizationId: org } }),
      this.prisma.purchaseOrder.count({ where: { organizationId: org } }),
      this.prisma.importBatch.count({ where: { organizationId: org } }),
      this.prisma.stockMovement.count({ where: { organizationId: org } }),
    ]);
    const me = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { totpEnabledAt: true } });
    return { profileDone: !o?.setupPending, hasLogo: !!o?.logo, branches, products, customers, suppliers, sales, users, orders, imports, stockEntries: movements, authenticator: !!me?.totpEnabledAt, createdAt: o?.createdAt ?? null, demo: !!o?.isDemo };
  }
}

@UseGuards(JwtAuthGuard)
@Controller("home")
export class HomeController {
  constructor(private readonly home: HomeService) {}
  @Get("tracking") tracking(@CurrentUser() u: AuthUser) { return this.home.tracking(u); }
  @Get("getting-started") gettingStarted(@CurrentUser() u: AuthUser) { return this.home.gettingStarted(u); }
}

@Module({ controllers: [HomeController], providers: [HomeService] })
export class HomeModule {}
