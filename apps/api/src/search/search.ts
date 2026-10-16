import { Controller, Get, Injectable, Module, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { PrismaService } from "../prisma/prisma.service";
import { scopeOf } from "../common/branch/branch-scope";

export interface Hit { id: string; label: string; sub: string; href: string }

/** One search box for the whole app. Only searches what the signed-in person is allowed to read. */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async find(user: AuthUser, raw: string) {
    const q = (raw ?? "").trim();
    const out: { products: Hit[]; customers: Hit[]; sales: Hit[]; suppliers: Hit[] } = { products: [], customers: [], sales: [], suppliers: [] };
    if (q.length < 2) return out;
    const org = user.organizationId, can = (p: string) => user.permissions.includes(p), like = { contains: q, mode: "insensitive" as const };
    const mine = scopeOf(user); // limited people only find their own branch's sales, and no stock totals from other branches
    const jobs: Promise<void>[] = [];

    if (can("PRODUCTS:READ")) jobs.push(
      this.prisma.product.findMany({ where: { organizationId: org, OR: [{ name: like }, { sku: like }] }, take: 5, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, stockQuantity: true } })
        .then((rows: { id: string; name: string; sku: string; stockQuantity: number }[]) => { out.products = rows.map((p) => ({ id: p.id, label: p.name, sub: mine ? p.sku : `${p.sku} · ${p.stockQuantity} in stock`, href: `/sales?productId=${p.id}` })); }),
    );
    if (can("CUSTOMERS:READ")) jobs.push(
      this.prisma.customer.findMany({ where: { organizationId: org, name: like }, take: 5, orderBy: { name: "asc" }, select: { id: true, name: true } })
        .then((rows: { id: string; name: string }[]) => { out.customers = rows.map((c) => ({ id: c.id, label: c.name, sub: "Customer", href: "/customers" })); }),
    );
    if (can("SALES:READ")) jobs.push(
      this.prisma.sale.findMany({ where: { organizationId: org, invoiceNumber: like, ...(mine ? { branchId: mine } : {}) }, take: 5, orderBy: { soldAt: "desc" }, select: { id: true, invoiceNumber: true, totalAmount: true, status: true } })
        .then((rows: { id: string; invoiceNumber: string; totalAmount: unknown; status: string }[]) => { out.sales = rows.map((s) => ({ id: s.id, label: s.invoiceNumber, sub: `${Number(s.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}${s.status === "VOIDED" ? " · voided" : ""}`, href: `/sales?open=${s.id}` })); }),
    );
    if (can("SUPPLIERS:READ")) jobs.push(
      this.prisma.supplier.findMany({ where: { organizationId: org, name: like }, take: 5, orderBy: { name: "asc" }, select: { id: true, name: true } })
        .then((rows: { id: string; name: string }[]) => { out.suppliers = rows.map((s) => ({ id: s.id, label: s.name, sub: "Supplier", href: "/suppliers" })); }),
    );
    await Promise.all(jobs);
    return out;
  }
}

@UseGuards(JwtAuthGuard)
@Controller("search")
export class SearchController {
  constructor(private readonly svc: SearchService) {}
  @Get() find(@CurrentUser() u: AuthUser, @Query("q") q?: string) { return this.svc.find(u, q ?? ""); }
}

@Module({ controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
