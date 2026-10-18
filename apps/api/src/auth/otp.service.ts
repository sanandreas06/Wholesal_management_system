import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailerService, otpEmail } from "./mailer";
import { SmsService } from "./sms";
import { TicketService } from "./tickets";

/** "change:<user id>" is a code sent to a new email address someone wants to move their account to; it only works for that person. */
export type OtpPurpose = "signin" | "signup" | `change:${string}`;
const TTL_MIN = 10, MAX_TRIES = 5, PER_EMAIL = 5, PER_IP = 30;

/** Six-digit codes sent by email. Only a keyed fingerprint of each code is stored, each works once, and guessing is capped. */
@Injectable()
export class OtpService {
  private readonly log = new Logger("Otp");
  constructor(private readonly prisma: PrismaService, private readonly mailer: MailerService, private readonly tickets: TicketService, private readonly sms: SmsService) {}

  /** Codes by text message, offered as an alternative once email codes are on. */
  get smsEnabled(): boolean { return this.sms.configured || (this.devEcho && !!process.env.SMS_PROVIDER); }

  /** Email codes are on when a mail service is connected. OTP_DEV_ECHO=true shows the code on screen instead: for testing only, never on a live site. */
  get enabled(): boolean { return this.mailer.configured || this.devEcho; }
  get devEcho(): boolean { return process.env.OTP_DEV_ECHO === "true"; }

  private fingerprint(email: string, purpose: string, code: string) {
    return createHmac("sha256", this.tickets.keyFor("otp")).update(`${email}|${purpose}|${code}`).digest("hex");
  }

  /** Writes a fresh code (or, when `real` is false, a dummy row so unknown emails are rate-limited exactly like real ones). Returns the code so the caller can deliver it. */
  async issue(email: string, purpose: OtpPurpose, ip: string | undefined, real = true): Promise<string> {
    const since15 = new Date(Date.now() - 15 * 60_000), since60 = new Date(Date.now() - 60 * 60_000);
    const [byEmail, byIp] = await Promise.all([
      this.prisma.otpChallenge.count({ where: { email, createdAt: { gte: since15 } } }),
      ip ? this.prisma.otpChallenge.count({ where: { ip, createdAt: { gte: since60 } } }) : Promise.resolve(0),
    ]);
    if (byEmail >= PER_EMAIL || byIp >= PER_IP) throw new HttpException("Too many codes were requested. Please wait a few minutes and try again.", HttpStatus.TOO_MANY_REQUESTS);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (real) await this.prisma.otpChallenge.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
    await this.prisma.otpChallenge.create({ data: { email, purpose, codeHash: real ? this.fingerprint(email, purpose, code) : "-", expiresAt: new Date(Date.now() + TTL_MIN * 60_000), ip: ip ?? null, consumedAt: real ? null : new Date() } });
    return code;
  }

  /** Emails the code. With OTP_DEV_ECHO and no mail service, nothing is sent and the code is handed back to show on screen instead. */
  async deliver(email: string, purpose: OtpPurpose, code: string): Promise<{ devCode?: string }> {
    if (this.devEcho && !this.mailer.configured) { this.log.warn(`OTP_DEV_ECHO is on: the code for ${email} is shown on screen instead of being emailed. Never leave this on a live site.`); return { devCode: code }; }
    await this.mailer.send({ ...otpEmail(code, purpose, TTL_MIN), to: email });
    return {};
  }

  /** Texts the sign-in code to a phone (digits with country code). With OTP_DEV_ECHO and no SMS service, the code is shown on screen instead. */
  async deliverSms(phone: string, code: string): Promise<{ devCode?: string }> {
    if (!this.sms.configured) { this.log.warn(`OTP_DEV_ECHO is on: the text-message code is shown on screen instead of being sent.`); return { devCode: code }; }
    await this.sms.send(phone, `${code.slice(0, 3)} ${code.slice(3)} is your WHOLESTRA sign-in code. It works for ${TTL_MIN} minutes. Never share it with anyone, not even WHOLESTRA staff.`);
    return {};
  }

  /** True once, for the right code, before it expires and before too many wrong tries. */
  async check(email: string, purpose: OtpPurpose, code: string): Promise<boolean> {
    const clean = String(code).replace(/\s+/g, "");
    if (!/^\d{6}$/.test(clean)) return false;
    const row = await this.prisma.otpChallenge.findFirst({ where: { email, purpose, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (!row || row.attempts >= MAX_TRIES) return false;
    const a = Buffer.from(this.fingerprint(email, purpose, clean)), b = Buffer.from(row.codeHash);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    if (!ok) { await this.prisma.otpChallenge.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }); return false; }
    // single use: the update only succeeds for the first caller
    const won = await this.prisma.otpChallenge.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
    return won.count === 1;
  }

  assertEnabled() { if (!this.enabled) throw new BadRequestException("Email codes are not switched on for this site yet."); }
}
