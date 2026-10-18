import { Controller, Get, Injectable, Module } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { MailerService } from "../auth/mailer";
import { SmsService } from "../auth/sms";

type Check = { ok: boolean; detail: string; fix?: string; action?: { label: string; href: string } };

/** A plain-language health check of everything sign-in depends on, for the /status page. Shows only yes/no facts, never keys or addresses. */
@Injectable()
export class StatusService {
  constructor(private readonly prisma: PrismaService, private readonly mailer: MailerService, private readonly sms: SmsService) {}

  async report() {
    const env = process.env;
    const checks: Record<string, Check> = {};
    checks.server = { ok: true, detail: "The WHOLESTRA server is running." };

    try {
      await Promise.all([this.prisma.otpChallenge.count({ where: { id: "-" } }), this.prisma.demoVisit.count({ where: { id: "-" } }), this.prisma.inquiry.count({ where: { id: "-" } }), this.prisma.user.count({ where: { totpLastStep: -1 } }), this.prisma.platformSetting.count({ where: { key: "-" } })]);
      checks.database = { ok: true, detail: "The database is reachable and up to date." };
    } catch (e) {
      const old = e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022");
      checks.database = old
        ? { ok: false, detail: "The database is older than the code, so sign-in and sign-up fail.", fix: "On your computer run pnpm db:push with DATABASE_URL set to your Neon connection string." }
        : { ok: false, detail: "The server cannot reach the database.", fix: "Check DATABASE_URL on Render and that the Neon database is not paused." };
    }

    const provider = this.mailer.provider;
    const echo = env.OTP_DEV_ECHO === "true";
    const api = (env.API_PUBLIC_URL || "").replace(/\/+$/, "");
    const connect = { label: "Connect Gmail", href: `${api}/api/auth/gmail/connect` };
    const keys = this.mailer.configured ? await this.mailer.verify() : null;
    if (keys && !keys.ok) {
      checks.email = provider === "gmail"
        ? { ok: false, detail: `Email is set up with Gmail but ${keys.reason}, so sign-in codes cannot be sent.`, fix: this.mailer.canConnectGmail ? `Press Connect Gmail and approve it with ${env.MAIL_FROM}. If this keeps happening after about a week, publish the Google consent screen ("In production", section 2 of the guide).` : "Check the Google client ID and secret on Render.", ...(this.mailer.canConnectGmail ? { action: connect } : {}) }
        : { ok: false, detail: `Email is set up (${provider}) but ${keys.reason}, so sign-in codes cannot be sent.`, fix: "Check the key on Render against the provider's dashboard." };
    } else if (this.mailer.configured) {
      const as = this.mailer.gmailConnectedAs;
      checks.email = this.mailer.recentlyFailed
        ? { ok: false, detail: `Email is set up (${provider}) but the last email failed to send, so sign-in codes are not arriving.`, fix: provider === "gmail" && this.mailer.canConnectGmail ? "Press Connect Gmail to give the permission again." : "Run the mail test in docs/deployment/sign-in-setup.md (section 2) to see the exact reason.", ...(provider === "gmail" && this.mailer.canConnectGmail ? { action: connect } : {}) }
        : { ok: true, detail: `Email codes are on and sent with ${provider === "gmail" ? `Gmail${as ? ` (${as})` : ""}` : provider}.` };
    } else if (provider === "gmail" || (!provider && !env.MAIL_API_KEY)) {
      const g = this.mailer.gmailClient;
      const missing = [!env.MAIL_FROM && "MAIL_FROM (your Gmail address)", !provider && "MAIL_PROVIDER=gmail", !g.id && "GOOGLE_CLIENT_ID", !g.secret && "GOOGLE_CLIENT_SECRET", !api && "API_PUBLIC_URL"].filter(Boolean);
      checks.email = missing.length
        ? { ok: false, detail: `${echo ? "Test mode: codes are shown on screen instead of being emailed." : "Email is not set up yet, so sign-in is email and password only and sign-up by email is off."}`, fix: `On Render add ${missing.join(", ")}, then come back here and press Connect Gmail. The same Google keys also switch on "Continue with Google".` }
        : { ok: false, detail: "Almost there: Gmail is not connected yet.", fix: `Press Connect Gmail and approve it while signed in to Google as ${env.MAIL_FROM}. A test email arrives in that inbox when it works.`, action: connect };
    } else {
      checks.email = { ok: false, detail: "Email is not set up, so sign-in is email and password only and sign-up by email is off.", fix: `On Render add: ${["MAIL_FROM", "MAIL_API_KEY"].filter((k) => !env[k]).join(", ")}.` };
    }

    // text messages are optional: another way to get the sign-in code
    checks.sms = this.sms.configured
      ? (this.sms.recentlyFailed ? { ok: false, detail: `Text-message codes are on (${this.sms.provider}) but the last text failed: ${this.sms.lastError ?? "no details"}.`, fix: "Check the SMS key, your credit and that the sender ID is approved in the provider's dashboard." } : { ok: true, detail: `Text-message codes are on (${this.sms.provider}, sender ${this.sms.sender}).` })
      : { ok: false, detail: "Text-message codes are not switched on yet (optional).", fix: "On Render add SMS_PROVIDER=arkesel and SMS_API_KEY (section 14 of the guide)." };

    const urls = { web: !!env.WEB_URL, api: !!env.API_PUBLIC_URL };
    checks.addresses = urls.web && urls.api ? { ok: true, detail: "WEB_URL and API_PUBLIC_URL are set." }
      : { ok: false, detail: "Google, Facebook and LinkedIn sign-in need the website and server addresses.", fix: `On Render add: ${[!urls.web && "WEB_URL", !urls.api && "API_PUBLIC_URL"].filter(Boolean).join(", ")}.` };
    const social = (name: string, id: string, secret: string): Check => env[id] && env[secret]
      ? { ok: true, detail: `${name} sign-in is switched on.` }
      : { ok: false, detail: `${name} sign-in is not switched on yet.`, fix: `On Render add ${[!env[id] && id, !env[secret] && secret].filter(Boolean).join(" and ")}.` };
    checks.google = social("Google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
    checks.facebook = social("Facebook", "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET");
    checks.linkedin = social("LinkedIn", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET");
    return { checkedAt: new Date().toISOString(), webUrl: (env.WEB_URL || "").replace(/\/+$/, "") || null, checks };
  }
}

@Controller("status")
export class StatusController {
  constructor(private readonly svc: StatusService) {}
  @Get() status() { return this.svc.report(); }
}

@Module({ imports: [AuthModule], controllers: [StatusController], providers: [StatusService] })
export class StatusModule {}
