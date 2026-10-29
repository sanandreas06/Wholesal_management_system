import { BadRequestException, Body, Controller, Get, Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy, Patch, Post, Query, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { IsBoolean } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { MailerService } from "../auth/mailer";
import { SmsService } from "../auth/sms";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { scopeOf } from "../common/branch/branch-scope";

const r2 = (n: number) => Math.round(n * 100) / 100;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** The company's local calendar day (its own time zone): its date and where it starts and ends. */
export function localDay(tz: string, at = new Date()) {
  const ymd = at.toLocaleDateString("en-CA", { timeZone: tz }); // 2026-10-29
  const [y, m, d] = ymd.split("-").map(Number);
  const offset = new Date(at.toLocaleString("en-US", { timeZone: tz })).getTime() - new Date(at.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const start = new Date(Date.UTC(y, m - 1, d) - offset);
  const hour = Number(at.toLocaleString("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }));
  return { day: ymd, start, end: new Date(start.getTime() + 86400_000), hour };
}

export interface BranchDay { branch: string; sales: number; salesTotal: number; cash: number; momo: number; bank: number; creditGiven: number; debtsCollected: number; expenses: number; offlineSales: number }
export interface DaySummary {
  company: string; currency: string; day: string; label: string;
  total: BranchDay; branches: BranchDay[];
  topProducts: { name: string; quantity: number; amount: number }[];
  owedToYou: number; overdueCustomers: number; goodsWaiting: number; outOfStock: number; lowStock: number;
  openQuestions: number; newQuestions: number; customerProblems: number; cashDifferences: { cashier: string; difference: number }[];
}

/**
 * The owner's evening summary: what each branch sold today and how it was paid, debts collected and given, what customers owe,
 * goods waiting for collection, stock running out, and anything that needs a decision (handover questions, customer complaints,
 * cash differences at the tills). Sent once a day, after SUMMARY_HOUR (default 20:00) in the company's own time zone,
 * by email (and a short text message when text messages are set up and the owner has a phone number).
 */
@Injectable()
export class SummaryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger("DailySummary");
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly prisma: PrismaService, private readonly mailer: MailerService, private readonly sms: SmsService) {}

  onApplicationBootstrap() {
    if ((process.env.DAILY_SUMMARY || "on").toLowerCase() === "off" || process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => { void this.tick(); }, 10 * 60_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  get hour() { const h = Number(process.env.SUMMARY_HOUR); return Number.isFinite(h) && h >= 0 && h <= 23 ? Math.floor(h) : 20; }

  async build(orgId: string, at = new Date(), branchId?: string | null): Promise<DaySummary> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true, currency: true, timeZone: true } });
    const { day, start, end } = localDay(org.timeZone || "Africa/Accra", at);
    const inDay = { gte: start, lt: end }, b = branchId ? { branchId } : {};
    const [branches, sales, pays, expenses, owedSales, waiting, inv, openQ, newQ, problems, cashCases] = await Promise.all([
      this.prisma.branch.findMany({ where: { organizationId: orgId, ...(branchId ? { id: branchId } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.sale.findMany({ where: { organizationId: orgId, ...b, status: "COMPLETED", soldAt: inDay }, select: { id: true, branchId: true, totalAmount: true, offline: true, payments: { select: { amount: true } }, items: { select: { quantity: true, lineTotal: true, product: { select: { name: true } } } } } }),
      this.prisma.payment.findMany({ where: { organizationId: orgId, receivedAt: inDay, sale: { status: "COMPLETED", ...b } }, select: { method: true, amount: true, sale: { select: { branchId: true, soldAt: true } } } }),
      this.prisma.expense.findMany({ where: { organizationId: orgId, ...b, expenseDate: inDay, status: { not: "REJECTED" } }, select: { branchId: true, amount: true } }),
      this.prisma.sale.findMany({ where: { organizationId: orgId, ...b, status: "COMPLETED", customerId: { not: null } }, select: { customerId: true, soldAt: true, totalAmount: true, payments: { select: { amount: true } }, customer: { select: { creditDays: true } } } }),
      this.prisma.sale.count({ where: { organizationId: orgId, ...b, status: "COMPLETED", fulfilment: { in: ["AWAITING", "PARTLY"] } } }),
      this.prisma.inventory.findMany({ where: { organizationId: orgId, ...b }, select: { quantity: true, product: { select: { reorderLevel: true } } } }),
      this.prisma.handoverIssue.count({ where: { organizationId: orgId, status: { not: "CLOSED" }, ...(branchId ? { OR: [{ branchId }, { otherBranchId: branchId }] } : {}) } }),
      this.prisma.handoverIssue.count({ where: { organizationId: orgId, createdAt: inDay, ...(branchId ? { OR: [{ branchId }, { otherBranchId: branchId }] } : {}) } }),
      this.prisma.customerConfirmation.count({ where: { organizationId: orgId, ...b, status: "PROBLEM", createdAt: inDay } }),
      this.prisma.varianceCase.findMany({ where: { organizationId: orgId, ...b, shiftId: { not: null }, createdAt: inDay }, select: { cashierId: true, difference: true } }),
    ]);
    const blank = (name: string): BranchDay => ({ branch: name, sales: 0, salesTotal: 0, cash: 0, momo: 0, bank: 0, creditGiven: 0, debtsCollected: 0, expenses: 0, offlineSales: 0 });
    const per = new Map(branches.map(x => [x.id, blank(x.name)]));
    for (const s of sales) {
      const row = per.get(s.branchId); if (!row) continue;
      row.sales++; row.salesTotal += Number(s.totalAmount); if (s.offline) row.offlineSales++;
      row.creditGiven += Math.max(0, Number(s.totalAmount) - s.payments.reduce((t, p) => t + Number(p.amount), 0));
    }
    for (const p of pays) {
      const row = per.get(p.sale.branchId); if (!row) continue;
      const a = Number(p.amount);
      if (p.method === "CASH") row.cash += a; else if (p.method === "MOBILE_MONEY") row.momo += a; else if (p.method === "BANK") row.bank += a;
      if (p.sale.soldAt < start) row.debtsCollected += a; // paid today for a sale from an earlier day
    }
    for (const e of expenses) { const row = per.get(e.branchId); if (row) row.expenses += Number(e.amount); }
    const rows = [...per.values()].map(r => ({ ...r, salesTotal: r2(r.salesTotal), cash: r2(r.cash), momo: r2(r.momo), bank: r2(r.bank), creditGiven: r2(r.creditGiven), debtsCollected: r2(r.debtsCollected), expenses: r2(r.expenses) }));
    const total = rows.reduce((t, r) => ({ ...t, sales: t.sales + r.sales, salesTotal: r2(t.salesTotal + r.salesTotal), cash: r2(t.cash + r.cash), momo: r2(t.momo + r.momo), bank: r2(t.bank + r.bank), creditGiven: r2(t.creditGiven + r.creditGiven), debtsCollected: r2(t.debtsCollected + r.debtsCollected), expenses: r2(t.expenses + r.expenses), offlineSales: t.offlineSales + r.offlineSales }), blank("All branches"));
    const prod = new Map<string, { quantity: number; amount: number }>();
    for (const s of sales) for (const i of s.items) { const p = prod.get(i.product.name) ?? { quantity: 0, amount: 0 }; p.quantity += i.quantity; p.amount += Number(i.lineTotal); prod.set(i.product.name, p); }
    const topProducts = [...prod.entries()].map(([name, v]) => ({ name, quantity: v.quantity, amount: r2(v.amount) })).sort((a, c) => c.amount - a.amount).slice(0, 5);
    let owedToYou = 0; const overdue = new Set<string>();
    for (const s of owedSales) {
      const due = Number(s.totalAmount) - s.payments.reduce((t, p) => t + Number(p.amount), 0);
      if (due <= 0.005) continue;
      owedToYou += due;
      if ((Date.now() - s.soldAt.getTime()) / 86400_000 > (s.customer?.creditDays ?? 30)) overdue.add(s.customerId!);
    }
    const cashiers = await this.prisma.user.findMany({ where: { id: { in: cashCases.map(c => c.cashierId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    return {
      company: org.name, currency: org.currency || "GHS", day, label: new Date(start.getTime() + 12 * 3600_000).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
      total, branches: rows, topProducts, owedToYou: r2(owedToYou), overdueCustomers: overdue.size, goodsWaiting: waiting,
      outOfStock: inv.filter(i => i.quantity <= 0).length, lowStock: inv.filter(i => i.quantity > 0 && i.quantity <= i.product.reorderLevel).length,
      openQuestions: openQ, newQuestions: newQ, customerProblems: problems,
      cashDifferences: cashCases.map(c => ({ cashier: cashiers.find(u => u.id === c.cashierId)?.name ?? "A cashier", difference: Number(c.difference) })),
    };
  }

  // ------------------------------------------------------------------ the message

  private money(cur: string, n: number) { return `${cur === "GHS" ? "GH₵" : cur} ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

  render(s: DaySummary, webUrl: string) {
    const m = (n: number) => this.money(s.currency, n);
    const attention = [
      s.cashDifferences.length ? `Cash difference at the till: ${s.cashDifferences.map(c => `${c.cashier} ${c.difference < 0 ? "short" : "over"} ${m(Math.abs(c.difference))}`).join("; ")}` : "",
      s.customerProblems ? `${s.customerProblems} customer${s.customerProblems === 1 ? "" : "s"} reported missing or wrong goods` : "",
      s.openQuestions ? `${s.openQuestions} handover question${s.openQuestions === 1 ? "" : "s"} waiting (${s.newQuestions} new today)` : "",
      s.total.offlineSales ? `${s.total.offlineSales} sale${s.total.offlineSales === 1 ? " was" : "s were"} made without internet` : "",
      s.outOfStock ? `${s.outOfStock} item${s.outOfStock === 1 ? " is" : "s are"} out of stock, ${s.lowStock} running low` : s.lowStock ? `${s.lowStock} item${s.lowStock === 1 ? " is" : "s are"} running low` : "",
      s.goodsWaiting ? `${s.goodsWaiting} customer${s.goodsWaiting === 1 ? " has" : "s have"} paid goods waiting for collection` : "",
    ].filter(Boolean);
    const text = [
      `${s.company}: ${s.label}`, "",
      `Sales: ${m(s.total.salesTotal)} (${s.total.sales} sale${s.total.sales === 1 ? "" : "s"})`,
      `Money in: cash ${m(s.total.cash)}, mobile money ${m(s.total.momo)}, bank ${m(s.total.bank)}`,
      `Debts collected: ${m(s.total.debtsCollected)}. New credit given: ${m(s.total.creditGiven)}. Expenses: ${m(s.total.expenses)}`,
      `Customers owe you ${m(s.owedToYou)}${s.overdueCustomers ? ` (${s.overdueCustomers} past their credit days)` : ""}`,
      ...(s.branches.length > 1 ? ["", "By branch:", ...s.branches.map(b => `- ${b.branch}: ${m(b.salesTotal)} (${b.sales}), cash ${m(b.cash)}, MoMo ${m(b.momo)}`)] : []),
      ...(s.topProducts.length ? ["", "Best sellers: " + s.topProducts.map(p => `${p.name} (${p.quantity})`).join(", ")] : []),
      ...(attention.length ? ["", "Needs your attention:", ...attention.map(a => `- ${a}`)] : ["", "Nothing needs your attention today."]),
      "", `Open WHOLESTRA: ${webUrl}`, "", "You get this every evening because you are an owner. Turn it off on the Daily summary page.",
    ].join("\n");
    const td = "padding:6px 10px;border-bottom:1px solid #EEF0F3", th = "padding:6px 10px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em";
    const tile = (k: string, v: string) => `<td style="padding:10px 12px;background:#F3F6FB;border-radius:10px"><div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em">${k}</div><div style="font-size:18px;font-weight:800;color:#0B1B3E">${v}</div></td>`;
    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1A2332;max-width:640px;margin:auto">
      <div style="background:#0B1B3E;color:#fff;padding:18px 20px;border-radius:14px 14px 0 0"><div style="font-size:12px;letter-spacing:.12em;color:#F5C451;font-weight:700">WHOLESTRA · EVENING SUMMARY</div><div style="font-size:20px;font-weight:800;margin-top:4px">${esc(s.company)}</div><div style="color:#B4C0DC">${esc(s.label)}</div></div>
      <div style="border:1px solid #E2E5EA;border-top:0;border-radius:0 0 14px 14px;padding:18px 20px">
      <table style="width:100%;border-spacing:8px;margin:-8px"><tr>${tile("Sales", m(s.total.salesTotal))}${tile("Cash", m(s.total.cash))}${tile("Mobile money", m(s.total.momo))}</tr><tr>${tile("Debts collected", m(s.total.debtsCollected))}${tile("Credit given", m(s.total.creditGiven))}${tile("Owed to you", m(s.owedToYou))}</tr></table>
      ${attention.length ? `<h3 style="margin:20px 0 6px;font-size:15px;color:#B23B3B">Needs your attention</h3><ul style="margin:0;padding-left:18px;line-height:1.6">${attention.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : `<p style="margin:18px 0 0;color:#16A34A;font-weight:700">Nothing needs your attention today.</p>`}
      ${s.branches.length > 1 ? `<h3 style="margin:20px 0 6px;font-size:15px">By branch</h3><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><th style="${th}">Branch</th><th style="${th}">Sales</th><th style="${th}">Cash</th><th style="${th}">MoMo</th><th style="${th}">Bank</th></tr>${s.branches.map(b => `<tr><td style="${td}">${esc(b.branch)}</td><td style="${td}">${m(b.salesTotal)} <span style="color:#6B7280">(${b.sales})</span></td><td style="${td}">${m(b.cash)}</td><td style="${td}">${m(b.momo)}</td><td style="${td}">${m(b.bank)}</td></tr>`).join("")}</table>` : ""}
      ${s.topProducts.length ? `<h3 style="margin:20px 0 6px;font-size:15px">Best sellers today</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${s.topProducts.map(p => `<tr><td style="${td}">${esc(p.name)}</td><td style="${td};text-align:right">${p.quantity}</td><td style="${td};text-align:right">${m(p.amount)}</td></tr>`).join("")}</table>` : ""}
      <p style="margin:22px 0 0"><a href="${esc(webUrl)}" style="display:inline-block;background:#0B1B3E;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:700">Open WHOLESTRA</a></p>
      <p style="color:#9CA3AF;font-size:12px;margin-top:18px">You get this every evening because you are an owner. Turn it off on the Daily summary page in WHOLESTRA.</p></div></div>`;
    const sms = `${s.company} ${s.day.slice(5)}: Sales ${m(s.total.salesTotal)} (${s.total.sales}). Cash ${m(s.total.cash)}, MoMo ${m(s.total.momo)}. Owed to you ${m(s.owedToYou)}.${attention.length ? ` ${attention.length} item${attention.length === 1 ? "" : "s"} need attention.` : ""} Details in your email.`.slice(0, 300);
    return { subject: `${s.company}: today ${m(s.total.salesTotal)} in sales${attention.length ? ` · ${attention.length} to check` : ""}`, text, html, sms };
  }

  private webUrl() { return (process.env.WEB_URL || "https://wholesal-management-system.vercel.app").replace(/\/$/, "") + "/dashboard"; }

  /** Owners who want the summary. */
  private recipients(orgId: string) {
    return this.prisma.user.findMany({ where: { organizationId: orgId, status: "ACTIVE", dailySummary: true, userRoles: { some: { role: { code: "SUPER_ADMIN" } } } }, select: { id: true, email: true, name: true, phone: true } });
  }

  /** Sends today's summary to one company's owners (once a day; `force` sends again, for testing). */
  async sendFor(orgId: string, opts: { force?: boolean; onlyUserId?: string } = {}) {
    const s = await this.build(orgId);
    let people = await this.recipients(orgId);
    if (opts.onlyUserId) {
      const me = await this.prisma.user.findUnique({ where: { id: opts.onlyUserId }, select: { id: true, email: true, name: true, phone: true } });
      people = me ? [me] : [];
    }
    if (!people.length) return { sent: 0, day: s.day };
    if (!opts.force && !opts.onlyUserId) {
      try { await this.prisma.dailySummaryLog.create({ data: { organizationId: orgId, day: s.day, recipients: people.length } }); }
      catch { return { sent: 0, day: s.day, already: true }; } // another run already sent today's
    }
    const msg = this.render(s, this.webUrl());
    let sent = 0;
    for (const p of people) {
      if (this.mailer.configured) { try { await this.mailer.send({ to: p.email, subject: msg.subject, text: msg.text, html: msg.html }); sent++; } catch (e) { this.log.warn(`summary email to ${p.email} failed: ${(e as Error).message}`); } }
      if (this.sms.configured && p.phone) { try { await this.sms.send(p.phone, msg.sms); } catch (e) { this.log.warn(`summary text failed: ${(e as Error).message}`); } }
    }
    return { sent, day: s.day };
  }

  /** Every 10 minutes: each company whose evening has come and that has not had today's summary gets it. */
  async tick() {
    try {
      const orgs = await this.prisma.organization.findMany({ where: { isDemo: false, setupPending: false }, select: { id: true, timeZone: true } });
      for (const o of orgs) {
        const { day, hour } = localDay(o.timeZone || "Africa/Accra");
        if (hour < this.hour) continue;
        if (await this.prisma.dailySummaryLog.findUnique({ where: { organizationId_day: { organizationId: o.id, day } }, select: { id: true } })) continue;
        const r = await this.sendFor(o.id);
        if (r.sent) this.log.log(`sent ${day} summary for ${o.id} to ${r.sent} owner(s)`);
      }
    } catch (e) { this.log.warn(`daily summary run failed: ${(e as Error).message}`); }
  }
}

class SubscriptionDto { @IsBoolean() on!: boolean }

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("summary")
export class SummaryController {
  constructor(private readonly svc: SummaryService, private readonly prisma: PrismaService, private readonly mailer: MailerService, private readonly sms: SmsService) {}

  /** Today's summary on screen (people limited to one branch see their branch). */
  @Get() @RequirePermissions("DASHBOARD:READ")
  today(@CurrentUser() u: AuthUser, @Query("day") day?: string) {
    let at = new Date();
    if (day) { if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException("Use a date like 2026-10-29."); at = new Date(`${day}T12:00:00Z`); }
    return this.svc.build(u.organizationId, at, scopeOf(u));
  }

  @Get("subscription") @RequirePermissions("DASHBOARD:READ")
  async subscription(@CurrentUser() u: AuthUser) {
    const me = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { dailySummary: true, email: true, phone: true } });
    return { on: !!me?.dailySummary, owner: u.roles.includes("SUPER_ADMIN"), email: me?.email ?? "", phone: me?.phone ?? null, mail: this.mailer.configured, sms: this.sms.configured, hour: this.svc.hour };
  }

  @Patch("subscription") @RequirePermissions("DASHBOARD:READ")
  async setSubscription(@CurrentUser() u: AuthUser, @Body() dto: SubscriptionDto) {
    await this.prisma.user.update({ where: { id: u.sub }, data: { dailySummary: dto.on } });
    return { on: dto.on };
  }

  /** Emails today's summary to the person asking, now (to see what it looks like). Owners only: it covers every branch. */
  @Post("send-me") @RequirePermissions("ORGANIZATION:UPDATE")
  async sendMe(@CurrentUser() u: AuthUser) {
    if (!this.mailer.configured) throw new ServiceUnavailableException("Email is not set up on this server yet, so the summary cannot be sent.");
    return this.svc.sendFor(u.organizationId, { onlyUserId: u.sub });
  }
}

@Module({ imports: [AuthModule], controllers: [SummaryController], providers: [SummaryService], exports: [SummaryService] })
export class SummaryModule {}
