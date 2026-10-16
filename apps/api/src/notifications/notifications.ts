import { Controller, Get, Injectable, Module, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { PrismaService } from "../prisma/prisma.service";
import { ReorderService } from "../purchase-orders/reorder";
import { PurchaseOrdersModule } from "../purchase-orders/purchase-orders.module";
import { scopeOf } from "../common/branch/branch-scope";

export interface Notice {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  href: string;
  count: number;
}

/** Things that need a person's attention right now, limited to what that person is allowed to see. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, private readonly reorder: ReorderService) {}

  async forUser(user: AuthUser) {
    const org = user.organizationId;
    const can = (p: string) => user.permissions.includes(p);
    const mine = scopeOf(user), here = mine ? { branchId: mine } : {}; // limited people only hear about their own branch
    const notices: Notice[] = [];
    const jobs: Promise<void>[] = [];

    if (can("PRODUCTS:READ") || can("INVENTORY:READ")) {
      jobs.push(
        this.reorder.needs(user).then((items) => {
          const out = items.filter((n) => n.onHand === 0);
          const low = items.filter((n) => n.onHand > 0);
          const href = can("PURCHASING:READ") ? "/reorder" : "/inventory";
          const names = (list: typeof items) => list.slice(0, 3).map((n) => `${n.name} (${n.branch})`).join(", ") + (list.length > 3 ? ` and ${list.length - 3} more` : "");
          if (out.length) notices.push({ id: "out-of-stock", severity: "high", count: out.length, href, title: `${out.length} item${out.length === 1 ? " is" : "s are"} out of stock`, detail: names(out) });
          if (low.length) notices.push({ id: "low-stock", severity: "medium", count: low.length, href, title: `${low.length} item${low.length === 1 ? "" : "s"} to restock soon`, detail: names(low) });
        }),
      );
    }
    if (can("EXPENSES:APPROVE")) {
      jobs.push(
        this.prisma.expense.count({ where: { organizationId: org, ...here, status: "PENDING" } }).then((n: number) => {
          if (n) notices.push({ id: "pending-expenses", severity: "medium", count: n, href: "/finance?tab=expenses&status=PENDING", title: `${n} expense${n === 1 ? "" : "s"} waiting for approval`, detail: "Open Finance to review them" });
        }),
      );
    }
    if (can("VARIANCE_CASES:READ")) {
      jobs.push(
        this.prisma.varianceCase.count({ where: { organizationId: org, ...here, status: { in: ["OPEN", "INVESTIGATING"] } } }).then((n: number) => {
          if (n) notices.push({ id: "variance-cases", severity: "high", count: n, href: "/finance?tab=cases&status=OPEN", title: `${n} cash difference${n === 1 ? "" : "s"} worth reviewing`, detail: "Deposits did not match expected collections" });
        }),
      );
    }
    if (can("PURCHASING:READ")) {
      jobs.push(
        this.prisma.purchaseOrder.count({ where: { organizationId: org, ...here, status: "DRAFT" } }).then((n: number) => {
          if (n) notices.push({ id: "draft-orders", severity: "low", count: n, href: "/purchase-orders", title: `${n} draft purchase order${n === 1 ? "" : "s"} not yet sent`, detail: "Review and send them to the supplier" });
        }),
      );
    }
    await Promise.all(jobs);
    const rank = { high: 0, medium: 1, low: 2 };
    notices.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return { total: notices.reduce((t, n) => t + (n.severity === "low" ? 0 : n.count), 0), badgeCount: notices.filter((n) => n.severity !== "low").length, notices };
  }
}

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.forUser(u); }
}

@Module({ imports: [PurchaseOrdersModule], controllers: [NotificationsController], providers: [NotificationsService] })
export class NotificationsModule {}
