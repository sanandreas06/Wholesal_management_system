import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { AuditSealService } from "../audit/audit-seal";
import { AuthUser } from "../common/types/auth-user.type";
import { NO_BRANCH } from "../common/branch/branch-scope";
import { MailerService } from "./mailer";
import { OtpPurpose, OtpService } from "./otp.service";
import { TicketService } from "./tickets";
import { OnboardingService } from "./onboarding.service";
import { DemoService } from "./demo.service";
import { OAuthService } from "./oauth.service";
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateSecret, hashRecovery, otpauthUri, verifyTotp } from "./totp";

export interface ClientInfo { ip?: string; agent?: string }
/** "Chrome on Windows"-style label from a user-agent string; only what a person would recognise, never the raw string. */
export function deviceLabel(agent = ""): string {
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\/|Opera/.test(agent) ? "Opera" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Unknown browser";
  const os = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad|iOS/.test(agent) ? "iOS" : /Mac OS X|Macintosh/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "unknown device";
  return `${browser} on ${os}`;
}

export const normEmail = (e: string) => String(e ?? "").trim().toLowerCase();
/** At least 8 characters with a letter and a number. */
export function passwordProblem(p: string): string | null {
  if (typeof p !== "string" || p.length < 8) return "Use at least 8 characters.";
  if (p.length > 100) return "That password is too long.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Use at least one letter and one number.";
  return null;
}

const userInclude = { organization: true, branch: true, userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } as const;
type LoadedUser = NonNullable<Awaited<ReturnType<AuthService["loadById"]>>>;

@Injectable()
export class AuthService {
  private readonly log = new Logger("Auth");
  constructor(
    private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly seal: AuditSealService,
    private readonly tickets: TicketService, private readonly otp: OtpService, private readonly mailer: MailerService,
    private readonly onboarding: OnboardingService, private readonly demoSvc: DemoService, private readonly oauth: OAuthService,
  ) {}

  /** Writes a sign-in/sign-out line to the sealed Change log. Never blocks or fails the request. */
  private async record(u: { id: string; email: string; organizationId: string }, action: string, summary: string, c: ClientInfo) {
    try {
      await this.seal.append({ organizationId: u.organizationId, userId: u.id, userName: u.email, action, entityType: "Sign-in", entityId: u.id, summary, changes: { request: { device: deviceLabel(c.agent), ip: c.ip ?? null } } });
    } catch (e) { this.log.warn(`could not record ${action}: ${(e as Error).message}`); }
  }

  async logout(user: AuthUser, c: ClientInfo) {
    if (user.demo) return { ok: true };
    await this.record({ id: user.sub, email: user.email, organizationId: user.organizationId }, "SIGN OUT", "Signed out", c);
    return { ok: true };
  }

