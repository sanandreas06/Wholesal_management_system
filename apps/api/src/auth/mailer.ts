import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

export interface Mail { to: string; subject: string; text: string; html: string }

/**
 * Sends email through a web service (Brevo or Resend). Free hosts such as Render block the usual mail ports, so this talks over HTTPS instead.
 * Set MAIL_PROVIDER (brevo or resend), MAIL_API_KEY and MAIL_FROM. Until then `configured` is false and the app says so instead of pretending.
 */
@Injectable()
export class MailerService {
  private readonly log = new Logger("Mailer");
  private get provider() { return (process.env.MAIL_PROVIDER || "").toLowerCase(); }
  get configured(): boolean { return (this.provider === "brevo" || this.provider === "resend") && !!process.env.MAIL_API_KEY && !!process.env.MAIL_FROM; }

  async send(m: Mail): Promise<void> {
    if (!this.configured) throw new ServiceUnavailableException("Email is not set up on this server yet.");
    const from = process.env.MAIL_FROM as string, name = process.env.MAIL_FROM_NAME || "WHOLESTRA", key = process.env.MAIL_API_KEY as string;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = this.provider === "brevo"
        ? await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", signal: ctl.signal, headers: { "api-key": key, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ sender: { name, email: from }, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text }) })
        : await fetch("https://api.resend.com/emails", { method: "POST", signal: ctl.signal, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from: `${name} <${from}>`, to: [m.to], subject: m.subject, html: m.html, text: m.text }) });
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 300);
        this.log.error(`${this.provider} refused the email (HTTP ${res.status}): ${body}`);
        throw new ServiceUnavailableException("We could not send the email just now. Please try again in a minute.");
      }
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      this.log.error(`could not reach ${this.provider}: ${(e as Error).message}`);
      throw new ServiceUnavailableException("We could not send the email just now. Please try again in a minute.");
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
