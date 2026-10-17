import { Injectable, Logger } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { OnboardingService } from "./onboarding.service";
import { BRANCHES, CUSTOMERS, DEMO_COMPANY, DEMO_EMAIL, FINAL_STOCK, PRODUCTS, STAFF, SUPPLIERS, rng, tile } from "./demo-data";

const DAY = 86_400_000;
const DAYS_OF_HISTORY = 45;

/** The shared, read-only company anyone can try. It is built the first time someone asks for it, and its dates are moved forward so it always looks current. */
@Injectable()
export class DemoService {
  private readonly log = new Logger("Demo");
  private building: Promise<string> | null = null;
  constructor(private readonly prisma: PrismaService, private readonly onboarding: OnboardingService) {}

  /** Returns the demo user's id, building or refreshing the sample company first when needed. */
  ensure(): Promise<string> {
    if (!this.building) this.building = this.run().finally(() => { this.building = null; });
    return this.building;
  }

  private async run(): Promise<string> {
    const org = await this.prisma.organization.findFirst({ where: { isDemo: true } });
    if (!org) return this.build();
    const user = await this.prisma.user.findFirst({ where: { organizationId: org.id, email: DEMO_EMAIL } });
    if (!user) return this.rebuildAfterIncompleteRun(org.id);
    await this.moveForward(org.id);
    return user.id;
  }

  private async rebuildAfterIncompleteRun(orgId: string): Promise<string> {
    await this.prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    return this.build();
  }

  /** Keeps the newest sale at yesterday by moving every date forward by whole days. */
  private async moveForward(orgId: string) {
    const newest = await this.prisma.sale.findFirst({ where: { organizationId: orgId }, orderBy: { soldAt: "desc" }, select: { soldAt: true } });
    if (!newest) return;
    const startOf = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const days = Math.floor((startOf(new Date()) - DAY - startOf(newest.soldAt)) / DAY);
    if (days < 1) return;
    const n = Math.floor(days), iv = `${n} days`;
    await this.prisma.$transaction([
      this.prisma.$executeRawUnsafe(`UPDATE "Sale" SET "soldAt" = "soldAt" + interval '${iv}', "createdAt" = "createdAt" + interval '${iv}' WHERE "organizationId" = $1`, orgId),
      this.prisma.$executeRawUnsafe(`UPDATE "Payment" SET "receivedAt" = "receivedAt" + interval '${iv}', "createdAt" = "createdAt" + interval '${iv}' WHERE "organizationId" = $1`, orgId),
      this.prisma.$executeRawUnsafe(`UPDATE "Expense" SET "expenseDate" = "expenseDate" + interval '${iv}', "createdAt" = "createdAt" + interval '${iv}', "reviewedAt" = "reviewedAt" + interval '${iv}' WHERE "organizationId" = $1`, orgId),
      this.prisma.$executeRawUnsafe(`UPDATE "Deposit" SET "depositDate" = "depositDate" + interval '${iv}', "createdAt" = "createdAt" + interval '${iv}' WHERE "organizationId" = $1`, orgId),
      this.prisma.$executeRawUnsafe(`UPDATE "StockMovement" SET "createdAt" = "createdAt" + interval '${iv}' WHERE "organizationId" = $1`, orgId),
      this.prisma.$executeRawUnsafe(`UPDATE "PurchaseOrder" SET "orderDate" = "orderDate" + interval '${iv}', "expectedDate" = "expectedDate" + interval '${iv}', "createdAt" = "createdAt" + interval '${iv}', "updatedAt" = "updatedAt" + interval '${iv}' WHERE "organizationId" = $1`, orgId),
      this.prisma.$executeRawUnsafe(`UPDATE "StockTransfer" SET "createdAt" = "createdAt" + interval '${iv}', "approvedAt" = "approvedAt" + interval '${iv}', "dispatchedAt" = "dispatchedAt" + interval '${iv}', "receivedAt" = "receivedAt" + interval '${iv}', "updatedAt" = "updatedAt" + interval '${iv}' WHERE "organizationId" = $1`, orgId),
    ]);
    this.log.log(`demo company moved forward by ${n} days`);
  }

