import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Injectable, Logger, Module, NotFoundException, OnModuleInit, Param, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { createHash, timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/types/auth-user.type";
import { MailerService } from "../auth/mailer";
import { AuthModule } from "../auth/auth.module";

/** Error tracking and uptime for the people who run WHOLESTRA (not for customer companies).
 *  - API errors (anything that ends in a 5xx) are recorded by the global error filter.
 *  - Website errors are sent by the browser to POST /monitor/client-error.
 *  - A scheduled check (.github/workflows/uptime.yml) calls POST /monitor/ping every 5 minutes with MONITOR_KEY.
 *  - A new kind of error, or one that comes back after being marked fixed, is emailed to PLATFORM_ADMINS (at most once an hour each).
 *  PLATFORM_ADMINS is a comma-separated list of emails allowed to open the Platform monitor page. */

import { isPlatformAdmin, platformAdmins } from "./admins";
export { isPlatformAdmin, platformAdmins };

const release = () => (process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? "").slice(0, 7) || null;
const clip = (s: unknown, n: number) => (s == null ? null : String(s).slice(0, n));

export type Captured = { source: "web" | "api"; message: string; stack?: string | null; path?: string | null; method?: string | null; status?: number | null;
  release?: string | null; userAgent?: string | null; orgId?: string | null; userId?: string | null };

/** The first few meaningful lines of a stack, with numbers that change between builds removed, so repeats group together. */
function fingerprint(e: Captured) {
  const frames = (e.stack ?? "").split("\n").slice(1, 4).map((l) => l.replace(/:\d+:\d+/g, "").replace(/\?[^)\s]*/g, "").trim()).join("|");
  const msg = e.message.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "<id>").replace(/\d{3,}/g, "<n>").slice(0, 300);
  const where = (e.path ?? "").replace(/\/w\/[^/]+/, "/w/*").replace(/\/[0-9a-f-]{20,}/gi, "/:id").split("?")[0];
  return createHash("sha1").update(`${e.source}|${msg}|${frames || where}`).digest("hex").slice(0, 20);
}

@Injectable()
export class MonitorService implements OnModuleInit {
  private readonly log = new Logger("Monitor");
  private alertsToday = { day: "", n: 0 };
  constructor(private readonly prisma: PrismaService, private readonly mailer: MailerService) {}

