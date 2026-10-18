import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TicketService } from "./tickets";
import { decryptSecret, encryptSecret } from "./totp";

export interface Mail { to: string; subject: string; text: string; html: string; replyTo?: string }

/**
 * Sends email through a web service over HTTPS (free hosts such as Render block the usual mail ports):
 *  - gmail:  straight from your own Gmail address through the Gmail API. The Google keys (GOOGLE_CLIENT_ID/SECRET, the same ones that
 *            switch on "Continue with Google", or separate GMAIL_CLIENT_ID/SECRET) plus a permission to send, which the owner gives once
 *            with the "Connect Gmail" button on the System status page (kept encrypted in the database), or GMAIL_REFRESH_TOKEN.
 *            MAIL_FROM is that Gmail address.
 *  - brevo or resend: MAIL_API_KEY and MAIL_FROM.
 * Until one is set up, `configured` is false and the app says so instead of pretending.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly log = new Logger("Mailer");
  constructor(private readonly prisma: PrismaService, private readonly tickets: TicketService) {}
  /** the Gmail permission saved with "Connect Gmail" (decrypted, in memory only) */
  private connected: { refresh: string; email: string } | null = null;

  async onModuleInit() { await this.loadConnected(); }
  private async loadConnected() {
    try {
      const row = await this.prisma.platformSetting.findUnique({ where: { key: "gmail" } });
      this.connected = row ? JSON.parse(decryptSecret(row.value, this.tickets.keyFor("platform"))) : null;
    } catch (e) { this.connected = null; if (!/does not exist/i.test(String((e as Error).message))) this.log.warn(`could not read the connected Gmail account: ${(e as Error).message}`); }
  }
  /** The Google keys for sending: separate Gmail keys if given, otherwise the same keys as "Continue with Google". */
  get gmailClient() { const e = process.env; return { id: e.GMAIL_CLIENT_ID || e.GOOGLE_CLIENT_ID || "", secret: e.GMAIL_CLIENT_SECRET || e.GOOGLE_CLIENT_SECRET || "" }; }
  private get gmailRefresh() { return process.env.GMAIL_REFRESH_TOKEN || this.connected?.refresh || ""; }
  get gmailConnectedAs() { return this.connected?.email ?? null; }
  /** "Connect Gmail" can be used: Gmail is the chosen way, and the keys and sender address are there. */
  get canConnectGmail() { return this.provider === "gmail" && !!(process.env.MAIL_FROM && this.gmailClient.id && this.gmailClient.secret && process.env.API_PUBLIC_URL); }
  /** Saves the permission given with "Connect Gmail". */
  async saveGmail(refresh: string, email: string) {
    const value = encryptSecret(JSON.stringify({ refresh, email }), this.tickets.keyFor("platform"));
    await this.prisma.platformSetting.upsert({ where: { key: "gmail" }, update: { value }, create: { key: "gmail", value } });
    this.connected = { refresh, email }; this.gmailToken = null; this.verified = null; this.lastError = null; this.lastFailureAt = null;
  }
  /** the last thing that went wrong, shown on the staff test endpoint so a broken setting is easy to find */
  lastError: string | null = null;
  /** when sending last failed (cleared by the next success) */
  lastFailureAt: number | null = null;
  get recentlyFailed() { return !!this.lastFailureAt && Date.now() - this.lastFailureAt < 10 * 60_000; }
  private gmailToken: { value: string; until: number } | null = null;
  /** gmail, brevo or resend. Gmail is assumed when nothing is chosen but a Gmail account has been connected. */
  get provider() { return (process.env.MAIL_PROVIDER || (this.connected ? "gmail" : "")).toLowerCase(); }
  get configured(): boolean {
    if (!process.env.MAIL_FROM) return false;
    if (this.provider === "gmail") return !!(this.gmailClient.id && this.gmailClient.secret && this.gmailRefresh);
    return (this.provider === "brevo" || this.provider === "resend") && !!process.env.MAIL_API_KEY;
  }

  private fail(why: string): never {
    this.lastError = why;
    this.lastFailureAt = Date.now();
    this.log.error(why);
    throw new ServiceUnavailableException("We could not send the email just now. Please try again in a minute.");
  }

  /** A short-lived Gmail access token, made from the long-lived refresh token. */
  private async gmailAccess(signal: AbortSignal) {
    if (this.gmailToken && this.gmailToken.until > Date.now() + 60_000) return this.gmailToken.value;
    const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal, headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.gmailClient.id, client_secret: this.gmailClient.secret, refresh_token: this.gmailRefresh, grant_type: "refresh_token" }) });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!res.ok || !data.access_token) this.fail(`Google refused the Gmail sign-in (${data.error ?? res.status}: ${data.error_description ?? "no details"}). Press "Connect Gmail" on the System status page again, or check the Google keys on Render.`);
    this.gmailToken = { value: data.access_token as string, until: Date.now() + (data.expires_in ?? 3000) * 1000 };
    return this.gmailToken.value;
  }

  /** The message in the plain email format Gmail expects (text and HTML versions). */
  private mime(m: Mail, from: string, name: string) {
    const b64 = (t: string) => Buffer.from(t, "utf8").toString("base64");
    const boundary = `wms${Date.now().toString(36)}`;
    const head = [
      `From: =?UTF-8?B?${b64(name)}?= <${from}>`, `To: ${m.to}`, `Subject: =?UTF-8?B?${b64(m.subject)}?=`, ...(m.replyTo ? [`Reply-To: ${m.replyTo}`] : []),
      "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
    const part = (type: string, body: string) => [`--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", b64(body).replace(/.{76}/g, "$&\r\n")].join("\r\n");
    return Buffer.from([...head, "", part("text/plain", m.text), part("text/html", m.html), `--${boundary}--`, ""].join("\r\n")).toString("base64url");
  }

  /** Checks the email keys without sending anything (Gmail: can a sign-in token be made; Brevo: is the key accepted). Remembered for 5 minutes. */
  private verified: { at: number; ok: boolean; reason: string } | null = null;
  async verify(): Promise<{ ok: boolean; reason: string }> {
    if (!this.configured) return { ok: false, reason: "not set up" };
    if (this.verified && Date.now() - this.verified.at < 5 * 60_000) return this.verified;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
    let out: { ok: boolean; reason: string };
    try {
      if (this.provider === "gmail") {
        const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: this.gmailClient.id, client_secret: this.gmailClient.secret, refresh_token: this.gmailRefresh, grant_type: "refresh_token" }) });
        const data = (await res.json().catch(() => ({}))) as { access_token?: string; scope?: string; error?: string };
        out = res.ok && data.access_token
          ? (data.scope && !data.scope.includes("gmail.send") ? { ok: false, reason: "the Gmail permission does not include sending email" } : { ok: true, reason: "Google accepted the Gmail key" })
          : { ok: false, reason: data.error === "invalid_grant" ? "Google no longer accepts the Gmail permission (it expired, was removed, or was given to different Google keys)" : data.error === "invalid_client" ? "Google rejected the Google client ID or secret" : `Google said: ${data.error ?? res.status}` };
      } else if (this.provider === "brevo") {
        const res = await fetch("https://api.brevo.com/v3/account", { signal: ctl.signal, headers: { "api-key": process.env.MAIL_API_KEY as string, accept: "application/json" } });
        out = res.ok ? { ok: true, reason: "Brevo accepted the API key" } : { ok: false, reason: `Brevo rejected MAIL_API_KEY (HTTP ${res.status})` };
      } else out = { ok: true, reason: "not checked for this provider" };
    } catch (e) { out = { ok: false, reason: `could not reach ${this.provider}: ${(e as Error).message}` }; }
    finally { clearTimeout(timer); }
    this.verified = { at: Date.now(), ...out };
    return out;
  }

  async send(m: Mail): Promise<void> {
    if (!this.configured) throw new ServiceUnavailableException("Email is not set up on this server yet.");
    const from = process.env.MAIL_FROM as string, name = process.env.MAIL_FROM_NAME || "WHOLESTRA", key = process.env.MAIL_API_KEY as string;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
    try {
      let res: Response;
      if (this.provider === "gmail") {
        const token = await this.gmailAccess(ctl.signal);
        res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", signal: ctl.signal, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ raw: this.mime(m, from, name) }) });
      } else if (this.provider === "brevo") {
        res = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", signal: ctl.signal, headers: { "api-key": key, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ sender: { name, email: from }, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text, ...(m.replyTo ? { replyTo: { email: m.replyTo } } : {}) }) });
      } else {
        res = await fetch("https://api.resend.com/emails", { method: "POST", signal: ctl.signal, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from: `${name} <${from}>`, to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }) });
      }
      if (!res.ok) this.fail(`${this.provider} refused the email (HTTP ${res.status}): ${(await res.text().catch(() => "")).slice(0, 400)}`);
      this.lastError = null;
      this.lastFailureAt = null;
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      this.fail(`could not reach ${this.provider}: ${(e as Error).message}`);
    } finally { clearTimeout(timer); }
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function otpEmail(code: string, purpose: string, minutes: number): Mail & { to?: string } {
  const what = purpose === "signup" ? "confirm your email and finish creating your WHOLESTRA account" : purpose.startsWith("change:") ? "confirm this as the new email address of your WHOLESTRA account" : "sign in to WHOLESTRA";
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    to: "",
    subject: `${spaced} is your WHOLESTRA code`,
    text: `Your WHOLESTRA code is ${code}.\n\nUse it to ${what}. It works once and expires in ${minutes} minutes.\n\nIf you did not ask for this, you can ignore this email. Nobody can sign in without this code and your password.\n\nWHOLESTRA`,
    html: `<!doctype html><html><body style="margin:0;background:#F3F6FB;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1A2332">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;border:1px solid #E2E7F0">
<tr><td style="padding:26px 30px 0;font:800 20px Segoe UI,Arial,sans-serif;letter-spacing:.04em;color:#0B1B3E">WHOLESTRA</td></tr>
<tr><td style="padding:14px 30px 0;font-size:15px;line-height:1.55">Use this code to ${esc(what)}.</td></tr>
<tr><td align="center" style="padding:20px 30px"><div style="display:inline-block;background:#EAF1FF;border:1px solid #C9DBFF;border-radius:12px;padding:14px 26px;font:800 34px/1 Consolas,Menlo,monospace;letter-spacing:.28em;color:#0B1B3E">${esc(code)}</div></td></tr>
<tr><td style="padding:0 30px 26px;font-size:13px;line-height:1.6;color:#55627F">It works once and expires in ${minutes} minutes.<br>If you did not ask for it, ignore this email. Nobody can sign in without this code and your password.</td></tr>
</table></td></tr></table></body></html>`,
  };
}
