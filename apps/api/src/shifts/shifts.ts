import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { assertBranch, scopeOf } from "../common/branch/branch-scope";

const r2 = (n: number) => Math.round(n * 100) / 100;

export class OpenShiftDto { @IsUUID() branchId!: string; @IsNumber() @Min(0) @Max(10_000_000) openingFloat!: number }
export class CloseShiftDto { @IsNumber() @Min(0) @Max(10_000_000) countedCash!: number; @IsOptional() @IsString() @MaxLength(500) note?: string }

/** A difference smaller than this (worn coins, rounding) is noted on the shift but does not open a case. */
const TOLERANCE = 1;

/**
 * Cashier shifts. Each cashier counts the cash in the drawer when they start (the float) and again when they finish.
 * What the drawer should hold = the float + the cash this cashier took during the shift. A gap opens a cash case in Finance,
 * with the cashier's name on it, so a shortage at a shared till is never "nobody's".
 */
@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Money this person took at this branch between two times, per method, and how many sales they made. */
  async totals(org: string, branchId: string, userId: string, from: Date, to: Date) {
    const [pays, sales] = await Promise.all([
      this.prisma.payment.findMany({ where: { organizationId: org, receivedByUserId: userId, receivedAt: { gte: from, lte: to }, sale: { branchId } }, select: { method: true, amount: true } }),
      this.prisma.sale.findMany({ where: { organizationId: org, branchId, userId, soldAt: { gte: from, lte: to } }, select: { status: true, totalAmount: true, payments: { select: { amount: true } } } }),
    ]);
    const by = { CASH: 0, MOBILE_MONEY: 0, BANK: 0 } as Record<string, number>;
    for (const p of pays) by[p.method] = r2((by[p.method] ?? 0) + Number(p.amount));
    const done = sales.filter(s => s.status === "COMPLETED");
    const credit = r2(done.reduce((t, s) => t + Math.max(0, Number(s.totalAmount) - s.payments.reduce((x, p) => x + Number(p.amount), 0)), 0));
    return { cash: by.CASH ?? 0, momo: by.MOBILE_MONEY ?? 0, bank: by.BANK ?? 0, credit, sales: done.length, voided: sales.length - done.length, salesTotal: r2(done.reduce((t, s) => t + Number(s.totalAmount), 0)) };
  }

  private async shape(s: { id: string; branchId: string; userId: string; status: string; openedAt: Date; closedAt: Date | null; openingFloat: unknown; countedCash: unknown; expectedCash: unknown; difference: unknown; note: string | null; organizationId: string }) {
    const t = await this.totals(s.organizationId, s.branchId, s.userId, s.openedAt, s.closedAt ?? new Date());
    const [u, b] = await Promise.all([this.prisma.user.findUnique({ where: { id: s.userId }, select: { name: true } }), this.prisma.branch.findUnique({ where: { id: s.branchId }, select: { name: true } })]);
    const float = Number(s.openingFloat);
    return { id: s.id, status: s.status, branchId: s.branchId, branch: b?.name ?? "", userId: s.userId, cashier: u?.name ?? "", openedAt: s.openedAt, closedAt: s.closedAt, openingFloat: float, note: s.note,
      totals: t, expectedCash: s.expectedCash !== null ? Number(s.expectedCash) : r2(float + t.cash), countedCash: s.countedCash !== null ? Number(s.countedCash) : null, difference: s.difference !== null ? Number(s.difference) : null };
  }

  async current(user: AuthUser, branchId: string) {
    assertBranch(user, branchId);
    const s = await this.prisma.cashierShift.findFirst({ where: { organizationId: user.organizationId, userId: user.sub, status: "OPEN" }, orderBy: { openedAt: "desc" } });
    if (!s) return null;
    return { ...await this.shape(s), elsewhere: s.branchId !== branchId };
  }

  async open(user: AuthUser, dto: OpenShiftDto) {
    assertBranch(user, dto.branchId);
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId: user.organizationId }, select: { name: true } });
    if (!branch) throw new NotFoundException("Branch not found");
    const open = await this.prisma.cashierShift.findFirst({ where: { organizationId: user.organizationId, userId: user.sub, status: "OPEN" } });
    if (open) throw new ConflictException(open.branchId === dto.branchId ? "Your shift is already open." : "You still have a shift open at another branch. End it there first.");
    const s = await this.prisma.cashierShift.create({ data: { organizationId: user.organizationId, branchId: dto.branchId, userId: user.sub, openingFloat: r2(dto.openingFloat) } });
    return this.shape(s);
  }

  async close(user: AuthUser, id: string, dto: CloseShiftDto) {
    const s = await this.prisma.cashierShift.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!s || (scopeOf(user) && s.branchId !== scopeOf(user))) throw new NotFoundException("Shift not found");
    if (s.status !== "OPEN") throw new ConflictException("This shift is already closed.");
    // a cashier ends their own shift; a manager can end someone else's (for example, the cashier went home without ending it)
    if (s.userId !== user.sub && !user.permissions.includes("BRANCH_CLOSING:CREATE")) throw new ForbiddenException("Only the cashier or a manager can end this shift.");
    const now = new Date();
    const t = await this.totals(s.organizationId, s.branchId, s.userId, s.openedAt, now);
    const expected = r2(Number(s.openingFloat) + t.cash), counted = r2(dto.countedCash), diff = r2(counted - expected);
    const cashier = await this.prisma.user.findUnique({ where: { id: s.userId }, select: { name: true } });
    await this.prisma.$transaction(async tx => {
      await tx.cashierShift.update({ where: { id }, data: { status: "CLOSED", closedAt: now, closedByUserId: user.sub, countedCash: counted, expectedCash: expected, difference: diff, note: dto.note?.trim() || null } });
      if (Math.abs(diff) >= TOLERANCE) await tx.varianceCase.create({ data: {
        organizationId: s.organizationId, branchId: s.branchId, method: "CASH", periodStart: s.openedAt, periodEnd: now, expectedAmount: expected, actualAmount: counted, difference: diff,
        shiftId: s.id, cashierId: s.userId, explanation: `Cashier shift of ${cashier?.name ?? "a cashier"}: ${diff < 0 ? "short" : "over"} by ${Math.abs(diff).toFixed(2)}.${dto.note?.trim() ? ` Note: ${dto.note.trim()}` : ""}`,
      } });
    });
    const after = await this.prisma.cashierShift.findUniqueOrThrow({ where: { id } });
    return { ...await this.shape(after), caseOpened: Math.abs(diff) >= TOLERANCE };
  }

  async list(user: AuthUser, branchId?: string, days = 14) {
    const b = scopeOf(user) ?? branchId;
    const mine = !user.permissions.includes("BRANCH_CLOSING:READ"); // a cashier sees only their own shifts
    const rows = await this.prisma.cashierShift.findMany({
      where: { organizationId: user.organizationId, ...(b ? { branchId: b } : {}), ...(mine ? { userId: user.sub } : {}), openedAt: { gte: new Date(Date.now() - Math.min(days, 92) * 86400_000) } },
      orderBy: { openedAt: "desc" }, take: 200,
    });
    return Promise.all(rows.map(r => this.shape(r)));
  }

  async one(user: AuthUser, id: string) {
    const s = await this.prisma.cashierShift.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!s || (scopeOf(user) && s.branchId !== scopeOf(user)) || (s.userId !== user.sub && !user.permissions.includes("BRANCH_CLOSING:READ"))) throw new NotFoundException("Shift not found");
    return this.shape(s);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("shifts")
export class ShiftsController {
  constructor(private readonly svc: ShiftsService) {}
  @Get("current") @RequirePermissions("SALES:CREATE")
  current(@CurrentUser() u: AuthUser, @Query("branchId") branchId: string) { if (!branchId) throw new BadRequestException("Choose a branch."); return this.svc.current(u, branchId); }
  @Post() @RequirePermissions("SALES:CREATE")
  open(@CurrentUser() u: AuthUser, @Body() dto: OpenShiftDto) { return this.svc.open(u, dto); }
  @Post(":id/close") @RequirePermissions("SALES:CREATE", "BRANCH_CLOSING:CREATE")
  close(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: CloseShiftDto) { return this.svc.close(u, id, dto); }
  @Get() @RequirePermissions("SALES:CREATE", "BRANCH_CLOSING:READ")
  list(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string, @Query("days") days?: string) { return this.svc.list(u, branchId, Number(days) || 14); }
  @Get(":id") @RequirePermissions("SALES:CREATE", "BRANCH_CLOSING:READ")
  one(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.one(u, id); }
}

@Module({ controllers: [ShiftsController], providers: [ShiftsService], exports: [ShiftsService] })
export class ShiftsModule {}
