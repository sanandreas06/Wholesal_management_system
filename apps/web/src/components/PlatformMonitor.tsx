'use client';
import { useCallback, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { reportError } from "../lib/report";

type Hour = { start: string; state: "up" | "partial" | "down" | "none" | "now" | "future"; checks: number; avgMs: number | null };
type Err = { id: string; source: "web" | "api"; message: string; stack: string | null; path: string | null; method: string | null; status: number | null; release: string | null;
  userAgent: string | null; lastOrg: string | null; count: number; firstSeen: string; lastSeen: string; resolvedAt: string | null };
type Summary = { now: string; watcherConfigured: boolean; alertsTo: number; mailReady: boolean; lastCheck: { at: string; ms: number | null; webOk: boolean | null; webMs: number | null } | null;
  starts: string[]; uptime24h: number | null; uptime7d: number | null; hours: Hour[]; openErrors: number; errors: Err[] };

function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
const STATE_LABEL: Record<Hour["state"], string> = { up: "Up", partial: "API up, website did not answer", down: "No answer", none: "Not checked yet", now: "This hour", future: "Later today" };

/** For the people who run WHOLESTRA: is the system up, and what is breaking. Refreshes every 15 seconds. */
export default function PlatformMonitor() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"open" | "fixed">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [tick, setTick] = useState(Date.now());

  const load = useCallback(async () => {
    try { setData(await api.get<Summary>("/monitor/summary")); setError(""); setTick(Date.now()); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not load the monitor."); }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function resolve(id: string, fixed: boolean) {
    setBusy(id);
    try { await api.post(`/monitor/errors/${id}/resolve`, { fixed }); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : "Could not update."); }
    finally { setBusy(""); }
  }
  async function testApi() {
    setBusy("t-api");
    await api.post("/monitor/test-error").catch(() => undefined);
    setTimeout(() => { load(); setBusy(""); }, 1500);
  }
  function testWeb() {
    setBusy("t-web");
    reportError(new Error(`Test error from the website (${new Date().toISOString().slice(0, 16)})`), "/platform/monitor");
    setTimeout(() => { load(); setBusy(""); }, 2000);
  }

  const last = data?.lastCheck;
  const lastAge = last ? (tick - new Date(last.at).getTime()) / 60000 : null;
  const apiState = !data ? "…" : !last ? "unknown" : lastAge! <= 20 ? "up" : "down";
  const list = (data?.errors ?? []).filter(e => (tab === "open" ? !e.resolvedAt : !!e.resolvedAt));
  const days = data ? Array.from({ length: 7 }, (_, d) => data.hours.slice(d * 24, d * 24 + 24)) : [];

  return (
    <AppShell title="Platform monitor">
      <div className="dash-head">
        <div>
          <h1>Platform monitor</h1>
          <p>Errors and uptime across all of WHOLESTRA. Only you and the other platform owners can see this page. Setup checks for email and sign-in are on <a href="/status">System checks</a>.</p>
        </div>
        <span className="mon-live" title="Refreshes every 15 seconds"><i />Live · updated {data ? ago(new Date(tick).toISOString()) : "…"}</span>
      </div>
      {error && <div className="error">{error}</div>}

      {data && (!data.watcherConfigured || !data.alertsTo || !data.mailReady) && (
        <div className="mon-setup" role="status">
          <strong>Finish setting up</strong>
          <ul>
            {!data.watcherConfigured && <li><b>Uptime checks are off.</b> Add <code>MONITOR_KEY</code> on Render and the same value as a GitHub secret, as described in the setup guide.</li>}
            {!data.alertsTo && <li><b>No one gets alert emails.</b> Add <code>PLATFORM_ADMINS</code> on Render with your email.</li>}
            {!data.mailReady && <li><b>Email is not connected,</b> so alerts cannot be sent. Connect Gmail on the <a href="/status">System checks</a> page.</li>}
          </ul>
        </div>
      )}

      <section className="mon-tiles">
        <div className={`mon-tile ${apiState}`}>
          <span className="mon-k">API</span>
          <strong>{apiState === "up" ? "Up" : apiState === "down" ? "No answer" : apiState === "unknown" ? "Not checked yet" : "…"}</strong>
          <small>{last ? `Last check ${ago(last.at, tick)}${last.ms != null ? `, answered in ${last.ms} ms` : ""}` : "Waiting for the first check"}</small>
        </div>
        <div className={`mon-tile ${!last ? "unknown" : last.webOk === false ? "down" : "up"}`}>
          <span className="mon-k">Website</span>
          <strong>{!last ? "Not checked yet" : last.webOk === false ? "No answer" : "Up"}</strong>
          <small>{last?.webMs != null ? `Answered in ${last.webMs} ms` : "Checked together with the API"}</small>
        </div>
        <div className={`mon-tile ${data && data.openErrors > 0 ? "warn" : "up"}`}>
          <span className="mon-k">Open errors</span>
          <strong>{data ? data.openErrors : "…"}</strong>
          <small>{data?.errors[0] ? `Latest ${ago(data.errors[0].lastSeen, tick)}` : "Nothing recorded"}</small>
        </div>
        <div className="mon-tile">
          <span className="mon-k">Uptime</span>
          <strong>{data?.uptime7d != null ? `${data.uptime7d}%` : "—"}</strong>
          <small>Last 7 days · last 24 h {data?.uptime24h != null ? `${data.uptime24h}%` : "—"}</small>
        </div>
      </section>

      <section className="card2 mon-up">
        <div className="mon-h"><h2>Uptime, hour by hour</h2><span>Each square is one hour (Ghana time). The API is checked every 5 minutes from outside.</span></div>
        <div className="mon-grid-wrap">
          <div className="mon-grid" role="img" aria-label="Uptime for the last 7 days">
            <div className="mon-row mon-hours" aria-hidden="true"><span />{Array.from({ length: 24 }, (_, h) => <b key={h}>{h % 6 === 0 ? `${String(h).padStart(2, "0")}:00` : ""}</b>)}</div>
            {days.map((row, d) => (
              <div key={d} className="mon-row">
                <span className="mon-day">{d === 6 ? "Today" : new Date(row[0].start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" })}</span>
                {row.map(h => <i key={h.start} className={`mon-cell ${h.state}`} title={`${new Date(h.start).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} GMT: ${STATE_LABEL[h.state]}${h.checks ? ` (${h.checks} checks${h.avgMs ? `, ${h.avgMs} ms` : ""})` : ""}`} />)}
              </div>
            ))}
          </div>
        </div>
        <div className="mon-legend"><span><i className="mon-cell up" />Up</span><span><i className="mon-cell partial" />Website did not answer</span><span><i className="mon-cell down" />No answer</span><span><i className="mon-cell none" />Not checked yet</span></div>
        {data && data.starts.length > 0 && <p className="mon-starts">API started {data.starts.length === 10 ? "10+ times" : `${data.starts.length} time${data.starts.length === 1 ? "" : "s"}`} this week (a new deploy, a restart, or waking up). Last: {ago(data.starts[0], tick)}.</p>}
      </section>

      <section className="card2">
        <div className="mon-h">
          <h2>Errors</h2>
          <div className="mon-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "open"} className={tab === "open" ? "on" : ""} onClick={() => setTab("open")}>Open ({data?.errors.filter(e => !e.resolvedAt).length ?? 0})</button>
            <button type="button" role="tab" aria-selected={tab === "fixed"} className={tab === "fixed" ? "on" : ""} onClick={() => setTab("fixed")}>Fixed ({data?.errors.filter(e => !!e.resolvedAt).length ?? 0})</button>
          </div>
        </div>
        {data && list.length === 0 && <div className="empty">{tab === "open" ? "No open errors. When something breaks for a customer, it shows here within seconds." : "Nothing marked fixed yet."}</div>}
        <ul className="mon-list">
          {list.map(e => (
            <li key={e.id} className="mon-err">
              <div className="mon-err-top">
                <span className={`mon-src ${e.source}`}>{e.source === "web" ? "Website" : "API"}</span>
                <strong className="mon-msg">{e.message}</strong>
              </div>
              <div className="mon-meta">
                <span><b>{e.count}</b> time{e.count === 1 ? "" : "s"}</span>
                <span>last {ago(e.lastSeen, tick)}</span>
                <span>first {ago(e.firstSeen, tick)}</span>
                {e.path && <span className="mon-path">{e.method ? `${e.method} ` : ""}{e.path}</span>}
                {e.lastOrg && <span>{e.lastOrg}</span>}
                {e.release && <span>deploy {e.release}</span>}
              </div>
              <div className="mon-acts">
                <button type="button" className="secondary" onClick={() => setOpenId(openId === e.id ? null : e.id)}>{openId === e.id ? "Hide details" : "Details"}</button>
                <button type="button" className="secondary" disabled={busy === e.id} onClick={() => resolve(e.id, !e.resolvedAt)}>{e.resolvedAt ? "Reopen" : "Mark fixed"}</button>
              </div>
              {openId === e.id && <div className="mon-detail">
                {e.stack ? <pre>{e.stack}</pre> : <p>No stack trace was sent with this error.</p>}
                {e.userAgent && <p className="mon-ua">{e.userAgent}</p>}
              </div>}
            </li>
          ))}
        </ul>
        <div className="mon-test">
          <span>Check that tracking works:</span>
          <button type="button" className="secondary" disabled={!!busy} onClick={testApi}>Send a test API error</button>
          <button type="button" className="secondary" disabled={!!busy} onClick={testWeb}>Send a test website error</button>
        </div>
      </section>
    </AppShell>
  );
}
