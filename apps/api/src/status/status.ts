import { Controller, Get, Injectable, Module } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { MailerService } from "../auth/mailer";

type Check = { ok: boolean; detail: string; fix?: string };

/** A plain-language health check of everything sign-in depends on, for the /status page. Shows only yes/no facts, never keys or addresses. */
@Injectable()
export class StatusService {
  constructor(private readonly prisma: PrismaService, private readonly mailer: MailerService) {}

  async report() {
    const env = process.env;
    const checks: Record<string, Check> = {};
    checks.server = { ok: true, detail: "The WHOLESTRA server is running." };

    try {
      await Promise.all([this.prisma.otpChallenge.count({ where: { id: "-" } }), this.prisma.demoVisit.count({ where: { id: "-" } }), this.prisma.inquiry.count({ where: { id: "-" } }), this.prisma.user.count({ where: { totpLastStep: -1 } })]);
      checks.database = { ok: true, detail: "The database is reachable and up to date." };
    } catch (e) {
      const old = e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022");
      checks.database = old
        ? { ok: false, detail: "The database is older than the code, so sign-in and sign-up fail.", fix: "On your computer run pnpm db:push with DATABASE_URL set to your Neon connection string." }
        : { ok: false, detail: "The server cannot reach the database.", fix: "Check DATABASE_URL on Render and that the Neon database is not paused." };
    }

    const provider = (env.MAIL_PROVIDER || "").toLowerCase();
    const echo = env.OTP_DEV_ECHO === "true";
    const keys = this.mailer.configured ? await this.mailer.verify() : null;
    if (keys && !keys.ok) {
      checks.email = { ok: false, detail: `Email is set up (${provider}) but ${keys.reason}, so sign-in codes cannot be sent.`, fix: provider === "gmail" ? "Make a new refresh token in the OAuth Playground (section 2, steps 5 to 7 of the guide) with your own client ID and secret ticked, and paste it into GMAIL_REFRESH_TOKEN on Render." : "Check the key on Render against the provider's dashboard." };
    } else if (this.mailer.configured) {
      checks.email = this.mailer.recentlyFailed
        ? { ok: false, detail: `Email is set up (${provider}) but the last email failed to send, so sign-in codes are not arriving.`, fix: "Run the mail test in docs/deployment/sign-in-setup.md (section 2, step 9) to see the exact reason." }
        : { ok: true, detail: `Email codes are on and sent with ${provider}.` };
    } else if (echo) {
      checks.email = { ok: false, detail: "Test mode: codes are shown on screen instead of being emailed.", fix: "Set up Gmail (section 2 of the guide), then remove OTP_DEV_ECHO on Render." };
    } else {
      const missing = provider === "gmail" ? ["MAIL_FROM", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"].filter((k) => !env[k])
        : provider ? ["MAIL_FROM", "MAIL_API_KEY"].filter((k) => !env[k]) : ["MAIL_PROVIDER"];
      checks.email = { ok: false, detail: "Email is not set up, so sign-in is email and password only and sign-up by email is off.", fix: `On Render add: ${missing.join(", ")}.` };
    }

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