  /** The API starting is worth knowing: a deploy, a crash and restart, or the free plan waking up. */
  async onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    await this.prisma.uptimeCheck.create({ data: { source: "start" } }).catch(() => undefined);
  }

  /** Records an error. Never throws: monitoring must not cause a second failure. */
  async capture(e: Captured) {
    try {
      const fp = fingerprint(e);
      const org = e.orgId ? await this.prisma.organization.findUnique({ where: { id: e.orgId }, select: { name: true } }).catch(() => null) : null;
      const data = { message: clip(e.message, 2000) || "(no message)", stack: clip(e.stack, 8000), path: clip(e.path, 400), method: clip(e.method, 10), status: e.status ?? null,
        release: clip(e.release ?? release(), 40), userAgent: clip(e.userAgent, 300), lastOrg: clip(org?.name, 120), lastUserId: e.userId ?? null };
      const before = await this.prisma.errorEvent.findUnique({ where: { fingerprint: fp }, select: { resolvedAt: true, lastAlertAt: true } });
      const row = await this.prisma.errorEvent.upsert({
        where: { fingerprint: fp },
        create: { fingerprint: fp, source: e.source, ...data },
        update: { ...data, count: { increment: 1 }, lastSeen: new Date(), resolvedAt: null },
      });
      const isNew = !before, cameBack = !!before?.resolvedAt;
      const quiet = before?.lastAlertAt && Date.now() - before.lastAlertAt.getTime() < 3_600_000;
      if ((isNew || cameBack) && !quiet) await this.alert(row.id, isNew ? "New error" : "Error is back", e, data.lastOrg);
    } catch (err) {
      this.log.warn(`could not record an error: ${(err as Error).message}`);
    }
  }

  private async alert(id: string, kind: string, e: Captured, org: string | null) {
    const to = platformAdmins();
    if (!to.length || !this.mailer.configured) return;
    const day = new Date().toISOString().slice(0, 10);
    if (this.alertsToday.day !== day) this.alertsToday = { day, n: 0 };
    if (this.alertsToday.n >= 30) return; // a flood of errors never turns into a flood of email
    this.alertsToday.n++;
    await this.prisma.errorEvent.update({ where: { id }, data: { lastAlertAt: new Date() } }).catch(() => undefined);
    const web = (process.env.WEB_URL ?? "").replace(/\/$/, "");
    const where = e.source === "web" ? "the website" : "the API";
    const lines = [`${kind} on ${where}:`, "", e.message.slice(0, 500), "", `Page or address: ${e.path ?? "-"}`, `Company: ${org ?? "-"}`, `Deploy: ${e.release ?? release() ?? "-"}`, "",
      web ? `Open the Platform monitor: ${web}/platform/monitor` : "Open the Platform monitor page in WHOLESTRA."];
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
    for (const addr of to) {
      await this.mailer.send({ to: addr, subject: `[WHOLESTRA] ${kind}: ${e.message.slice(0, 80)}`, text: lines.join("\n"), html: `<pre style="font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap">${esc(lines.join("\n"))}</pre>` })
        .catch((err) => this.log.warn(`alert email failed: ${(err as Error).message}`));
    }
  }

  async ping(p: { ms?: number; webOk?: boolean; webMs?: number }) {
    await this.prisma.uptimeCheck.create({ data: { source: "watcher", ms: p.ms ?? null, webOk: p.webOk ?? null, webMs: p.webMs ?? null } });
    // keep the tables small: about one ping in fifty clears old rows
    if (Math.random() < 0.02) {
      await this.prisma.uptimeCheck.deleteMany({ where: { at: { lt: new Date(Date.now() - 35 * 86_400_000) } } }).catch(() => undefined);
      await this.prisma.errorEvent.deleteMany({ where: { resolvedAt: { not: null }, lastSeen: { lt: new Date(Date.now() - 90 * 86_400_000) } } }).catch(() => undefined);
    }
    return { ok: true };
  }

  async summary() {
    const now = Date.now(), H = 3_600_000;
    // seven calendar days (UTC, which is also Ghana time), midnight to midnight, today last
    const dayStart = Math.floor(now / (24 * H)) * 24 * H - 6 * 24 * H;
    const since = new Date(dayStart);
    const [checks, errors, open] = await Promise.all([
      this.prisma.uptimeCheck.findMany({ where: { at: { gte: since } }, orderBy: { at: "asc" }, select: { at: true, source: true, ms: true, webOk: true, webMs: true } }),
      this.prisma.errorEvent.findMany({ orderBy: [{ resolvedAt: { sort: "asc", nulls: "first" } }, { lastSeen: "desc" }], take: 200 }),
      this.prisma.errorEvent.count({ where: { resolvedAt: null } }),
    ]);
    const first = await this.prisma.uptimeCheck.findFirst({ where: { source: "watcher" }, orderBy: { at: "asc" }, select: { at: true } });
    const watched = checks.filter((c) => c.source === "watcher");
    const last = watched[watched.length - 1] ?? null;
    // one cell per hour for 7 days: up (a successful check that hour), down (checks had started but none succeeded), none (before checks began)
    const hours = Array.from({ length: 7 * 24 }, (_, i) => {
      const start = dayStart + i * H, end = start + H;
      const inHour = watched.filter((c) => c.at.getTime() >= start && c.at.getTime() < end);
      const webDown = inHour.some((c) => c.webOk === false);
      const state = start > now ? "future" : inHour.length ? (webDown ? "partial" : "up") : end > now ? "now" : first && first.at.getTime() < end ? "down" : "none";
      const ms = inHour.filter((c) => c.ms != null).map((c) => c.ms as number);
      return { start: new Date(start).toISOString(), state, checks: inHour.length, avgMs: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null };
    });
    const pct = (cells: typeof hours) => { const known = cells.filter((h) => h.state === "up" || h.state === "partial" || h.state === "down"); return known.length ? Math.round((1000 * known.filter((h) => h.state !== "down").length) / known.length) / 10 : null; };
    const past = hours.filter((h) => h.state !== "future");
    return {
      now: new Date(now).toISOString(),
      watcherConfigured: !!process.env.MONITOR_KEY,
      alertsTo: platformAdmins().length, mailReady: this.mailer.configured,
      lastCheck: last ? { at: last.at.toISOString(), ms: last.ms, webOk: last.webOk, webMs: last.webMs } : null,
      starts: checks.filter((c) => c.source === "start").slice(-10).reverse().map((c) => c.at.toISOString()),
      uptime24h: pct(past.slice(-24)), uptime7d: pct(past), hours,
      openErrors: open,
      errors: errors.map((e) => ({ id: e.id, source: e.source, message: e.message, stack: e.stack, path: e.path, method: e.method, status: e.status, release: e.release, userAgent: e.userAgent,
        lastOrg: e.lastOrg, count: e.count, firstSeen: e.firstSeen.toISOString(), lastSeen: e.lastSeen.toISOString(), resolvedAt: e.resolvedAt?.toISOString() ?? null })),
    };
  }

  async resolve(id: string, fixed: boolean) {
    const r = await this.prisma.errorEvent.updateMany({ where: { id }, data: { resolvedAt: fixed ? new Date() : null } });
    if (!r.count) throw new NotFoundException("That error is no longer on the list.");
    return { ok: true };
  }
}

