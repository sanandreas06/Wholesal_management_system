import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { assertNotFuture, parseDay } from "./dates";
import { ReconciliationService } from "./reconciliation.service";
import { CreateDepositDto } from "./dto/create-deposit.dto";

const include = { branch: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } };

@Injectable()
export class DepositsService {
  constructor(private readonly prisma: PrismaService, private readonly recon: ReconciliationService) {}

  list(organizationId: string, branchId?: string) {
    return this.prisma.deposit.findMany({ where: { organizationId, ...(branchId ? { branchId } : {}) }, include, orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }], take: 200 });
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
