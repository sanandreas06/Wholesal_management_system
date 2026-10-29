import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { assertNotFuture, parseDay } from "./dates";
import { CreateBranchClosingDto } from "./dto/create-branch-closing.dto";
import { UpdateVarianceCaseDto } from "./dto/update-variance-case.dto";

const METHODS = ["CASH", "BANK", "MOBILE_MONEY"] as const;
// A gap is "material" when it is at least 1.00 and at least 1% of what was expected.
const MIN_ABSOLUTE = 1;
const MIN_RATIO = 0.01;
const isMaterial = (expected: number, diff: number) => Math.abs(diff) >= Math.max(MIN_ABSOLUTE, Math.abs(expected) * MIN_RATIO);
const round = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws if the branch has a closed period covering this date. */
  async assertPeriodOpen(organizationId: string, branchId: string, date: Date) {
    const closing = await this.prisma.branchClosing.findFirst({
      where: { organizationId, branchId, periodStart: { lte: date }, periodEnd: { gte: date } }
    });
    if (closing) {
      const f = (d: Date) => d.toISOString().slice(0, 10);
      throw new ConflictException(`This branch is closed for ${f(closing.periodStart)} to ${f(closing.periodEnd)}; nothing can be added in that period`);
    }
  }

  /** Expected (from sales payments) vs deposited, per payment method, for one branch and period. */
  async compute(organizationId: string, branchId: string, from: Date, to: Date) {
    const [payments, deposits, expenses] = await Promise.all([
      this.prisma.payment.findMany({
        where: { organizationId, receivedAt: { gte: from, lte: to }, method: { in: [...METHODS] }, sale: { branchId, status: "COMPLETED" } },
        select: { method: true, amount: true }
      }),
      this.prisma.deposit.findMany({ where: { organizationId, branchId, depositDate: { gte: from, lte: to } }, select: { method: true, amount: true } }),
      this.prisma.expense.findMany({ where: { organizationId, branchId, expenseDate: { gte: from, lte: to } }, select: { status: true, amount: true } })
    ]);
    const rows = METHODS.map(method => {
      const expected = round(payments.filter(p => p.method === method).reduce((a, p) => a + Number(p.amount), 0));
      const deposited = round(deposits.filter(d => d.method === method).reduce((a, d) => a + Number(d.amount), 0));
      const difference = round(deposited - expected);
      return { method, expected, deposited, difference, material: isMaterial(expected, difference) };
    });
    const sum = (k: "expected" | "deposited" | "difference") => round(rows.reduce((a, r) => a + r[k], 0));
    const exp = (s: string) => round(expenses.filter(e => e.status === s).reduce((a, e) => a + Number(e.amount), 0));
    return {
      branchId, from, to, rows,
      totals: { expected: sum("expected"), deposited: sum("deposited"), difference: sum("difference") },
      expenses: { approved: exp("APPROVED"), pending: exp("PENDING"), pendingCount: expenses.filter(e => e.status === "PENDING").length }
    };
  }

  async summary(organizationId: string, fromStr: string, toStr: string, branchId?: string) {
    const from = parseDay(fromStr), to = parseDay(toStr, true);
    if (from > to) throw new BadRequestException("from must not be after to");
    const branches = await this.prisma.branch.findMany({ where: { organizationId, ...(branchId ? { id: branchId } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    if (branchId && branches.length === 0) throw new NotFoundException("Branch not found");
    return Promise.all(branches.map(async b => ({ branch: b, ...(await this.compute(organizationId, b.id, from, to)) })));
  }

  listClosings(organizationId: string, branchId?: string) {
    return this.prisma.branchClosing.findMany({
      where: { organizationId, ...(branchId ? { branchId } : {}) },
      include: { branch: { select: { id: true, name: true } }, closedBy: { select: { id: true, name: true } }, varianceCases: { select: { id: true, status: true, method: true, difference: true } } },
      orderBy: { periodEnd: "desc" }, take: 200
    });
  }

  async close(organizationId: string, userId: string, dto: CreateBranchClosingDto) {
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId } });
    if (!branch) throw new BadRequestException("Branch not found");
    const from = parseDay(dto.periodStart), to = parseDay(dto.periodEnd, true);
    if (from > to) throw new BadRequestException("periodStart must not be after periodEnd");
    assertNotFuture(to, "The closing period end");
    const overlap = await this.prisma.branchClosing.findFirst({ where: { organizationId, branchId: dto.branchId, periodStart: { lte: to }, periodEnd: { gte: from } } });
    if (overlap) throw new ConflictException("This period overlaps a period that is already closed for this branch");

    const rec = await this.compute(organizationId, dto.branchId, from, to);
    if (rec.expenses.pendingCount > 0) throw new BadRequestException(`${rec.expenses.pendingCount} expense(s) in this period are still pending approval; approve or reject them before closing`);

    return this.prisma.$transaction(async tx => {
      const closing = await tx.branchClosing.create({
        data: {
          organizationId, branchId: dto.branchId, periodStart: from, periodEnd: to,
          expectedAmount: rec.totals.expected, depositedAmount: rec.totals.deposited,
          expensesAmount: rec.expenses.approved, differenceAmount: rec.totals.difference,
          notes: dto.notes ?? null, closedByUserId: userId
        }
      });
      for (const r of rec.rows.filter(x => x.material)) {
        await tx.varianceCase.create({
          data: { organizationId, branchId: dto.branchId, closingId: closing.id, method: r.method, periodStart: from, periodEnd: to, expectedAmount: r.expected, actualAmount: r.deposited, difference: r.difference }
        });
      }
      return tx.branchClosing.findUniqueOrThrow({
        where: { id: closing.id },
        include: { branch: { select: { id: true, name: true } }, closedBy: { select: { id: true, name: true } }, varianceCases: true }
      });
    });
  }

  async listCases(organizationId: string, status?: string, branchId?: string) {
    const rows = await this.prisma.varianceCase.findMany({
      where: { organizationId, ...(status ? { status: status as any } : {}), ...(branchId ? { branchId } : {}) },
      include: { branch: { select: { id: true, name: true } }, resolvedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" }, take: 200
    });
    // a cash gap from a cashier's shift carries the cashier's name
    const ids = [...new Set(rows.map(r => r.cashierId).filter((x): x is string => !!x))];
    const people = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    return rows.map(r => ({ ...r, cashier: r.cashierId ? people.find(p => p.id === r.cashierId) ?? null : null }));
  }

  async updateCase(organizationId: string, id: string, userId: string, dto: UpdateVarianceCaseDto) {
    const c = await this.prisma.varianceCase.findFirst({ where: { id, organizationId } });
    if (!c) throw new NotFoundException("Variance case not found");
    if (c.status === "RESOLVED") throw new BadRequestException("This case is already resolved");
    if (dto.status === "RESOLVED" && !(dto.resolution && dto.resolution.trim())) throw new BadRequestException("A resolution is required to resolve a case");
    return this.prisma.varianceCase.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
        ...(dto.status === "RESOLVED" ? { resolution: dto.resolution, resolvedByUserId: userId, resolvedAt: new Date() } : {})
      },
      include: { branch: { select: { id: true, name: true } }, resolvedBy: { select: { id: true, name: true } } }
    });
  }
}
