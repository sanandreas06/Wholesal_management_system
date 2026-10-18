import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

/**
 * Sends text messages (SMS) over HTTPS. Optional: when it is set up, people can choose to get their sign-in code by text.
 *  - arkesel (Ghana):  SMS_API_KEY, and a sender ID registered in the Arkesel dashboard (SMS_SENDER, default WHOLESTRA)
 *  - mnotify (Ghana):  SMS_API_KEY and SMS_SENDER
 *  - twilio (worldwide): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (a Twilio number or sender ID)
 * Numbers written the local way (0244 123 456) get the country code from SMS_COUNTRY_CODE (default 233, Ghana).
 */
@Injectable()
export class SmsService {
  private readonly log = new Logger("Sms");
  lastError: string | null = null;
  lastFailureAt: number | null = null;
  get recentlyFailed() { return !!this.lastFailureAt && Date.now() - this.lastFailureAt < 10 * 60_000; }
  get provider() { return (process.env.SMS_PROVIDER || "").toLowerCase(); }
  get sender() { return (process.env.SMS_SENDER || "WHOLESTRA").slice(0, 11); }
  get configured(): boolean {
    const e = process.env;
    if (this.provider === "arkesel" || this.provider === "mnotify") return !!e.SMS_API_KEY;
    if (this.provider === "twilio") return !!(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_FROM);
    return false;
  }

  /** "0244 123 456" or "+233 24 412 3456" → "233244123456". Null when it does not look like a mobile number. */
  normalize(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const cc = (process.env.SMS_COUNTRY_CODE || "233").replace(/\D/g, "");
    let d = raw.trim();
    const plus = d.startsWith("+") || d.startsWith("00");
    d = d.replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    else if (!plus && d.startsWith("0")) d = cc + d.slice(1);
    else if (!plus && d.length <= 10 && !d.startsWith(cc)) d = cc + d;
    return /^\d{10,15}$/.test(d) ? d : null;
  }

  private fail(why: string): never {
    this.lastError = why; this.lastFailureAt = Date.now(); this.log.error(why);
    throw new ServiceUnavailableException("We could not send the text message just now.");
  }

  async send(to: string, text: string): Promise<void> {
    if (!this.configured) throw new ServiceUnavailableException("Text messages are not set up on this server.");
    const e = process.env;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
    try {
      let res: Response; let ok: (b: Record<string, unknown> | null) => boolean = () => true;
      if (this.provider === "arkesel") {
        res = await fetch("https://sms.arkesel.com/api/v2/sms/send", { method: "POST", signal: ctl.signal, headers: { "api-key": e.SMS_API_KEY as string, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ sender: this.sender, message: text, recipients: [to] }) });
        ok = (b) => !b || !b.status || String(b.status).toLowerCase() === "success";
      } else if (this.provider === "mnotify") {
        res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(e.SMS_API_KEY as string)}`, { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ recipient: [to], sender: this.sender, message: text, is_schedule: false, schedule_date: "" }) });
        ok = (b) => !b || !b.status || String(b.status).toLowerCase() === "success";
      } else {
        const auth = Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64");
        res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(e.TWILIO_ACCOUNT_SID as string)}/Messages.json`, { method: "POST", signal: ctl.signal, headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: `+${to}`, From: e.TWILIO_FROM as string, Body: text }) });
      }
      const raw = await res.text().catch(() => "");
      let body: Record<string, unknown> | null = null; try { body = JSON.parse(raw); } catch { /* not JSON */ }
      if (!res.ok || !ok(body)) this.fail(`${this.provider} refused the text message (HTTP ${res.status}): ${raw.slice(0, 300)}`);
      this.lastError = null; this.lastFailureAt = null;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.fail(`could not reach ${this.provider}: ${(err as Error).message}`);
    } finally { clearTimeout(timer); }
  }
}
