import { Controller, Get, Logger, NotFoundException, Query, Res } from "@nestjs/common";
import { randomBytes } from "crypto";
import { MailerService } from "./mailer";
import { TicketService } from "./tickets";

/**
 * "Connect Gmail": the owner of the sending Gmail address (MAIL_FROM) allows WHOLESTRA to send email from it, in two clicks.
 * Replaces copying a refresh token out of Google's OAuth Playground. Anyone can open the link, but the permission is only kept
 * when the Google account that approves it IS the MAIL_FROM address, so nobody else can take over the sending mailbox.
 */
type Res = { redirect(status: number, url: string): void };
const web = () => (process.env.WEB_URL || "http://localhost:3000").replace(/\/+$/, "");
const api = () => (process.env.API_PUBLIC_URL || "").replace(/\/+$/, "");
const back = (result: string) => `${web()}/status?gmail=${result}`;
const SCOPE = "openid email https://www.googleapis.com/auth/gmail.send";

@Controller("auth/gmail")
export class GmailConnectController {
  private readonly log = new Logger("GmailConnect");
  constructor(private readonly mailer: MailerService, private readonly tickets: TicketService) {}
  private get redirectUri() { return `${api()}/api/auth/gmail/callback`; }

  @Get("connect")
  async connect(@Res() res: Res) {
    if (!this.mailer.canConnectGmail) throw new NotFoundException("Connect Gmail needs MAIL_FROM, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and API_PUBLIC_URL on the server first.");
    const state = await this.tickets.sign({ typ: "oauth-state", p: "gmail", n: randomBytes(12).toString("base64url") }, 900);
    const q = new URLSearchParams({
      client_id: this.mailer.gmailClient.id, redirect_uri: this.redirectUri, response_type: "code", scope: SCOPE, state,
      access_type: "offline", prompt: "consent", login_hint: process.env.MAIL_FROM as string,
    });
    res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  }

  @Get("callback")
  async callback(@Query() q: { code?: string; state?: string; error?: string; scope?: string }, @Res() res: Res) {
    try {
      const st = await this.tickets.verify<{ typ: "oauth-state"; p: string }>(q.state ?? "", "oauth-state");
      if (st.p !== "gmail" || !this.tickets.spend(q.state as string, 900)) return res.redirect(302, back("expired"));
      if (q.error || !q.code) return res.redirect(302, back("cancelled"));
      const { id, secret } = this.mailer.gmailClient;
      const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: q.code, client_id: id, client_secret: secret, redirect_uri: this.redirectUri, grant_type: "authorization_code" }) });
      const t = (await r.json().catch(() => ({}))) as { refresh_token?: string; id_token?: string; scope?: string; error?: string; error_description?: string };
      if (!r.ok) { this.log.error(`Google refused the Gmail permission: ${t.error} ${t.error_description ?? ""}`); return res.redirect(302, back("failed")); }
      // the id_token came straight from Google over HTTPS in answer to our own request, so its contents can be read directly
      const who = JSON.parse(Buffer.from(String(t.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8") || "{}") as { email?: string; email_verified?: boolean };
      const want = String(process.env.MAIL_FROM).trim().toLowerCase();
      if (!who.email || who.email.toLowerCase() !== want || who.email_verified === false) return res.redirect(302, back("wrong-account"));
      if (!String(t.scope ?? "").includes("gmail.send")) return res.redirect(302, back("no-permission"));
      if (!t.refresh_token) return res.redirect(302, back("failed"));
      await this.mailer.saveGmail(t.refresh_token, who.email.toLowerCase());
      // a short note to the inbox proves it works end to end
      try {
        await this.mailer.send({ to: want, subject: "WHOLESTRA can now send email from this address", text: "Gmail is connected. WHOLESTRA will send sign-in codes and contact-form messages from this address.\n\nIf you did not do this, remove WHOLESTRA's access at https://myaccount.google.com/permissions", html: "<p>Gmail is connected. WHOLESTRA will send sign-in codes and contact-form messages from this address.</p><p>If you did not do this, remove WHOLESTRA's access at <a href=\"https://myaccount.google.com/permissions\">myaccount.google.com/permissions</a>.</p>" });
      } catch { return res.redirect(302, back("connected-not-sent")); }
      return res.redirect(302, back("connected"));
    } catch (e) {
      this.log.error(`Connect Gmail did not finish: ${(e as Error).message}`);
      return res.redirect(302, back("expired"));
    }
  }
}
