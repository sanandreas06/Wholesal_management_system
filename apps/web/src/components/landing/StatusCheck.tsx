'use client';
import { useEffect, useState } from "react";
import { API_URL } from "../../lib/authApi";

type Check = { ok: boolean; detail: string; fix?: string; action?: { label: string; href: string } };
type Report = { checkedAt: string; webUrl?: string | null; checks: Record<string, Check> };
const LABELS: Record<string, string> = { server: "Server", database: "Database", email: "Email codes", addresses: "Website and server addresses", sms: "Text-message codes (optional)", google: "Google sign-in", facebook: "Facebook sign-in", linkedin: "LinkedIn sign-in" };

const OPTIONAL = ["facebook", "linkedin", "sms"];
/** What "Connect Gmail" came back with (…/status?gmail=…). */
const GMAIL: Record<string, [boolean, string]> = {
  connected: [true, "Gmail is connected. A test email has been sent to your inbox, and sign-in codes will now arrive by email."],
  "connected-not-sent": [false, "Gmail was connected, but the test email could not be sent. Press Check again in a minute; if Email codes is still red, follow its advice."],
  "wrong-account": [false, "That Google account is not the sending address (MAIL_FROM). Press Connect Gmail again and choose the right Google account."],
  "no-permission": [false, "Google did not give permission to send email. Press Connect Gmail again and leave the \"Send email on your behalf\" box ticked."],
  cancelled: [false, "Connecting Gmail was cancelled. Press Connect Gmail to try again."],
  expired: [false, "That took too long or the link was used already. Press Connect Gmail to try again."],
  failed: [false, "Google refused the request. Check that the redirect address in the Google console is exactly the one in the guide (section 2), then try again."],
};

/** Checks, from this browser, everything sign-in depends on and says in plain words what to fix. */
export default function StatusCheck() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const [n, setN] = useState(0);
  const [gmail, setGmail] = useState<string | null>(null);
  useEffect(() => { const g = new URLSearchParams(window.location.search).get("gmail"); if (g && GMAIL[g]) setGmail(g); }, []);
  useEffect(() => {
    setReport(null); setError(""); setSlow(false);
    const t = setTimeout(() => setSlow(true), 5000);
    const ctl = new AbortController(), stop = setTimeout(() => ctl.abort(), 90000);
    let token = ""; try { token = localStorage.getItem("wms_access_token") ?? ""; } catch { /* storage unavailable */ }
    fetch(`${API_URL}/status`, { signal: ctl.signal, cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (r) => { if (r.status === 401 || r.status === 403) throw new Error("denied"); if (r.status === 404) throw new Error("old"); if (!r.ok) throw new Error(String(r.status)); setReport(await r.json()); })
      .catch((e) => setError(["old", "denied"].includes((e as Error).message) ? (e as Error).message : "unreachable"))
      .finally(() => { clearTimeout(t); clearTimeout(stop); });
    return () => { clearTimeout(t); clearTimeout(stop); ctl.abort(); };
  }, [n]);

  const rows = report ? Object.entries(report.checks) : [];
  // WEB_URL must be this very website, or Google/Facebook/LinkedIn send people back to the wrong place
  const here = typeof window === "undefined" ? "" : window.location.origin;
  if (report?.webUrl && here && report.webUrl !== here && !here.includes("localhost")) {
    const i = rows.findIndex(([k]) => k === "addresses");
    const row: [string, Check] = ["addresses", { ok: false, detail: `WEB_URL on Render is ${report.webUrl}, but this website is ${here}.`, fix: `On Render change WEB_URL to ${here} (no / at the end), then Save, rebuild and deploy.` }];
    if (i >= 0) rows[i] = row; else rows.push(row);
  }
  return (
    <div className="stc">
      <p className="stc-api">This website talks to the server at <code>{API_URL}</code></p>
      {gmail && <div className={"stc-note " + (GMAIL[gmail][0] ? "ok" : "bad")} role="status">{GMAIL[gmail][1]}</div>}
      {!report && !error && <p className="stc-wait" role="status">Checking...{slow && " The server is waking up after being idle; this can take up to a minute."}</p>}
      {error === "unreachable" && <div className="stc-row bad"><b>Server</b><span>This website cannot reach the server.</span><em>Check that the Render service is running (its Events page says &quot;Deploy live&quot;), and that NEXT_PUBLIC_API_URL on Vercel is exactly the server address above ending in /api. Redeploy Vercel after changing it.</em></div>}
      {error === "denied" && <div className="stc-row bad"><b>Not allowed</b><span>Only platform owners can run these checks.</span><em>Sign in with an email listed in PLATFORM_ADMINS on Render (or the Gmail address that sends codes).</em></div>}
      {error === "old" && <div className="stc-row bad"><b>Server</b><span>The server is running an older version of WHOLESTRA.</span><em>On Render open the service and click Manual Deploy, then Deploy latest commit. Check the deploy log for a red error if it fails.</em></div>}
      {rows.map(([k, c]) => (
        <div key={k} className={"stc-row " + (c.ok ? "ok" : OPTIONAL.includes(k) ? "later" : "bad")}>
          <b><span aria-hidden="true">{c.ok ? "✓" : OPTIONAL.includes(k) ? "•" : "✕"}</span>{LABELS[k] ?? k}</b>
          <span>{c.detail}</span>
          {!c.ok && c.fix && <em>{c.fix}</em>}
          {!c.ok && c.action && <a className="lp-btn solid sm stc-act" href={c.action.href}>{c.action.label}</a>}
        </div>
      ))}
      {report && <p className="stc-summary">{rows.some(([k, c]) => !c.ok && ["server", "database", "email", "addresses"].includes(k)) ? "Fix the items marked ✕, then press Check again." : "Everything sign-in needs is working."}</p>}
      <button type="button" className="lp-btn solid" onClick={() => setN(n + 1)}>Check again</button>
    </div>
  );
}
