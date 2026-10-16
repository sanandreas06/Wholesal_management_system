'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "./AppShell";
import { api } from "../lib/api";
import { DashboardSkeleton } from "./Skeleton";

interface Rec { id: string; kind: "invest" | "review" | "data"; title: string; detail: string; evidence: { label: string; value: string }[]; links: { label: string; href: string }[]; amount?: number }
interface ProdRow { id: string; sku: string; name: string; onHand: number; units: number; revenue: number; profit: number | null; margin: number | null; perDay: number; coverDays: number | null; stockValue: number | null }
interface BranchRow { id: string; name: string; revenue: number; profit: number | null; margin: number | null; stockValue: number; slowValue: number; slowPct: number; stockDays: number | null }
interface CatRow { name: string; revenue: number; profit: number | null; stockValue: number; profitShare: number; stockShare: number; ratio: number | null }
interface Report {
  params: { days: number; branchId: string | null };
  summary: { revenue: number; grossProfit: number | null; margin: number | null; stockValue: number; slowValue: number; slowPct: number; profitPerStock: number | null; costCoverage: number | null };
  recommendations: Rec[]; branches: BranchRow[]; categories: CatRow[]; slowStock: ProdRow[]; topEarners: ProdRow[]; notes: string[];
}
interface Ref { id: string; name: string }

const money = (n: number | null) => n === null ? "n/a" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KIND: Record<string, { label: string; cls: string }> = { invest: { label: "Worth stocking more", cls: "good" }, review: { label: "Worth reviewing", cls: "warn" }, data: { label: "Improve the data", cls: "info" } };

