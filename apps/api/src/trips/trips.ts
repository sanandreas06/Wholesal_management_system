import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpException, HttpStatus, Injectable, Module, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { scopeOf } from "../common/branch/branch-scope";
import { km, place } from "./geo";

type Tx = Prisma.TransactionClient;
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const newToken = () => Array.from({ length: 22 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
/** A trip nobody has reported from for this long is treated as over (the phone was switched off, the link forgotten). */
const STALE_MS = 48 * 3600_000;

export class CreateTripDto {
  @IsOptional() @IsUUID() transferId?: string;
  @IsOptional() @IsUUID() releaseId?: string;
  @IsString() @MinLength(2) @MaxLength(80) driverName!: string;
  @IsOptional() @IsString() @Matches(/^[0-9 +()-]{7,20}$/, { message: "Type the driver's phone number with digits only." }) driverPhone?: string;
  @IsOptional() @IsString() @MaxLength(40) vehicle?: string;
}
export class PointInput {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) accuracy?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) speed?: number;
  @IsDateString() at!: string;
}
export class PointsDto { @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => PointInput) points!: PointInput[] }

/**
 * Live location of goods on the road. A sticker cannot report where it is, so the goods are followed through the driver:
 * the driver opens a link made for this trip only (no account) and their phone sends its location until the goods are scanned in
 * (a transfer) or the customer confirms (a delivery). Managers see the vehicle move on a map, like a courier's tracking page.
 */
