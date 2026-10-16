import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { assertNotFuture, parseDay } from "./dates";
import { ReconciliationService } from "./reconciliation.service";
import { CreateDepositDto } from "./dto/create-deposit.dto";

const include = { branch: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } };

@Injectable()
export class DepositsService {
  constructor(private readonly prisma: PrismaService, private readonly recon: ReconciliationService) {}

  private where(organizationId: string, branchId?: string, f: { from?: string; to?: string; method?: string } = {}) {
    const day = (v: string | undefined, end: boolean) => { if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined; try { return parseDay(v, end); } catch { return undefined; } };
    const gte = day(f.from, false), lte = day(f.to, true);
    return {
      organizationId, ...(branchId ? { branchId } : {}), ...(f.method ? { method: f.method as any } : {}),
      ...(gte || lte ? { depositDate: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}),
    };
  }

  list(organizationId: string, branchId?: string, f: { from?: string; to?: string; method?: string } = {}) {
    return this.prisma.deposit.findMany({ where: this.where(organizationId, branchId, f), include, orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }], take: 500 });
  }

  /** Totals for exactly what the list shows, and by payment method. */
  async summary(organizationId: string, branchId?: string, f: { from?: string; to?: string; method?: string } = {}) {
    const rows: { amount: unknown; method: string }[] = await this.prisma.deposit.findMany({ where: this.where(organizationId, branchId, f), select: { amount: true, method: true }, take: 50000 });
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const byMethod = new Map<string, { method: string; total: number; count: number }>();
    for (const x of rows) { const m = byMethod.get(x.method) ?? { method: x.method, total: 0, count: 0 }; m.total += Number(x.amount); m.count++; byMethod.set(x.method, m); }
    return { count: rows.length, total: r2(rows.reduce((t, x) => t + Number(x.amount), 0)), byMethod: [...byMethod.values()].map((m) => ({ ...m, total: r2(m.total) })).sort((a, b) => b.total - a.total) };
  }

  async create(organizationId: string, userId: string, dto: CreateDepositDto) {
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId } });
    if (!branch) throw new BadRequestException("Branch not found");
    const date = parseDay(dto.depositDate);
    assertNotFuture(date, "Deposit date");
    await this.recon.assertPeriodOpen(organizationId, dto.branchId, date);
    return this.prisma.deposit.create({
      data: { organizationId, branchId: dto.branchId, method: dto.method, amount: dto.amount, reference: dto.reference ?? null, depositDate: date, createdByUserId: userId },
      include
    });
  }
}