  private async build(): Promise<string> {
    this.log.log("building the demo company");
    const random = await bcrypt.hash(randomBytes(24).toString("hex"), 8);
    const made = await this.onboarding.createCompany({ companyName: DEMO_COMPANY, email: DEMO_EMAIL, name: "Demo User", passwordHash: random, passwordSet: false, via: "demo" });
    const orgId = made.organizationId;
    const rand = rng(29);
    const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
    const startOfToday = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

    // ---- the company itself: a normal company that is marked as the demo and has nothing left to set up
    await this.prisma.organization.update({ where: { id: orgId }, data: { isDemo: true, setupPending: false, code: "WHOLESTRA-DEMO", referralCode: null, industry: "Wholesale and distribution", country: "Ghana", stateProvince: "Greater Accra", address: "Sample address, Accra", phone: "+233 00 000 0000", email: "sales@demo.wholestra.example", currency: "GHS", timeZone: "Africa/Accra", inventoryStartDate: new Date(startOfToday - DAYS_OF_HISTORY * DAY), plan: "DEMO" } });

    // ---- read-only role for the demo person
    const all = await this.prisma.permission.findMany({ select: { id: true, action: true } });
    const viewer = await this.prisma.role.create({ data: { organizationId: orgId, name: "Demo viewer", code: "DEMO_VIEWER", description: "Can look at everything and change nothing" } });
    await this.prisma.rolePermission.createMany({ data: all.filter((p) => p.action === "READ" || p.action === "EXPORT").map((p) => ({ roleId: viewer.id, permissionId: p.id })) });
    await this.prisma.userRole.deleteMany({ where: { userId: made.userId } });
    await this.prisma.userRole.create({ data: { userId: made.userId, roleId: viewer.id } });

    // ---- branches
    const branches = await Promise.all(BRANCHES.map((b) => this.prisma.branch.create({ data: { organizationId: orgId, ...b } })));
    await this.prisma.user.update({ where: { id: made.userId }, data: { branchId: null } });
    await this.prisma.branch.deleteMany({ where: { organizationId: orgId, code: "MAIN-001" } });

    // ---- staff (cannot sign in: nobody knows their passwords)
    const roles = await this.prisma.role.findMany({ where: { organizationId: orgId }, select: { id: true, code: true } });
    const staff: { id: string; branch: number }[] = [];
    for (const s of STAFF) {
      const u = await this.prisma.user.create({ data: { organizationId: orgId, branchId: branches[s.branch].id, email: s.email, name: s.name, passwordHash: random, passwordSet: false, emailVerifiedAt: new Date() } });
      await this.prisma.userRole.create({ data: { userId: u.id, roleId: roles.find((r) => r.code === s.role)!.id } });
      staff.push({ id: u.id, branch: s.branch });
    }

    // ---- catalogue
    const units = await this.prisma.unit.findMany({ where: { organizationId: orgId } });
    const unitId = (code: string) => units.find((u) => u.code === code)?.id ?? null;
    const catNames = [...new Set(PRODUCTS.map((p) => p.category))];
    const cats = await Promise.all(catNames.map((name) => this.prisma.category.create({ data: { organizationId: orgId, name, code: name.toUpperCase().replace(/[^A-Z0-9]+/g, "_") } })));
    const products = PRODUCTS.map((p) => ({ ...p, id: randomUUID() }));
    await this.prisma.product.createMany({ data: products.map((p) => ({ id: p.id, organizationId: orgId, sku: p.sku, name: p.name, category: p.category, categoryId: cats.find((c) => c.name === p.category)!.id, unitId: unitId(p.unit), unitPrice: p.price, costPrice: p.cost, reorderLevel: p.reorder, stockQuantity: 0, imageUrl: tile(p.glyph, p.color), imageThumb: tile(p.glyph, p.color) })) });
    const customers = await Promise.all(CUSTOMERS.map((name, i) => this.prisma.customer.create({ data: { organizationId: orgId, name, code: `CUS-${String(i + 1).padStart(3, "0")}`, phone: `+233 24 000 ${String(1000 + i * 37).slice(0, 4)}`, creditLimit: i % 3 === 0 ? 20000 : null } })));
    const suppliers = await Promise.all(SUPPLIERS.map((name, i) => this.prisma.supplier.create({ data: { organizationId: orgId, name, code: `SUP-${String(i + 1).padStart(3, "0")}`, leadTimeDays: 5 + i * 2 } })));

    // ---- stock and sales: walk through the history day by day so stock never goes below zero
    const stock = products.map((p) => p.open.slice());
    const movements: { id: string; organizationId: string; productId: string; branchId: string; type: "INITIAL" | "SALE" | "ADJUSTMENT" | "RECEIPT"; quantityDelta: number; resultingQuantity: number; referenceType?: string; referenceId?: string; userId: string | null; notes: string; createdAt: Date }[] = [];
    const t0 = startOfToday - (DAYS_OF_HISTORY + 1) * DAY + 8 * 3600_000;
    products.forEach((p, pi) => branches.forEach((b, bi) => movements.push({ id: randomUUID(), organizationId: orgId, productId: p.id, branchId: b.id, type: "INITIAL", quantityDelta: p.open[bi], resultingQuantity: p.open[bi], userId: null, notes: "Opening stock", createdAt: new Date(t0) })));
    const weights = products.flatMap((p, i) => Array(p.weight).fill(i));
    const sales: Record<string, unknown>[] = [], items: Record<string, unknown>[] = [], payments: Record<string, unknown>[] = [];
    let invoice = 0;
    for (let d = DAYS_OF_HISTORY; d >= 1; d--) {
      const day = startOfToday - d * DAY;
      for (let bi = 0; bi < branches.length; bi++) {
        const count = 2 + Math.floor(rand() * 3) + (new Date(day).getUTCDay() === 6 ? 1 : 0);
        for (let k = 0; k < count; k++) {
          const lines: { pi: number; qty: number }[] = [];
          for (let l = 0, n = 1 + Math.floor(rand() * 3); l < n; l++) {
            const pi = pick(weights) as number, p = products[pi];
            const qty = Math.min(stock[pi][bi], Math.max(1, Math.round((p.reorder / 6) * (0.4 + rand() * 1.2))));
            if (qty > 0 && !lines.some((x) => x.pi === pi)) lines.push({ pi, qty });
          }
          if (!lines.length) continue;
          const at = new Date(day + (8 + Math.floor(rand() * 9)) * 3600_000 + Math.floor(rand() * 60) * 60_000);
          const saleId = randomUUID(), who = staff.find((s) => s.branch === bi) ?? staff[0];
          let total = 0;
          for (const ln of lines) {
            const p = products[ln.pi]; stock[ln.pi][bi] -= ln.qty; total += p.price * ln.qty;
            items.push({ id: randomUUID(), saleId, productId: p.id, quantity: ln.qty, unitPrice: p.price, unitCost: p.cost, lineTotal: p.price * ln.qty });
            movements.push({ id: randomUUID(), organizationId: orgId, productId: p.id, branchId: branches[bi].id, type: "SALE", quantityDelta: -ln.qty, resultingQuantity: stock[ln.pi][bi], referenceType: "Sale", referenceId: saleId, userId: who.id, notes: `DEMO-${String(invoice + 1).padStart(5, "0")}`, createdAt: at });
          }
          invoice++;
          const customer = rand() < 0.62 ? pick(customers) : null;
          sales.push({ id: saleId, organizationId: orgId, branchId: branches[bi].id, userId: who.id, customerId: customer?.id ?? null, invoiceNumber: `DEMO-${String(invoice).padStart(5, "0")}`, status: "COMPLETED", totalAmount: total, soldAt: at, createdAt: at });
          const roll = rand(); // most sales are paid in full; some are partly paid or still owed
          const paid = !customer || roll < 0.72 ? total : roll < 0.88 ? Math.round(total * (0.4 + rand() * 0.3)) : 0;
          if (paid > 0) payments.push({ id: randomUUID(), organizationId: orgId, saleId, method: pick(["CASH", "MOBILE_MONEY", "BANK", "CASH"]), amount: paid, receivedByUserId: who.id, userId: who.id, receivedAt: at, createdAt: at });
        }
      }
      // like a real business, shelves that run low are refilled by a delivery the next morning (except in the last few days)
      if (d > 3) products.forEach((p, pi) => branches.forEach((b, bi) => {
        if (stock[pi][bi] >= p.reorder * 1.3) return;
        const add = p.open[bi] - stock[pi][bi];
        stock[pi][bi] += add;
        movements.push({ id: randomUUID(), organizationId: orgId, productId: p.id, branchId: b.id, type: "RECEIPT", quantityDelta: add, resultingQuantity: stock[pi][bi], userId: staff.find((x) => x.branch === bi)?.id ?? null, notes: "Delivery received (sample)", createdAt: new Date(day + DAY + 7 * 3600_000) });
      }));
    }
    // (restocking happens inside the day loop above)
    // push a few shelves to chosen levels so the demo shows what "needs attention" looks like
    const yesterday = new Date(startOfToday - DAY + 16 * 3600_000);
    for (const f of FINAL_STOCK) {
      const pi = products.findIndex((p) => p.sku === f.sku); if (pi < 0) continue;
      const delta = f.qty - stock[pi][f.branch]; stock[pi][f.branch] = f.qty;
      if (delta !== 0) movements.push({ id: randomUUID(), organizationId: orgId, productId: products[pi].id, branchId: branches[f.branch].id, type: "ADJUSTMENT", quantityDelta: delta, resultingQuantity: f.qty, userId: staff[0].id, notes: "Stock count correction", createdAt: yesterday });
    }
    const chunk = async <T,>(rows: T[], fn: (c: T[]) => Promise<unknown>) => { for (let i = 0; i < rows.length; i += 400) await fn(rows.slice(i, i + 400)); };
    await chunk(sales, (c) => this.prisma.sale.createMany({ data: c as never }));
    await chunk(items, (c) => this.prisma.saleItem.createMany({ data: c as never }));
    await chunk(payments, (c) => this.prisma.payment.createMany({ data: c as never }));
    await chunk(movements, (c) => this.prisma.stockMovement.createMany({ data: c as never }));
    await this.prisma.inventory.createMany({ data: products.flatMap((p, pi) => branches.map((b, bi) => ({ organizationId: orgId, productId: p.id, branchId: b.id, quantity: stock[pi][bi] }))) });
    for (let pi = 0; pi < products.length; pi++) await this.prisma.product.update({ where: { id: products[pi].id }, data: { stockQuantity: stock[pi].reduce((a, b) => a + b, 0) } });

    // ---- money: expenses (a few waiting for approval) and weekly deposits
    const expCats = await this.prisma.expenseCategory.findMany({ where: { organizationId: orgId } });
    const expenses = Array.from({ length: 28 }, (_, i) => {
      const date = new Date(startOfToday - Math.floor(rand() * DAYS_OF_HISTORY) * DAY);
      const pending = i < 4; const cat = pick(expCats), bi = Math.floor(rand() * 3);
      return { id: randomUUID(), organizationId: orgId, branchId: branches[bi].id, categoryId: cat.id, amount: Math.round((60 + rand() * 900) / 5) * 5, description: `${cat.name} (sample)`, expenseDate: pending ? new Date(startOfToday - (1 + i) * DAY) : date, status: pending ? "PENDING" : "APPROVED", createdByUserId: staff[bi].id, reviewedByUserId: pending ? null : made.userId, reviewedAt: pending ? null : date, createdAt: date };
    });
    await this.prisma.expense.createMany({ data: expenses as never });
    const deposits = [] as Record<string, unknown>[];
    for (let w = 1; w <= 6; w++) for (let bi = 0; bi < 3; bi++) {
      const date = new Date(startOfToday - w * 7 * DAY);
      const cash = sales.filter((s) => s.branchId === branches[bi].id && (s.soldAt as Date).getTime() >= date.getTime() - 7 * DAY && (s.soldAt as Date).getTime() < date.getTime()).reduce((a, s) => a + Number(s.totalAmount), 0);
      if (cash > 0) deposits.push({ id: randomUUID(), organizationId: orgId, branchId: branches[bi].id, method: "BANK", amount: Math.round(cash * 0.9), reference: `DEP-${w}${bi}`, depositDate: date, createdByUserId: staff[bi].id, createdAt: date });
    }
    await this.prisma.deposit.createMany({ data: deposits as never });

    // ---- goods on the way: purchase orders and a stock transfer in transit
    const po = async (n: number, supplierIdx: number, branchIdx: number, status: "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED", orderedDaysAgo: number, expectedInDays: number, lines: [string, number, number][]) => {
      const created = await this.prisma.purchaseOrder.create({ data: { organizationId: orgId, supplierId: suppliers[supplierIdx].id, branchId: branches[branchIdx].id, orderNumber: `PO-${String(n).padStart(4, "0")}`, status, orderDate: new Date(startOfToday - orderedDaysAgo * DAY), expectedDate: new Date(startOfToday + expectedInDays * DAY), notes: "Sample order" } });
      await this.prisma.purchaseOrderItem.createMany({ data: lines.map(([sku, qty, received]) => { const p = products.find((x) => x.sku === sku)!; return { purchaseOrderId: created.id, productId: p.id, quantityOrdered: qty, quantityReceived: received, unitCost: p.cost }; }) });
    };
    await po(1, 2, 2, "SENT", 3, 4, [["CEM-50", 400, 0], ["ROD-12", 150, 0]]);
    await po(2, 3, 1, "PARTIALLY_RECEIVED", 9, 1, [["PAINT-20", 40, 24], ["NAIL-3", 200, 200]]);
    await po(3, 0, 0, "RECEIVED", 20, -14, [["FLOUR-50", 120, 120], ["RICE-25", 100, 100]]);
    const tr = await this.prisma.stockTransfer.create({ data: { organizationId: orgId, fromBranchId: branches[0].id, toBranchId: branches[2].id, transferNumber: "TR-0001", status: "DISPATCHED", createdByUserId: staff[0].id, approvedByUserId: made.userId, approvedAt: new Date(startOfToday - DAY), dispatchedByUserId: staff[0].id, dispatchedAt: new Date(startOfToday - DAY + 10 * 3600_000), notes: "Cement for Tema" } });
    await this.prisma.stockTransferItem.createMany({ data: [{ stockTransferId: tr.id, productId: products.find((p) => p.sku === "CEM-50")!.id, quantity: 120 }, { stockTransferId: tr.id, productId: products.find((p) => p.sku === "PVC-4")!.id, quantity: 30 }] });
    this.log.log(`demo company ready: ${sales.length} sales, ${products.length} products`);
    return made.userId;
  }
}