  loadById(id: string) { return this.prisma.user.findUnique({ where: { id }, include: userInclude }); }
  /** A person who may sign in with an email: active, and not part of the shared demo company. */
  private async loadByEmail(email: string) {
    const u = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: userInclude });
    return u && u.status === "ACTIVE" && !u.organization.isDemo ? u : null;
  }

  options() {
    const providers = this.oauth.available();
    return { emailCodes: this.otp.enabled, emailSignup: this.otp.enabled, providers, social: Object.values(providers).some(Boolean), demo: true };
  }

  // ------------------------------------------------------------------ step 1 and 2: email, then a code
  async startEmail(dto: { email: string; purpose: OtpPurpose }, c: ClientInfo) {
    this.otp.assertEnabled();
    const email = normEmail(dto.email);
    if (dto.purpose === "signup") {
      if (await this.onboarding.emailTaken(email)) throw new ConflictException("An account with this email already exists. Sign in instead.");
      const code = await this.otp.issue(email, "signup", c.ip, true);
      const sent = await this.otp.deliver(email, "signup", code);
      return { ok: true, expiresInSeconds: 600, ...sent };
    }
    // sign-in: the answer does not reveal whether the email has an account. If email sending is broken, everyone gets the same
    // "could not send" message (never a silent "check your inbox" that nothing will arrive in).
    const cannotSend = new ServiceUnavailableException("We could not send a code to your email just now. Please try again in a few minutes. If you use Google Authenticator, choose \"Sign in with Google Authenticator\" instead.");
    const user = await this.loadByEmail(email);
    if (!user && this.mailer.configured && this.mailer.recentlyFailed) throw cannotSend;
    const code = await this.otp.issue(email, "signin", c.ip, !!user);
    if (!user) return { ok: true, expiresInSeconds: 600 };
    try {
      return { ok: true, expiresInSeconds: 600, ...(await this.otp.deliver(email, "signin", code)) };
    } catch (e) {
      this.log.error(`sign-in code could not be sent: ${(e as Error).message}`);
      throw cannotSend;
    }
  }

  // ------------------------------------------------------------------ "remember this browser for 5 hours" after the authenticator check
  static readonly TRUST_HOURS = 5;
  private async trusted(userId: string, device?: string) {
    if (!device) return false;
    try { const t = await this.tickets.verify<{ typ: "device"; uid: string }>(device, "device"); return t.uid === userId; } catch { return false; }
  }
  private deviceToken(userId: string) { return this.tickets.sign({ typ: "device", uid: userId }, AuthService.TRUST_HOURS * 3600); }
  private async failedAttempt(u: { id: string; email: string; organizationId: string }, why: string, c: ClientInfo) {
    const recent = await this.prisma.auditLog.count({ where: { organizationId: u.organizationId, entityType: "Sign-in", entityId: u.id, action: "FAILED SIGN-IN", createdAt: { gte: new Date(Date.now() - 600_000) } } }).catch(() => 99);
    if (recent < 10) await this.record(u, "FAILED SIGN-IN", why, c);
  }

  async verifyEmail(dto: { email: string; purpose: OtpPurpose; method?: "email" | "authenticator"; code: string; device?: string }, c: ClientInfo) {
    const email = normEmail(dto.email), wrong = new BadRequestException("That code is not right, or it has expired.");
    if (dto.purpose === "signup") {
      if (!(await this.otp.check(email, "signup", dto.code))) throw wrong;
      return { ticket: await this.tickets.sign({ typ: "email", email, purpose: "signup" }, 1800) };
    }
    const user = await this.loadByEmail(email);
    if (dto.method === "authenticator") {
      if (!user || !user.totpEnabledAt || !user.totpSecret) throw wrong;
      await this.checkAuthenticator(user, dto.code, c);
      return { ticket: await this.tickets.sign({ typ: "email", email: user.email, purpose: "signin", uid: user.id }, 900), hasPassword: user.passwordSet, company: user.organization.name, device: await this.deviceToken(user.id) };
    }
    const ok = await this.otp.check(email, "signin", dto.code);
    if (user && !ok) await this.failedAttempt(user, "Failed sign-in: wrong email code", c);
    if (!ok || !user) throw wrong;
    // a code from the inbox proves the address is real
    if (!user.emailVerifiedAt) await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    // an account with an authenticator app also needs a code from it: an inbox alone is not enough to get in
    // (unless this browser passed that check in the last few hours)
    if (user.totpEnabledAt && !(await this.trusted(user.id, dto.device))) return { needsAuthenticator: true, mfa: await this.tickets.sign({ typ: "mfa", uid: user.id, next: "password" }, 600), company: user.organization.name };
    return { ticket: await this.tickets.sign({ typ: "email", email: user.email, purpose: "signin", uid: user.id }, 900), hasPassword: user.passwordSet, company: user.organization.name };
  }

  async verifyAuthenticator(dto: { mfa: string; code: string }, c: ClientInfo) {
    const t = await this.tickets.verify<{ typ: "mfa"; uid: string; next: "password" | "session" }>(dto.mfa, "mfa");
    const user = await this.loadById(t.uid);
    if (!user || user.status !== "ACTIVE" || !user.totpEnabledAt || !user.totpSecret) throw new BadRequestException("That step has expired. Please start again.");
    await this.checkAuthenticator(user, dto.code, c);
    const device = await this.deviceToken(user.id);
    if (t.next === "session") return { ...(await this.session(user, c, "authenticator")), device };
    return { ticket: await this.tickets.sign({ typ: "email", email: user.email, purpose: "signin", uid: user.id }, 900), hasPassword: user.passwordSet, company: user.organization.name, device };
  }

  // ------------------------------------------------------------------ step 3: password
  private async tooManyFailures(u: { id: string; organizationId: string }) {
    const n = await this.prisma.auditLog.count({ where: { organizationId: u.organizationId, entityType: "Sign-in", entityId: u.id, action: "FAILED SIGN-IN", createdAt: { gte: new Date(Date.now() - 600_000) } } }).catch(() => 0);
    if (n >= 10) throw new HttpException("Too many wrong attempts on this account. Please wait ten minutes and try again.", HttpStatus.TOO_MANY_REQUESTS);
  }

  async login(dto: { email?: string; password: string; ticket?: string; device?: string }, client: ClientInfo = {}) {
    let email: string;
    if (dto.ticket) {
      const t = await this.tickets.verify<{ typ: "email"; email: string; purpose: string }>(dto.ticket, "email");
      if (t.purpose !== "signin") throw new BadRequestException("That step has expired. Please start again.");
      email = t.email;
    } else {
      if (this.otp.enabled) throw new BadRequestException("Confirm your email with the code we send you first.");
      email = normEmail(dto.email ?? "");
    }
    const user = await this.loadByEmail(email);
    if (user) await this.tooManyFailures(user);
    const passwordOk = !!user && user.passwordSet && await bcrypt.compare(dto.password, user.passwordHash);
    if (!user || !passwordOk) {
      // Failed attempts on a real account are logged (the person is told nothing extra). Capped so a guessing script cannot flood the log.
      if (user) {
        const recent = await this.prisma.auditLog.count({ where: { organizationId: user.organizationId, entityType: "Sign-in", entityId: user.id, action: "FAILED SIGN-IN", createdAt: { gte: new Date(Date.now() - 600_000) } } }).catch(() => 99);
        if (recent < 10) await this.record(user, "FAILED SIGN-IN", "Failed sign-in: wrong password", client);
      }
      throw new UnauthorizedException("The email or password is not right.");
    }
    // without an email code (email not set up on this site), an account with an authenticator app still needs a code from it
    if (!dto.ticket && user.totpEnabledAt && !(await this.trusted(user.id, dto.device))) return { needsAuthenticator: true, mfa: await this.tickets.sign({ typ: "mfa", uid: user.id, next: "session" }, 600) };
    return this.session(user, client, "password");
  }

  /** Sets a new password for someone who has just proved they own the email (a first password for a Google/Facebook/LinkedIn account, or a forgotten one). */
  async resetPassword(dto: { ticket: string; password: string }, c: ClientInfo) {
    const t = await this.tickets.verify<{ typ: "email"; email: string; purpose: string }>(dto.ticket, "email");
    if (t.purpose !== "signin") throw new BadRequestException("That step has expired. Please start again.");
    const problem = passwordProblem(dto.password);
    if (problem) throw new BadRequestException(problem);
    const user = await this.loadByEmail(t.email);
    if (!user) throw new BadRequestException("That step has expired. Please start again.");
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(dto.password, 11), passwordSet: true, mustChangePassword: false, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
    await this.record(user, "PASSWORD CHANGED", user.passwordSet ? "Password was reset using an email code" : "Chose a first password", c);
    return this.session((await this.loadById(user.id)) as LoadedUser, c, "password");
  }

  // ------------------------------------------------------------------ creating an account
  async signup(dto: { ticket: string; name: string; password: string; phone?: string; referralCode?: string }, c: ClientInfo) {
    const t = await this.tickets.verify<{ typ: "email"; email: string; purpose: string }>(dto.ticket, "email");
    if (t.purpose !== "signup") throw new BadRequestException("That step has expired. Please start again.");
    const problem = passwordProblem(dto.password);
    if (problem) throw new BadRequestException(problem);
    const name = dto.name.trim().replace(/\s+/g, " ");
    const first = name.split(" ")[0];
    const made = await this.onboarding.createCompany({
      companyName: `${first}'s company`, email: t.email, name, phone: dto.phone?.trim() || null,
      passwordHash: await bcrypt.hash(dto.password, 11), passwordSet: true, referralCode: dto.referralCode, via: "email",
    });
    return this.session((await this.loadById(made.userId)) as LoadedUser, c, "signup");
  }

  /** Opens the shared demo company. The visitor's own shop or company name is kept (for our follow-up) and shown inside the demo. */
  async demo(c: ClientInfo, company?: string) {
    const name = (company ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2) throw new BadRequestException("Please type your shop or company name.");
    await this.prisma.demoVisit.create({ data: { company: name.slice(0, 80), ip: c.ip ?? null } }).catch(() => undefined);
    const id = await this.demoSvc.ensure();
    return this.session((await this.loadById(id)) as LoadedUser, c, "demo", name.slice(0, 80));
  }

  /** The last step of a Google/Facebook/LinkedIn sign-in: swaps the one-time note for a real session. */
  async exchangeOAuth(ticket: string, c: ClientInfo) {
    const t = await this.tickets.verify<{ typ: "oauth"; uid: string; provider: string; isNew?: boolean }>(ticket, "oauth", "That sign-in link has expired. Please try again.");
    if (!this.tickets.spend(ticket, 180)) throw new BadRequestException("That sign-in link was already used. Please try again.");
    const user = await this.loadById(t.uid);
    if (!user || user.status !== "ACTIVE" || user.organization.isDemo) throw new UnauthorizedException("This account cannot sign in.");
    return this.session(user, c, t.provider);
  }

  // ------------------------------------------------------------------ session
  async session(user: LoadedUser, client: ClientInfo, via: string, demoFor?: string) {
    const demo = !!user.organization.isDemo;
    if (!demo) await this.record(user, "SIGN IN", via === "password" || via === "signup" ? "Signed in" : via === "authenticator" ? "Signed in (authenticator app)" : `Signed in with ${via[0].toUpperCase()}${via.slice(1)}`, client);
    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = [...new Set(user.userRoles.flatMap((ur) => ur.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`)))];
    // A role marked "limit to own branch" keeps the person to their branch (to nothing at all if they have no branch).
    const restricted = user.userRoles.some((ur) => ur.role.branchRestricted);
    const branchScope = restricted ? (user.branchId ?? NO_BRANCH) : null;
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, organizationId: user.organizationId, branchId: user.branchId, branchScope, roles, permissions, ...(demo ? { demo: true, ...(demoFor ? { demoFor } : {}) } : {}) },
      demo ? { expiresIn: "3h" } : undefined,
    );
    return {
      accessToken,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id, name: user.name, email: user.email, organization: demo && demoFor ? demoFor : user.organization.name, ...(demo && demoFor ? { demoFor } : {}), branch: user.branch?.name ?? null, branchScope, roles, permissions,
        currency: user.organization.currency, demo, setupPending: user.organization.setupPending, authenticator: !!user.totpEnabledAt, passwordSet: user.passwordSet,
      },
    };
  }

  // ------------------------------------------------------------------ changing your own email
  /** Step 1: password check, then a code to the new address (or, while this site sends no email, the change straight away). */
  async emailChangeStart(u: AuthUser, dto: { email: string; password?: string }, c: ClientInfo) {
    const row = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { id: true, email: true, organizationId: true, passwordHash: true, passwordSet: true } });
    if (!row) throw new BadRequestException("User not found");
    if (row.passwordSet && !(await bcrypt.compare(dto.password ?? "", row.passwordHash))) throw new BadRequestException("Your password is not correct.");
    const email = normEmail(dto.email);
    if (email === row.email.toLowerCase()) throw new BadRequestException("That is already your email address.");
    if (await this.onboarding.emailTaken(email)) throw new ConflictException("Another account already uses this email address.");
    if (!this.otp.enabled) return { changed: true, email: await this.applyEmailChange(row, email, false, c) };
    const purpose: OtpPurpose = `change:${row.id}`;
    const code = await this.otp.issue(email, purpose, c.ip, true);
    return { changed: false, email, ...(await this.otp.deliver(email, purpose, code)) };
  }

  /** Step 2: the code from the new inbox proves the person owns it. */
  async emailChangeVerify(u: AuthUser, dto: { email: string; code: string }, c: ClientInfo) {
    const email = normEmail(dto.email);
    if (!(await this.otp.check(email, `change:${u.sub}`, dto.code))) throw new BadRequestException("That code is not right, or it has expired.");
    const row = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { id: true, email: true, organizationId: true } });
    if (!row) throw new BadRequestException("User not found");
    if (await this.onboarding.emailTaken(email)) throw new ConflictException("Another account already uses this email address.");
    return { changed: true, email: await this.applyEmailChange(row, email, true, c) };
  }

  private async applyEmailChange(row: { id: string; email: string; organizationId: string }, email: string, verified: boolean, c: ClientInfo) {
    await this.prisma.user.update({ where: { id: row.id }, data: { email, emailVerifiedAt: verified ? new Date() : null } });
    await this.record({ ...row, email }, "EMAIL CHANGED", `Changed sign-in email from ${row.email} to ${email}${verified ? " (confirmed with a code)" : ""}`, c);
    return email;
  }

  // ------------------------------------------------------------------ authenticator app
  /** Accepts a current code from the app, or one unused recovery code. Wrong tries are counted like wrong passwords. */
  async checkAuthenticator(user: { id: string; email: string; organizationId: string; totpSecret: string | null; totpLastStep: number | null; recoveryCodes: unknown }, code: string, c: ClientInfo) {
    await this.tooManyFailures(user);
    const clean = String(code ?? "").trim();
    if (user.totpSecret) {
      const step = verifyTotp(decryptSecret(user.totpSecret, this.tickets.keyFor("totp")), clean);
      if (step !== null && step > (user.totpLastStep ?? 0)) {
        // the update only lands for the first use of this step, so one code cannot be used twice
        const won = await this.prisma.user.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } });
        if (won.count === 1) return;
      }
    }
    const hash = hashRecovery(clean), codes = Array.isArray(user.recoveryCodes) ? (user.recoveryCodes as string[]) : [];
    if (clean.replace(/[^a-z0-9]/gi, "").length >= 10 && codes.includes(hash)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { recoveryCodes: codes.filter((h) => h !== hash) } });
      await this.record(user, "RECOVERY CODE USED", `A recovery code was used (${codes.length - 1} left)`, c);
      return;
    }
    const recent = await this.prisma.auditLog.count({ where: { organizationId: user.organizationId, entityType: "Sign-in", entityId: user.id, action: "FAILED SIGN-IN", createdAt: { gte: new Date(Date.now() - 600_000) } } }).catch(() => 99);
    if (recent < 10) await this.record(user, "FAILED SIGN-IN", "Failed sign-in: wrong authenticator code", c);
    throw new BadRequestException("That code is not right. Open your authenticator app and use the newest 6-digit code.");
  }

  async security(u: AuthUser) {
    const row = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { email: true, emailVerifiedAt: true, passwordSet: true, totpEnabledAt: true, recoveryCodes: true } });
    if (!row) throw new BadRequestException("User not found");
    return { email: row.email, emailVerified: !!row.emailVerifiedAt, passwordSet: row.passwordSet, authenticator: !!row.totpEnabledAt, recoveryCodesLeft: Array.isArray(row.recoveryCodes) ? row.recoveryCodes.length : 0 };
  }

  /** Step 1 of turning the authenticator on: a fresh secret and the address of the QR code. Nothing is switched on until a code from the app is shown to us. */
  async totpSetup(u: AuthUser) {
    const row = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { email: true, totpEnabledAt: true } });
    if (!row) throw new BadRequestException("User not found");
    if (row.totpEnabledAt) throw new BadRequestException("The authenticator app is already on. Turn it off first if you are changing phones.");
    const secret = generateSecret();
    await this.prisma.user.update({ where: { id: u.sub }, data: { totpSecret: encryptSecret(secret, this.tickets.keyFor("totp")), totpEnabledAt: null, totpLastStep: null } });
    return { secret, uri: otpauthUri({ secret, account: row.email, issuer: "WHOLESTRA" }) };
  }

  async totpEnable(u: AuthUser, code: string, c: ClientInfo) {
    const row = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { id: true, email: true, organizationId: true, totpSecret: true, totpEnabledAt: true } });
    if (!row?.totpSecret) throw new BadRequestException("Start the setup again to get a new QR code.");
    if (row.totpEnabledAt) throw new BadRequestException("The authenticator app is already on.");
    const step = verifyTotp(decryptSecret(row.totpSecret, this.tickets.keyFor("totp")), code);
    if (step === null) throw new BadRequestException("That code is not right. Check the newest 6-digit code in your app and try again.");
    const recoveryCodes = generateRecoveryCodes(8);
    await this.prisma.user.update({ where: { id: row.id }, data: { totpEnabledAt: new Date(), totpLastStep: step, recoveryCodes: recoveryCodes.map(hashRecovery) } });
    await this.record(row, "AUTHENTICATOR ON", "Turned on the authenticator app", c);
    return { recoveryCodes };
  }

  async totpDisable(u: AuthUser, dto: { code: string; password?: string }, c: ClientInfo) {
    const row = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { id: true, email: true, organizationId: true, passwordHash: true, passwordSet: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true, recoveryCodes: true } });
    if (!row?.totpEnabledAt) throw new BadRequestException("The authenticator app is not on.");
    if (row.passwordSet && !(await bcrypt.compare(dto.password ?? "", row.passwordHash))) throw new BadRequestException("Your password is not correct.");
    await this.checkAuthenticator(row, dto.code, c);
    await this.prisma.user.update({ where: { id: row.id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: Prisma.DbNull } });
    await this.record(row, "AUTHENTICATOR OFF", "Turned off the authenticator app", c);
    return { ok: true };
  }

  async newRecoveryCodes(u: AuthUser, code: string, c: ClientInfo) {
    const row = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { id: true, email: true, organizationId: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true, recoveryCodes: true } });
    if (!row?.totpEnabledAt) throw new BadRequestException("The authenticator app is not on.");
    await this.checkAuthenticator(row, code, c);
    const recoveryCodes = generateRecoveryCodes(8);
    await this.prisma.user.update({ where: { id: row.id }, data: { recoveryCodes: recoveryCodes.map(hashRecovery) } });
    await this.record(row, "RECOVERY CODES", "Made a new set of recovery codes", c);
    return { recoveryCodes };
  }
}
