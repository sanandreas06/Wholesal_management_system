import { BadRequestException, Body, Controller, Get, Headers, Injectable, Module, NotFoundException, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { randomInt, timingSafeEqual } from "crypto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { PrismaService } from "../prisma/prisma.service";

export const MAX_REWARD_USD = Number(process.env.REFERRAL_MAX_USD || 30);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => "WS" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

class UpdateReferralDto {
  @IsOptional() @IsIn(["REGISTERED", "CONFIRMED", "PAID", "REJECTED"]) status?: "REGISTERED" | "CONFIRMED" | "PAID" | "REJECTED";
  @IsOptional() @IsNumber() @Min(0) @Max(1000) rewardUsd?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The company's own code, made the first time it is asked for (companies that existed before this feature have none yet). */
  async codeFor(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { referralCode: true } });
    if (!org) throw new NotFoundException("Company not found");
    if (org.referralCode) return org.referralCode;
    for (let i = 0; i < 6; i++) {
      try { return (await this.prisma.organization.update({ where: { id: organizationId }, data: { referralCode: newCode() }, select: { referralCode: true } })).referralCode as string; }
      catch (e) { if ((e as { code?: string }).code !== "P2002") throw e; }
    }
    throw new BadRequestException("Could not make a referral code. Please try again.");
  }

  async mine(u: AuthUser) {
    if (u.demo) return { demo: true, code: null, maxUsd: MAX_REWARD_USD, referrals: [], totals: { registered: 0, confirmed: 0, earnedUsd: 0, paidUsd: 0 } };
    const code = await this.codeFor(u.organizationId);
    const rows = await this.prisma.referral.findMany({ where: { referrerOrgId: u.organizationId }, orderBy: { createdAt: "desc" }, include: { referred: { select: { name: true } } } });
    const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((t, r) => t + Number(r.rewardUsd), 0);
    return {
      demo: false, code, maxUsd: MAX_REWARD_USD,
      referrals: rows.map((r) => ({ id: r.id, company: r.referred.name, status: r.status, rewardUsd: Number(r.rewardUsd), at: r.createdAt })),
      totals: { registered: rows.length, confirmed: rows.filter((r) => r.status === "CONFIRMED" || r.status === "PAID").length, earnedUsd: sum((r) => r.status === "CONFIRMED" || r.status === "PAID"), paidUsd: sum((r) => r.status === "PAID") },
    };
  }

  async check(code: string) {
    const c = (code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(c)) return { valid: false };
    const org = await this.prisma.organization.findFirst({ where: { referralCode: c, isDemo: false }, select: { name: true } });
    return org ? { valid: true, company: org.name } : { valid: false };
  }

  // ---- for WHOLESTRA staff only (guarded by PLATFORM_ADMIN_KEY): confirm a referral and set the reward
  list() { return this.prisma.referral.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { referrer: { select: { name: true, referralCode: true } }, referred: { select: { name: true, createdAt: true } } } }); }
  async update(id: string, dto: UpdateReferralDto) {
    const r = await this.prisma.referral.findUnique({ where: { id } });
    if (!r) throw new NotFoundException("Referral not found");
    if (dto.rewardUsd !== undefined && dto.rewardUsd > MAX_REWARD_USD) throw new BadRequestException(`The reward is never more than US$${MAX_REWARD_USD}.`);
    return this.prisma.referral.update({ where: { id }, data: { ...(dto.status ? { status: dto.status } : {}), ...(dto.rewardUsd !== undefined ? { rewardUsd: dto.rewardUsd } : {}), ...(dto.note !== undefined ? { note: dto.note } : {}) } });
  }
}

@Controller("referrals")
export class ReferralsController {
  constructor(private readonly svc: ReferralsService) {}
  @Get("me") @UseGuards(JwtAuthGuard) mine(@CurrentUser() u: AuthUser) { return this.svc.mine(u); }
  /** Lets the sign-up page say "You were invited by ..." for a valid code. */
  @Get("check") check(@Query("code") code: string) { return this.svc.check(code); }
}

function adminOnly(key: string | undefined) {
  const want = process.env.PLATFORM_ADMIN_KEY;
  // looks like a page that does not exist unless the owner has set a key and the caller knows it
  if (!want || want.length < 24 || !key) throw new NotFoundException();
  const a = Buffer.from(key), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new NotFoundException();
}

@Controller("admin/referrals")
export class ReferralsAdminController {
  constructor(private readonly svc: ReferralsService) {}
  @Get() list(@Headers("x-admin-key") key?: string) { adminOnly(key); return this.svc.list(); }
  @Patch(":id") update(@Headers("x-admin-key") key: string | undefined, @Param("id") id: string, @Body() dto: UpdateReferralDto) { adminOnly(key); return this.svc.update(id, dto); }
}

@Module({ controllers: [ReferralsController, ReferralsAdminController], providers: [ReferralsService] })
export class ReferralsModule {}
