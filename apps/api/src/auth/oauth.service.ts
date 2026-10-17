import { Injectable, Logger } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes, timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { OnboardingService } from "./onboarding.service";
import { TicketService } from "./tickets";

export type Provider = "google" | "facebook" | "linkedin";
export const PROVIDERS: Provider[] = ["google", "facebook", "linkedin"];

const CFG: Record<Provider, { id: string; secret: string; auth: string; token: string; info: string; scope: string; label: string }> = {
  google: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET", label: "Google", scope: "openid email profile", auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", info: "https://openidconnect.googleapis.com/v1/userinfo" },
  facebook: { id: "FACEBOOK_APP_ID", secret: "FACEBOOK_APP_SECRET", label: "Facebook", scope: "email,public_profile", auth: "https://www.facebook.com/v19.0/dialog/oauth", token: "https://graph.facebook.com/v19.0/oauth/access_token", info: "https://graph.facebook.com/me?fields=id,name,email" },
  linkedin: { id: "LINKEDIN_CLIENT_ID", secret: "LINKEDIN_CLIENT_SECRET", label: "LinkedIn", scope: "openid profile email", auth: "https://www.linkedin.com/oauth/v2/authorization", token: "https://www.linkedin.com/oauth/v2/accessToken", info: "https://api.linkedin.com/v2/userinfo" },
};

export const isProvider = (p: string): p is Provider => (PROVIDERS as string[]).includes(p);
const webBase = () => (process.env.WEB_URL || "http://localhost:3000").replace(/\/+$/, "");

interface Profile { id: string; email: string; name: string; emailVerified: boolean }

async function http(url: string, init: RequestInit = {}): Promise<unknown> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    const body = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return body;
  } finally { clearTimeout(timer); }
}

/** Sign-in and sign-up with Google, Facebook or LinkedIn. A provider is "available" only when its keys are set on the server. */
@Injectable()
export class OAuthService {
  private readonly log = new Logger("OAuth");
  constructor(private readonly prisma: PrismaService, private readonly tickets: TicketService, private readonly onboarding: OnboardingService) {}

  available(): Record<Provider, boolean> {
    return Object.fromEntries(PROVIDERS.map((p) => [p, !!process.env[CFG[p].id] && !!process.env[CFG[p].secret]])) as Record<Provider, boolean>;
  }

  /** Where the person is sent to approve the sign-in, plus the cookie that ties the answer to this browser. */
  async begin(provider: Provider, redirectUri: string, opts: { mode?: string; ref?: string }) {
    const c = CFG[provider];
    const nonce = randomBytes(18).toString("base64url");
    const state = await this.tickets.sign({ typ: "oauth-state", p: provider, n: nonce, mode: opts.mode === "signup" ? "signup" : "signin", ref: (opts.ref ?? "").slice(0, 20) }, 600);
    const q = new URLSearchParams({ client_id: process.env[c.id] as string, redirect_uri: redirectUri, response_type: "code", scope: c.scope, state });
    if (provider === "google") q.set("prompt", "select_account");
    return { url: `${c.auth}?${q}`, nonce };
  }

  private fail(mode: string | undefined, code: string) { return `${webBase()}/${mode === "signup" ? "get-started" : "login"}?error=${code}`; }

  /** Handles the provider's answer. Always ends in a redirect back to the website, with either a one-time ticket or an error code. */
  async finish(provider: Provider, q: { code?: string; state?: string; error?: string }, cookieNonce: string | undefined, redirectUri: string): Promise<string> {
    let mode: string | undefined;
    try {
      const st = await this.tickets.verify<{ typ: "oauth-state"; p: string; n: string; mode: string; ref: string }>(q.state ?? "", "oauth-state");
      mode = st.mode;
      if (st.p !== provider) return this.fail(mode, "state");
      const a = Buffer.from(st.n), b = Buffer.from(cookieNonce ?? "");
      if (a.length !== b.length || !timingSafeEqual(a, b)) return this.fail(mode, "state");
      if (q.error || !q.code) return this.fail(mode, q.error === "access_denied" ? "cancelled" : "failed");

      const profile = await this.exchange(provider, q.code, redirectUri);
      if (!profile.email) return this.fail(mode, "no-email");
      if (!profile.emailVerified) return this.fail(mode, "email-unverified");
      const email = profile.email.trim().toLowerCase();

      let isNew = false;
      const identity = await this.prisma.authIdentity.findUnique({ where: { provider_providerUserId: { provider, providerUserId: profile.id } }, include: { user: { include: { organization: { select: { isDemo: true } } } } } });
      let user = identity?.user ?? null;
      if (!user) {
        const existing = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: { organization: { select: { isDemo: true } } } });
        if (existing) user = existing;
        else {
          const name = (profile.name || email.split("@")[0]).trim().replace(/\s+/g, " ");
          const made = await this.onboarding.createCompany({ companyName: `${name.split(" ")[0]}'s company`, email, name, passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 8), passwordSet: false, referralCode: st.ref, via: CFG[provider].label });
          user = await this.prisma.user.findUniqueOrThrow({ where: { id: made.userId }, include: { organization: { select: { isDemo: true } } } });
          isNew = true;
        }
        await this.prisma.authIdentity.create({ data: { userId: user.id, provider, providerUserId: profile.id, email } });
        if (!user.emailVerifiedAt) await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
      }
      if (user.status !== "ACTIVE" || user.organization.isDemo) return this.fail(mode, "blocked");
      const hasAuthenticator = !!user.totpEnabledAt;
      const ticket = hasAuthenticator
        ? await this.tickets.sign({ typ: "mfa", uid: user.id, next: "session" }, 300)
        : await this.tickets.sign({ typ: "oauth", uid: user.id, provider, isNew }, 120);
      return `${webBase()}/auth/complete#kind=${hasAuthenticator ? "mfa" : "oauth"}&ticket=${ticket}${isNew ? "&new=1" : ""}`;
    } catch (e) {
      this.log.warn(`${provider} sign-in failed: ${(e as Error).message}`);
      return this.fail(mode, "failed");
    }
  }

  private async exchange(provider: Provider, code: string, redirectUri: string): Promise<Profile> {
    const c = CFG[provider], id = process.env[c.id] as string, secret = process.env[c.secret] as string;
    if (provider === "facebook") {
      const t = (await http(`${c.token}?${new URLSearchParams({ client_id: id, client_secret: secret, redirect_uri: redirectUri, code })}`)) as { access_token?: string };
      if (!t?.access_token) throw new Error("no access token");
      const u = (await http(`${c.info}&access_token=${encodeURIComponent(t.access_token)}`)) as { id?: string; name?: string; email?: string };
      return { id: String(u.id ?? ""), name: u.name ?? "", email: u.email ?? "", emailVerified: !!u.email };
    }
    const t = (await http(c.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: id, client_secret: secret }) })) as { access_token?: string };
    if (!t?.access_token) throw new Error("no access token");
    const u = (await http(c.info, { headers: { authorization: `Bearer ${t.access_token}` } })) as { sub?: string; name?: string; email?: string; email_verified?: boolean | string };
    return { id: String(u.sub ?? ""), name: u.name ?? "", email: u.email ?? "", emailVerified: u.email_verified === true || u.email_verified === "true" };
  }
}
