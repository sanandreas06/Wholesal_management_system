'use client';
import { useEffect, useState } from "react";
import AppShell from "../AppShell";
import { api, ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import { getSessionUser } from "../../lib/session";
import "./balances.css";

interface BranchDay { branch: string; sales: number; salesTotal: number; cash: number; momo: number; bank: number; creditGiven: number; debtsCollected: number; expenses: number; offlineSales: number }
interface Summary {
  company: string; day: string; label: string; total: BranchDay; branches: BranchDay[]; topProducts: { name: string; quantity: number; amount: number }[];
  owedToYou: number; overdueCustomers: number; goodsWaiting: number; outOfStock: number; lowStock: number; openQuestions: number; newQuestions: number; customerProblems: number;
  cashDifferences: { cashier: string; difference: number }[];
}
interface Sub { on: boolean; owner: boolean; email: string; phone: string | null; mail: boolean; sms: boolean; hour: number }
const m = (n: number) => `GH₵ ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The day at a glance: the same summary owners get by email every evening, on screen, for any day. */
export default function DailySummary() {
  const [day, setDay] = useState("");
  const [s, setS] = useState<Summary | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [canSend, setCanSend] = useState(false);
  useEffect(() => { setCanSend(!!getSessionUser()?.permissions.includes("ORGANIZATION:UPDATE")); api.get<Sub>("/summary/subscription").then(setSub).catch(() => undefined); }, []);
  useEffect(() => { setS(null); api.get<Summary>(`/summary${day ? `?day=${day}` : ""}`).then(setS).catch(e => setError(e instanceof ApiError ? e.message : "Could not load the summary.")); }, [day]);

  const attention = s ? [
    ...s.cashDifferences.map(c => `${c.cashier} was ${c.difference < 0 ? "short" : "over"} ${m(Math.abs(c.difference))} at the till`),
    s.customerProblems ? `${s.customerProblems} customer${s.customerProblems === 1 ? "" : "s"} reported missing or wrong goods` : "",
    s.openQuestions ? `${s.openQuestions} handover question${s.openQuestions === 1 ? "" : "s"} waiting (${s.newQuestions} new this day)` : "",
    s.total.offlineSales ? `${s.total.offlineSales} sale${s.total.offlineSales === 1 ? " was" : "s were"} made without internet` : "",
    s.outOfStock ? `${s.outOfStock} item${s.outOfStock === 1 ? " is" : "s are"} out of stock` : "",
    s.lowStock ? `${s.lowStock} item${s.lowStock === 1 ? " is" : "s are"} running low` : "",
    s.goodsWaiting ? `${s.goodsWaiting} customer${s.goodsWaiting === 1 ? " has" : "s have"} paid goods waiting for collection` : "",
    s.overdueCustomers ? `${s.overdueCustomers} customer${s.overdueCustomers === 1 ? " is" : "s are"} past their credit days` : "",
  ].filter(Boolean) : [];

  async function toggle(on: boolean) { try { const r = await api.patch<{ on: boolean }>("/summary/subscription", { on }); setSub(x => x && { ...x, on: r.on }); toast.success(on ? "You will get the summary every evening." : "Evening summary turned off."); } catch { toast.error("Could not save."); } }
  async function sendNow() { setBusy(true); try { const r = await api.post<{ sent: number }>("/summary/send-me"); toast.success(r.sent ? `Sent to ${sub?.email}.` : "Nothing was sent."); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not send."); } finally { setBusy(false); } }

  return (
    <AppShell title="Daily summary">
      <div className="sm">
        <div className="sm-head">
          <h2>{s ? s.label : "…"}</h2>
          <label className="sc-branch" style={{ margin: 0 }}>Day<input type="date" value={day} max={new Date().toISOString().slice(0, 10)} onChange={e => setDay(e.target.value)} /></label>
        </div>
        {error && <div className="error">{error}</div>}
        {s && <>
          <div className="bl-tiles">
            <div><span>Sales</span><b>{m(s.total.salesTotal)}</b></div>
            <div><span>Cash</span><b>{m(s.total.cash)}</b></div>
            <div><span>Mobile money</span><b>{m(s.total.momo)}</b></div>
            <div><span>Bank</span><b>{m(s.total.bank)}</b></div>
            <div><span>Debts collected</span><b>{m(s.total.debtsCollected)}</b></div>
            <div><span>Credit given</span><b>{m(s.total.creditGiven)}</b></div>
            <div><span>Expenses</span><b>{m(s.total.expenses)}</b></div>
            <div className="warn"><span>Customers owe you</span><b>{m(s.owedToYou)}</b></div>
          </div>
          {attention.length ? <div className="sm-attn"><h3>Needs your attention</h3><ul>{attention.map((a, i) => <li key={i}>{a}</li>)}</ul></div> : <div className="sm-ok">Nothing needs your attention.</div>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Branch</th><th>Sales</th><th>Cash</th><th>MoMo</th><th>Bank</th><th>Debts collected</th><th>Credit given</th></tr></thead>
              <tbody>{s.branches.map(b => <tr key={b.branch}><td>{b.branch}</td><td>{m(b.salesTotal)} <span className="muted">({b.sales})</span></td><td>{m(b.cash)}</td><td>{m(b.momo)}</td><td>{m(b.bank)}</td><td>{m(b.debtsCollected)}</td><td>{m(b.creditGiven)}</td></tr>)}</tbody>
            </table>
          </div>
          {s.topProducts.length > 0 && <div className="table-wrap" style={{ marginTop: 14 }}><table><thead><tr><th>Best sellers</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>{s.topProducts.map(p => <tr key={p.name}><td>{p.name}</td><td>{p.quantity}</td><td>{m(p.amount)}</td></tr>)}</tbody></table></div>}
        </>}
        {sub && <div className="sm-sub">
          <label><input type="checkbox" checked={sub.on} onChange={e => toggle(e.target.checked)} /> Email me this every evening{sub.owner ? "" : " (sent to owners)"}</label>
          <span className="muted">{sub.mail ? `To ${sub.email}, after ${String(sub.hour).padStart(2, "0")}:00.` : "Email is not set up on the server yet."}{sub.sms && sub.phone ? ` A short text goes to ${sub.phone} too.` : ""}</span>
          {canSend && sub.mail && <button className="secondary" disabled={busy} onClick={sendNow}>{busy ? "Sending…" : "Email it to me now"}</button>}
        </div>}
      </div>
    </AppShell>
  );
}
