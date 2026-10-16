import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { assertNotFuture, parseDay } from "./dates";
import { ReconciliationService } from "./reconciliation.service";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ReviewExpenseDto } from "./dto/review-expense.dto";

const include = {
  branch: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } }
};

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService, private readonly recon: ReconciliationService) {}

  listCategories(organizationId: string) { return this.prisma.expenseCategory.findMany({ where: { organizationId }, orderBy: { name: "asc" } }); }

  async createCategory(organizationId: string, dto: CreateExpenseCategoryDto) {
    const name = dto.name.trim();
    const dup = await this.prisma.expenseCategory.findFirst({ where: { organizationId, name: { equals: name, mode: "insensitive" } } });
    if (dup) throw new BadRequestException(`A category named "${dup.name}" already exists`);
    return this.prisma.expenseCategory.create({ data: { organizationId, name } });
  }

  /** `from` and `to` are whole days (YYYY-MM-DD), both included. Bad or missing dates are ignored. */
  private where(organizationId: string, branchId?: string, status?: string, f: { from?: string; to?: string; categoryId?: string } = {}) {
    const day = (v: string | undefined, end: boolean) => { if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined; try { return parseDay(v, end); } catch { return undefined; } };
    const gte = day(f.from, false), lte = day(f.to, true);
    return {
      organizationId, ...(branchId ? { branchId } : {}), ...(status ? { status: status as any } : {}), ...(f.categoryId ? { categoryId: f.categoryId } : {}),
      ...(gte || lte ? { expenseDate: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}),
    };
  }

  list(organizationId: string, branchId?: string, status?: string, f: { from?: string; to?: string; categoryId?: string } = {}) {
    return this.prisma.expense.findMany({
      where: this.where(organizationId, branchId, status, f),
      include, orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }], take: 500
    });
  }

  /** Totals for exactly what the list shows (not just the first 500 rows): by status, and by category for the chosen status. */
  async summary(organizationId: string, branchId?: string, status?: string, f: { from?: string; to?: string; categoryId?: string } = {}) {
    const rows: { amount: unknown; status: string; category: { id: string; name: string } }[] = await this.prisma.expense.findMany({
      where: this.where(organizationId, branchId, undefined, f), select: { amount: true, status: true, category: { select: { id: true, name: true } } }, take: 50000
    });
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const byStatus: Record<string, { count: number; total: number }> = {};
    const cats = new Map<string, { id: string; name: string; total: number; count: number }>();
    for (const x of rows) {
      const s = (byStatus[x.status] ??= { count: 0, total: 0 }); s.count++; s.total += Number(x.amount);
      if (status && x.status !== status) continue;
      const c = cats.get(x.category.id) ?? { id: x.category.id, name: x.category.name, total: 0, count: 0 };
      c.total += Number(x.amount); c.count++; cats.set(x.category.id, c);
    }
    const shown = status ? byStatus[status] ?? { count: 0, total: 0 } : { count: rows.length, total: rows.reduce((t, x) => t + Number(x.amount), 0) };
    return {
      count: shown.count, total: r2(shown.total),
      byStatus: Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k, { count: v.count, total: r2(v.total) }])),
      byCategory: [...cats.values()].map((c) => ({ ...c, total: r2(c.total) })).sort((a, b) => b.total - a.total),
    };
  }

  async create(organizationId: string, userId: string, dto: CreateExpenseDto) {
    const [branch, category] = await Promise.all([
      this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId } }),
      this.prisma.expenseCategory.findFirst({ where: { id: dto.categoryId, organizationId } })
    ]);
    if (!branch) throw new BadRequestException("Branch not found");
    if (!category) throw new BadRequestException("Expense category not found");
    const date = parseDay(dto.expenseDate);
    assertNotFuture(date, "Expense date");
    await this.recon.assertPeriodOpen(organizationId, dto.branchId, date);
    return this.prisma.expense.create({
      data: { organizationId, branchId: dto.branchId, categoryId: dto.categoryId, amount: dto.amount, description: dto.description.trim(), expenseDate: date, createdByUserId: userId },
      include
    });
  }

  private async review(organizationId: string, id: string, userId: string, status: "APPROVED" | "REJECTED", dto: ReviewExpenseDto) {
    const e = await this.prisma.expense.findFirst({ where: { id, organizationId } });
    if (!e) throw new NotFoundException("Expense not found");
    if (e.status !== "PENDING") throw new BadRequestException(`Expense is already ${e.status.toLowerCase()}`);
    if (e.createdByUserId === userId) throw new ForbiddenException("You cannot review an expense you entered yourself");
    await this.recon.assertPeriodOpen(organizationId, e.branchId, e.expenseDate);
    return this.prisma.expense.update({ where: { id }, data: { status, reviewedByUserId: userId, reviewedAt: new Date(), reviewNote: dto.note ?? null }, include });
  }
  approve(o: string, id: string, u: string, dto: ReviewExpenseDto) { return this.review(o, id, u, "APPROVED", dto); }
  reject(o: string, id: string, u: string, dto: ReviewExpenseDto) { return this.review(o, id, u, "REJECTED", dto); }
}