@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ the business side

  async create(user: AuthUser, dto: CreateTripDto) {
    const org = user.organizationId, mine = scopeOf(user);
    if (!!dto.transferId === !!dto.releaseId) throw new BadRequestException("Choose a transfer or a delivery.");
    let base: { kind: string; transferId?: string; releaseId?: string; fromLabel: string; toLabel: string; fromLat: number | null; fromLng: number | null; toLat: number | null; toLng: number | null; vehicle?: string | null; driver?: string | null };
    if (dto.transferId) {
      const t = await this.prisma.stockTransfer.findFirst({ where: { id: dto.transferId, organizationId: org }, select: { id: true, status: true, transferNumber: true, fromBranchId: true, fromBranch: { select: { name: true, lat: true, lng: true } }, toBranch: { select: { name: true, lat: true, lng: true } } } });
      if (!t || (mine && t.fromBranchId !== mine)) throw new NotFoundException("Transfer not found");
      if (t.status === "RECEIVED" || t.status === "CANCELLED") throw new ConflictException(`${t.transferNumber} is already ${t.status.toLowerCase()}.`);
      base = { kind: "TRANSFER", transferId: t.id, fromLabel: t.fromBranch.name, toLabel: t.toBranch.name, fromLat: t.fromBranch.lat, fromLng: t.fromBranch.lng, toLat: t.toBranch.lat, toLng: t.toBranch.lng };
    } else {
      const r = await this.prisma.goodsRelease.findFirst({ where: { id: dto.releaseId, organizationId: org }, select: { id: true, branchId: true, lat: true, lng: true, collectedBy: true, vehicle: true, confirmation: { select: { id: true } }, sale: { select: { invoiceNumber: true, customer: { select: { name: true, address: true } } } } } });
      if (!r || (mine && r.branchId !== mine)) throw new NotFoundException("Delivery not found");
      if (r.confirmation) throw new ConflictException("The customer has already confirmed these goods.");
      const b = await this.prisma.branch.findUnique({ where: { id: r.branchId }, select: { name: true, lat: true, lng: true } });
      base = { kind: "DELIVERY", releaseId: r.id, fromLabel: b?.name ?? "Branch", toLabel: r.sale.customer?.name ? `${r.sale.customer.name}${r.sale.customer.address ? `, ${r.sale.customer.address}` : ""}` : `Customer (${r.sale.invoiceNumber})`, fromLat: b?.lat ?? r.lat, fromLng: b?.lng ?? r.lng, toLat: null, toLng: null };
    }
    // one live link per trip: a new driver replaces the old link
    await this.prisma.trip.updateMany({ where: { organizationId: org, ...(base.transferId ? { transferId: base.transferId } : { releaseId: base.releaseId }), status: { not: "ENDED" } }, data: { status: "ENDED", endedAt: new Date(), endReason: "Replaced by a new driver link" } });
    const trip = await this.prisma.trip.create({ data: {
      organizationId: org, kind: base.kind, transferId: base.transferId ?? null, releaseId: base.releaseId ?? null, token: newToken(),
      driverName: dto.driverName.trim(), driverPhone: dto.driverPhone?.trim() || null, vehicle: dto.vehicle?.trim() || null,
      fromLabel: base.fromLabel, toLabel: base.toLabel, fromLat: base.fromLat, fromLng: base.fromLng, toLat: base.toLat, toLng: base.toLng, createdByUserId: user.sub,
    } });
    const org_ = await this.prisma.organization.findUnique({ where: { id: org }, select: { name: true } });
    return { ...this.shape(trip), token: trip.token, company: org_?.name ?? "" };
  }

  private shape(t: { id: string; kind: string; status: string; driverName: string; driverPhone: string | null; vehicle: string | null; fromLabel: string; toLabel: string; fromLat: number | null; fromLng: number | null; toLat: number | null; toLng: number | null; lastLat: number | null; lastLng: number | null; lastAccuracy: number | null; lastAt: Date | null; startedAt: Date | null; endedAt: Date | null; endReason: string | null; transferId: string | null; releaseId: string | null; createdAt: Date }) {
    const stale = t.status !== "ENDED" && (t.lastAt ?? t.createdAt).getTime() < Date.now() - STALE_MS;
    const status = stale ? "ENDED" : t.status;
    const left = t.lastLat !== null && t.lastLng !== null && t.toLat !== null && t.toLng !== null ? Math.round(km({ lat: t.lastLat, lng: t.lastLng }, { lat: t.toLat, lng: t.toLng }) * 10) / 10 : null;
    return { id: t.id, kind: t.kind, status, driverName: t.driverName, driverPhone: t.driverPhone, vehicle: t.vehicle, from: { label: t.fromLabel, lat: t.fromLat, lng: t.fromLng }, to: { label: t.toLabel, lat: t.toLat, lng: t.toLng },
      last: t.lastLat !== null && t.lastLng !== null ? { lat: t.lastLat, lng: t.lastLng, accuracy: t.lastAccuracy, at: t.lastAt } : null, kmLeft: left,
      startedAt: t.startedAt, endedAt: stale ? (t.endedAt ?? t.lastAt) : t.endedAt, endReason: stale && !t.endReason ? "No location for 2 days" : t.endReason, transferId: t.transferId, releaseId: t.releaseId, createdAt: t.createdAt };
  }

  private async visible(user: AuthUser, id: string) {
    const t = await this.prisma.trip.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!t) throw new NotFoundException("Trip not found");
    const mine = scopeOf(user);
    if (mine && t.transferId) {
      const tr = await this.prisma.stockTransfer.findUnique({ where: { id: t.transferId }, select: { fromBranchId: true, toBranchId: true } });
      if (!tr || (tr.fromBranchId !== mine && tr.toBranchId !== mine)) throw new NotFoundException("Trip not found");
    }
    if (mine && t.releaseId) {
      const r = await this.prisma.goodsRelease.findUnique({ where: { id: t.releaseId }, select: { branchId: true } });
      if (!r || r.branchId !== mine) throw new NotFoundException("Trip not found");
    }
    return t;
  }

  /** One trip with its route so far (the points, thinned to at most 500). */
  async get(user: AuthUser, id: string) {
    const t = await this.visible(user, id);
    const pts = await this.prisma.tripPoint.findMany({ where: { tripId: id }, orderBy: { at: "asc" }, select: { lat: true, lng: true, at: true } });
    const step = Math.max(1, Math.ceil(pts.length / 500));
    const route = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    return { ...this.shape(t), route };
  }

  /** The trips for a transfer or a delivery (newest first), or every trip still on the road. */
  async list(user: AuthUser, q: { transferId?: string; releaseId?: string; active?: boolean }) {
    const mine = scopeOf(user);
    const rows = await this.prisma.trip.findMany({
      where: { organizationId: user.organizationId, ...(q.transferId ? { transferId: q.transferId } : {}), ...(q.releaseId ? { releaseId: q.releaseId } : {}), ...(q.active ? { status: { not: "ENDED" }, OR: [{ lastAt: { gte: new Date(Date.now() - STALE_MS) } }, { lastAt: null, createdAt: { gte: new Date(Date.now() - STALE_MS) } }] } : {}) },
      orderBy: { createdAt: "desc" }, take: 200,
    });
    let out = rows;
    if (mine) {
      const tIds = rows.map(r => r.transferId).filter((x): x is string => !!x), rIds = rows.map(r => r.releaseId).filter((x): x is string => !!x);
      const [ts, rs] = await Promise.all([
        this.prisma.stockTransfer.findMany({ where: { id: { in: tIds } }, select: { id: true, fromBranchId: true, toBranchId: true } }),
        this.prisma.goodsRelease.findMany({ where: { id: { in: rIds } }, select: { id: true, branchId: true } }),
      ]);
      out = rows.filter(r => r.transferId ? ts.some(t => t.id === r.transferId && (t.fromBranchId === mine || t.toBranchId === mine)) : rs.some(x => x.id === r.releaseId && x.branchId === mine));
    }
    const shaped = out.map(r => this.shape(r));
    return q.active ? shaped.filter(s => s.status !== "ENDED") : shaped;
  }

  async stop(user: AuthUser, id: string) {
    const t = await this.visible(user, id);
    if (t.status === "ENDED") return this.shape(t);
    return this.shape(await this.prisma.trip.update({ where: { id: t.id }, data: { status: "ENDED", endedAt: new Date(), endReason: "Stopped by the business" } }));
  }

  /** The same, outside a transaction (a transfer cancelled). */
  async endTrips(where: { transferId?: string; releaseId?: string }, reason: string) {
    await this.prisma.trip.updateMany({ where: { ...where, status: { not: "ENDED" } }, data: { status: "ENDED", endedAt: new Date(), endReason: reason } });
  }

  /** Called when goods are scanned in or the customer confirms: the trip is over and the driver's link stops sharing. */
  async endFor(tx: Tx, where: { transferId?: string; releaseId?: string }, reason: string) {
    await tx.trip.updateMany({ where: { ...where, status: { not: "ENDED" } }, data: { status: "ENDED", endedAt: new Date(), endReason: reason } });
  }

  // ------------------------------------------------------------------ the driver's side (no sign-in: the link is the key)

  private async byToken(token: string) {
    const t = await this.prisma.trip.findUnique({ where: { token: (token ?? "").trim().toLowerCase() } });
    if (!t) throw new NotFoundException("This trip link is not valid.");
    return t;
  }

  async driverInfo(token: string) {
    const t = await this.byToken(token);
    const s = this.shape(t), org = await this.prisma.organization.findUnique({ where: { id: t.organizationId }, select: { name: true } });
    let items = 0, ref = "";
    if (t.transferId) {
      const tr = await this.prisma.stockTransfer.findUnique({ where: { id: t.transferId }, select: { transferNumber: true, items: { select: { quantity: true, sentQuantity: true } } } });
      items = tr?.items.reduce((n, i) => n + (i.sentQuantity ?? i.quantity), 0) ?? 0; ref = tr?.transferNumber ?? "";
    } else if (t.releaseId) {
      const r = await this.prisma.goodsRelease.findUnique({ where: { id: t.releaseId }, select: { number: true, items: { select: { quantity: true } } } });
      items = r?.items.reduce((n, i) => n + i.quantity, 0) ?? 0; ref = r?.number ?? "";
    }
    // the driver sees only what they need: where from, where to, how many items, and whether to keep sharing
    return { company: org?.name ?? "", kind: s.kind, status: s.status, driverName: s.driverName, vehicle: s.vehicle, from: s.from.label, to: s.to.label, items, ref, startedAt: s.startedAt, lastAt: s.last?.at ?? null, endReason: s.status === "ENDED" ? s.endReason : null };
  }

  private hits = new Map<string, number[]>();
  async driverPoints(token: string, dto: PointsDto) {
    const now = Date.now(), list = (this.hits.get(token) ?? []).filter(x => x > now - 60_000);
    if (list.length >= 12) throw new HttpException("Sending too fast. Wait a little.", HttpStatus.TOO_MANY_REQUESTS);
    list.push(now); this.hits.set(token, list);
    const t = await this.byToken(token);
    const s = this.shape(t);
    if (s.status === "ENDED") return { status: "ENDED", reason: s.endReason };
    // keep readings from this trip's time only, good enough to draw, in order
    const from = (t.startedAt ?? t.createdAt).getTime() - 5 * 60_000;
    const pts = dto.points.map(p => ({ ...p, when: new Date(p.at) }))
      .filter(p => p.when.getTime() >= from && p.when.getTime() <= now + 2 * 60_000 && place(p))
      .sort((a, b) => a.when.getTime() - b.when.getTime());
    if (pts.length) {
      await this.prisma.tripPoint.createMany({ data: pts.map(p => ({ tripId: t.id, lat: p.lat, lng: p.lng, accuracy: p.accuracy ?? null, speed: p.speed ?? null, at: p.when })) });
      const last = pts[pts.length - 1];
      if (!t.lastAt || last.when >= t.lastAt) await this.prisma.trip.update({ where: { id: t.id }, data: { lastLat: last.lat, lastLng: last.lng, lastAccuracy: last.accuracy ?? null, lastAt: last.when, status: "LIVE", startedAt: t.startedAt ?? new Date() } });
    } else if (t.status === "WAITING") await this.prisma.trip.update({ where: { id: t.id }, data: { status: "LIVE", startedAt: new Date() } });
    return { status: "LIVE", saved: pts.length };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("trips")
export class TripsController {
  constructor(private readonly svc: TripsService) {}
  /** A link for the driver of a transfer or a delivery. */
  @Post() @RequirePermissions("STOCK_TRANSFERS:UPDATE", "SALES:UPDATE", "SALES:CREATE")
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateTripDto) { return this.svc.create(u, dto); }
  @Get() @RequirePermissions("STOCK_TRANSFERS:READ", "SALES:READ")
  list(@CurrentUser() u: AuthUser, @Query("transferId") transferId?: string, @Query("releaseId") releaseId?: string, @Query("active") active?: string) { return this.svc.list(u, { transferId, releaseId, active: active === "1" }); }
  @Get(":id") @RequirePermissions("STOCK_TRANSFERS:READ", "SALES:READ")
  get(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.get(u, id); }
  @Post(":id/stop") @RequirePermissions("STOCK_TRANSFERS:UPDATE", "SALES:UPDATE")
  stop(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.stop(u, id); }
}

/** The driver's page talks to these. No sign-in: the long code in the link is the key, and it stops working when the trip ends. */
@Controller("public/trip")
export class DriverController {
  constructor(private readonly svc: TripsService) {}
  @Get(":token") info(@Param("token") token: string) { return this.svc.driverInfo(token); }
  @Post(":token/points") @HttpCode(200) points(@Param("token") token: string, @Body() dto: PointsDto) { return this.svc.driverPoints(token, dto); }
}

@Module({ controllers: [TripsController, DriverController], providers: [TripsService], exports: [TripsService] })
export class TripsModule {}
