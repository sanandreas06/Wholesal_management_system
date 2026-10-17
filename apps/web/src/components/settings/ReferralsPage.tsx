'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { api } from "../../lib/api";

type Mine = { demo: boolean; code: string | null; maxUsd: number; referrals: { id: string; company: string; status: "REGISTERED" | "CONFIRMED" | "PAID" | "REJECTED"; rewardUsd: number; at: string }[]; totals: { registered: number; confirmed: number; earnedUsd: number; paidUsd: number } };
const STATUS: Record<string, [string, string]> = { REGISTERED: ["Signed up", "warn"], CONFIRMED: ["Confirmed", "ok"], PAID: ["Paid", "ok"], REJECTED: ["Not eligible", "bad"] };
const usd = (n: number) => `US$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Refer & earn inside the app: your link, ways to share it, and the companies that joined through it. */
export default function ReferralsPage() {
  const [m, setM] = useState<Mine | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); api.get<Mine>("/referrals/me").then(setM).catch((e) => setError(e.message)); }, []);
  const link = m?.code ? `${origin}/get-started?ref=${m.code}` : "";
  const message = `We use WHOLESTRA to manage stock, sales and money across our branches. Sign up with my link: ${link}`;
  const copy = (t: string, what: string) => navigator.clipboard?.writeText(t).then(() => { setCopied(what); setTimeout(() => setCopied(""), 1600); }).catch(() => {});

  return (
    <AppShell title="Refer & earn">
      <section className="rf-hero">
        <div>
          <span className="rf-tag">🎁 Refer & earn</span>
          <h1>Earn up to US${m?.maxUsd ?? 30} for every company you refer</h1>
          <p>Know another wholesaler or distributor? Share your link. When they sign up and our team confirms them, you earn a reward of up to US${m?.maxUsd ?? 30}.</p>
        </div>
        <ol className="rf-steps">
          <li><b>Share your link</b><span>By WhatsApp, email or in person.</span></li>
          <li><b>They sign up</b><span>Your code is filled in for them.</span></li>
          <li><b>We confirm and pay</b><span>We contact you to arrange the reward.</span></li>
        </ol>
      </section>
      {error && <div className="error">{error}</div>}
      {m?.demo && <article className="panel"><p>This is the demo company. <Link href="/get-started">Create your own account</Link> to get a referral link.</p></article>}
      {m && !m.demo && <>
        <article className="panel rf-share">
          <h2>Your referral link</h2>
          <div className="rf-link"><code>{link}</code><button onClick={() => copy(link, "link")}>{copied === "link" ? "Copied ✓" : "Copy link"}</button></div>
          <p className="muted fine">Your code is <b>{m.code}</b>. People can also type it on the sign-up page.</p>
          <div className="st-row">
            <a className="btn-link wa" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
            <a className="btn-link secondary" href={`mailto:?subject=${encodeURIComponent("Try WHOLESTRA for your business")}&body=${encodeURIComponent(message)}`}>Share by email</a>
            <button className="secondary" onClick={() => copy(message, "msg")}>{copied === "msg" ? "Copied ✓" : "Copy message"}</button>
          </div>
        </article>
        <section className="kpis">
          <article className="kpi"><p>Companies signed up</p><strong>{m.totals.registered}</strong></article>
          <article className="kpi"><p>Confirmed</p><strong>{m.totals.confirmed}</strong></article>
          <article className="kpi"><p>Rewards earned</p><strong>{usd(m.totals.earnedUsd)}</strong></article>
          <article className="kpi"><p>Paid to you</p><strong>{usd(m.totals.paidUsd)}</strong></article>
        </section>
        <article className="panel">
          <h2>Your referrals</h2>
          {m.referrals.length === 0 ? <p className="empty">No one has signed up with your link yet. Share it with a business you know.</p> : (
            <table><thead><tr><th>Company</th><th>Signed up</th><th>Status</th><th>Reward</th></tr></thead>
              <tbody>{m.referrals.map((r) => <tr key={r.id}><td>{r.company}</td><td>{new Date(r.at).toLocaleDateString()}</td><td><span className={`pill ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></td><td>{r.rewardUsd ? usd(r.rewardUsd) : "—"}</td></tr>)}</tbody></table>
          )}
          <p className="muted fine">Rewards are up to US${m.maxUsd} per company, decided when our team confirms the company. Self-referrals and duplicate accounts are not eligible. See the <Link href="/terms#referrals">terms</Link>.</p>
        </article>
      </>}
    </AppShell>
  );
}
