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

  list(organizationId: string, branchId?: string, status?: string) {
    return this.prisma.expense.findMany({
      where: { organizationId, ...(branchId ? { branchId } : {}), ...(status ? { status: status as any } : {}) },
      include, orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }], take: 200
    });
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