export default function InvestmentInsights() {
  const [data, setData] = useState<Report | null>(null);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [days, setDays] = useState(90);
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api.get<Ref[]>("/branches?own=1").then(setBranches).catch(() => {}); }, []);
  useEffect(() => {
    setError(""); setData(null);
    api.get<Report>(`/insights/investment?days=${days}${branchId ? `&branchId=${branchId}` : ""}`).then(setData).catch(e => setError(e.message));
  }, [days, branchId]);

  const s = data?.summary;
  const invest = data?.recommendations.filter(r => r.kind === "invest") ?? [];
  const review = data?.recommendations.filter(r => r.kind !== "invest") ?? [];

  return (
    <AppShell title="">
      <div className="dash-head">
        <div>
          <h1>Investment Insights</h1>
          <p>Where your money is working hard, and where it is sitting idle. Calculated from your own sales, costs and stock.</p>
        </div>
        <div className="filters">
          <button type="button" className="secondary no-print" onClick={() => window.print()}>Print / Save PDF</button>
          <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Period">{[30, 90, 180, 365].map(d => <option key={d} value={d}>Last {d} days</option>)}</select>
          <select value={branchId} onChange={e => setBranchId(e.target.value)} aria-label="Branch"><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {!data && !error && <DashboardSkeleton />}

      {data && s && (
        <>
          <section className="kpi5">
            <Tile title="Gross profit" value={money(s.grossProfit)} sub={s.margin !== null ? `${s.margin}% margin` : "No costs recorded yet"} />
            <Tile title="Stock held, at cost" value={money(s.stockValue)} sub="What you paid for what is on the shelves" />
            <Tile title="Slow or unsold stock" value={money(s.slowValue)} sub={`${s.slowPct}% of stock held`} warn={s.slowPct >= 30} />
            <Tile title="Profit per 1 of stock" value={s.profitPerStock === null ? "n/a" : s.profitPerStock.toFixed(2)} sub={`earned in ${data.params.days} days`} />
            <Tile title="Costs recorded for" value={s.costCoverage === null ? "n/a" : `${s.costCoverage}%`} sub="of sales value" warn={s.costCoverage !== null && s.costCoverage < 80} />
          </section>

          <section className="g2">
            <article className="card2">
              <div className="card2-head"><div><h3>Worth putting more money into</h3><p className="sub">Good margin, selling steadily, and stock is running short.</p></div></div>
              {invest.length === 0 ? <p className="empty">Nothing stands out right now. Either stock is comfortable or there is not enough cost data.</p> : invest.map(r => <RecCard key={r.id} r={r} />)}
            </article>
            <article className="card2">
              <div className="card2-head"><div><h3>Worth reviewing</h3><p className="sub">Money that may be working less than it could.</p></div></div>
              {review.length === 0 ? <p className="empty">Nothing needs a second look.</p> : review.map(r => <RecCard key={r.id} r={r} />)}
            </article>
          </section>

          <section className="g2">
            <article className="card2">
              <div className="card2-head"><h3>Branches</h3></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Branch</th><th>Revenue</th><th>Profit</th><th>Stock at cost</th><th>Slow stock</th><th>Stock lasts</th></tr></thead>
                <tbody>{data.branches.map(b => (
                  <tr key={b.id}>
                    <td><Link href={`/sales?branchId=${b.id}`} className="drill">{b.name}</Link></td>
                    <td>{money(b.revenue)}</td><td>{money(b.profit)}{b.margin !== null && <small className="muted"> ({b.margin}%)</small>}</td>
                    <td>{money(b.stockValue)}</td>
                    <td><span className={"badge " + (b.slowPct >= 30 ? "medium" : "active")}>{b.slowPct}%</span></td>
                    <td>{b.stockDays === null ? "n/a" : `${b.stockDays} days`}</td>
                  </tr>))}
                </tbody>
              </table></div>
            </article>
            <article className="card2">
              <div className="card2-head"><div><h3>Categories</h3><p className="sub">Share of profit against share of money tied up in stock.</p></div></div>
              {data.categories.length === 0 && <p className="empty">No data yet.</p>}
              {data.categories.map(c => (
                <div key={c.name} className="cat-row">
                  <div className="cat-name"><strong>{c.name}</strong><span className="muted">{c.ratio === null ? "" : c.ratio >= 1.3 ? "earns more than it ties up" : c.ratio < 0.6 ? "ties up more than it earns" : "balanced"}</span></div>
                  <div className="cat-bars">
                    <div title={`Profit share ${c.profitShare}%`}><span>Profit</span><i className="bar profit" style={{ width: `${Math.min(100, c.profitShare)}%` }} /><b>{c.profitShare}%</b></div>
                    <div title={`Stock share ${c.stockShare}%`}><span>Stock</span><i className="bar stock" style={{ width: `${Math.min(100, c.stockShare)}%` }} /><b>{c.stockShare}%</b></div>
                  </div>
                </div>))}
            </article>
          </section>

          <section className="g2">
            <article className="card2">
              <div className="card2-head"><div><h3>Biggest earners</h3><p className="sub">Gross profit, last {data.params.days} days.</p></div></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Product</th><th>Profit</th><th>Margin</th><th>On hand</th><th>Days of stock</th></tr></thead>
                <tbody>{data.topEarners.map(r => (
                  <tr key={r.id}><td><Link href={`/sales?productId=${r.id}`} className="drill">{r.name}</Link></td><td>{money(r.profit)}</td><td>{r.margin === null ? "n/a" : `${r.margin}%`}</td><td>{r.onHand}</td><td>{r.coverDays ?? "n/a"}</td></tr>))}
                </tbody>
              </table></div>
            </article>
            <article className="card2">
              <div className="card2-head"><div><h3>Most money sitting idle</h3><p className="sub">Unsold, or more than 90 days of stock on hand.</p></div></div>
              {data.slowStock.length === 0 ? <p className="empty">No slow stock found.</p> : (
                <div className="table-wrap"><table>
                  <thead><tr><th>Product</th><th>On hand</th><th>Tied up</th><th>Sold</th></tr></thead>
                  <tbody>{data.slowStock.map(r => (
                    <tr key={r.id}><td><Link href={`/sales?productId=${r.id}`} className="drill">{r.name}</Link></td><td>{r.onHand}</td><td>{money(r.stockValue)}</td><td>{r.units === 0 ? <span className="badge medium">none</span> : r.units}</td></tr>))}
                  </tbody>
                </table></div>
              )}
            </article>
          </section>

          <p className="muted insight-notes">{data.notes.join(" ")}</p>
        </>
      )}
    </AppShell>
  );
}

function Tile({ title, value, sub, warn }: { title: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className={"kcard" + (warn ? " kwarn" : "")}>
      <div className="kcard-top">{title}</div>
      <div className="kval">{value}</div>
      <div className="kdelta">{sub}</div>
    </div>
  );
}

function RecCard({ r }: { r: Rec }) {
  const k = KIND[r.kind];
  return (
    <div className={"rec " + k.cls}>
      <span className={"rec-tag " + k.cls}>{k.label}</span>
      <strong>{r.title}</strong>
      <p>{r.detail}</p>
      {r.evidence.length > 0 && <ul className="rec-ev">{r.evidence.map((e, i) => <li key={i}><span>{e.label}</span><b>{e.value}</b></li>)}</ul>}
      <div className="rec-links">{r.links.map(l => <Link key={l.href + l.label} href={l.href} className="drill">{l.label} →</Link>)}</div>
    </div>
  );
}