class ClientErrorDto {
  @IsString() @MaxLength(2000) message!: string;
  @IsOptional() @IsString() @MaxLength(8000) stack?: string;
  @IsOptional() @IsString() @MaxLength(400) path?: string;
  @IsOptional() @IsString() @MaxLength(40) release?: string;
}
class PingDto {
  @IsOptional() @IsInt() @Min(0) @Max(600_000) ms?: number;
  @IsOptional() @IsBoolean() webOk?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(600_000) webMs?: number;
}
class ResolveDto { @IsOptional() @IsBoolean() fixed?: boolean; }

type Req = { ip?: string; headers: Record<string, string | string[] | undefined>; user?: AuthUser };

/** A small per-network limit so the public error door cannot be used to fill the table. */
const hits = new Map<string, { n: number; until: number }>();
function allow(ip: string) {
  const now = Date.now(), h = hits.get(ip);
  if (!h || h.until < now) { hits.set(ip, { n: 1, until: now + 10 * 60_000 }); if (hits.size > 5000) hits.clear(); return true; }
  return ++h.n <= 40;
}

@Controller("monitor")
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  /** From the website: an error in someone's browser. Signed-in or not; the sign-in, if any, only adds which company it was. */
  @Post("client-error") @HttpCode(204)
  async clientError(@Body() dto: ClientErrorDto, @Req() req: Req) {
    if (!allow(req.ip ?? "?")) return;
    const ua = String(req.headers["user-agent"] ?? "");
    if (/bot|crawler|spider|headless/i.test(ua)) return;
    await this.monitor.capture({ source: "web", message: dto.message, stack: dto.stack, path: dto.path, release: dto.release ?? null, userAgent: ua });
  }

  /** From the scheduled outside check. */
  @Post("ping") @HttpCode(200)
  ping(@Body() dto: PingDto, @Headers("x-monitor-key") key?: string) {
    const want = process.env.MONITOR_KEY ?? "";
    const a = Buffer.from(key ?? ""), b = Buffer.from(want);
    if (!want || a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException("Wrong monitor key.");
    return this.monitor.ping(dto);
  }

  @Get("summary") @UseGuards(JwtAuthGuard)
  summary(@CurrentUser() u: AuthUser) { this.admin(u); return this.monitor.summary(); }

  @Post("errors/:id/resolve") @HttpCode(200) @UseGuards(JwtAuthGuard)
  resolve(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: ResolveDto) { this.admin(u); return this.monitor.resolve(id, dto.fixed !== false); }

  /** Proves the whole chain works: this raises a real server error, which should appear on the page (and in your inbox) within seconds. */
  @Post("test-error") @HttpCode(200) @UseGuards(JwtAuthGuard)
  testError(@CurrentUser() u: AuthUser) { this.admin(u); throw new Error(`Test error from the Platform monitor (${new Date().toISOString().slice(0, 16)})`); }

  private admin(u: AuthUser) { if (u.demo || !isPlatformAdmin(u.email)) throw new ForbiddenException("Only the people who run WHOLESTRA can open the Platform monitor."); }
}

@Module({ imports: [AuthModule], controllers: [MonitorController], providers: [MonitorService], exports: [MonitorService] })
export class MonitorModule {}
