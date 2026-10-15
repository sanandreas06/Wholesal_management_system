'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppShell from "./AppShell";
import { api } from "../lib/api";

type Summary = {
  period: { days: number; from: string; to: string };
  kpis: {
    totalSales: number; returnsValue: number; netSales: number; invoices: number; averageInvoice: number;
    previousPeriodSales: number; changePct: number | null; approvedExpenses: number | null;
    inventoryValue: number; products: number; lowStock: number;
  };
  salesTrend: { date: string; amount: number }[];
  branchPerformance: { branch: string; amount: number; invoices: number }[];
  topProducts: { productId: string; name: string; sku: string; quantity: number; revenue: number }[];
  lowStockItems: { name: string; sku: string; stock: number; reorderLevel: number }[];
  recentActivity: { id: string; at: string; type: string; product: string; sku: string; branch: string; quantityDelta: number; by: string; notes: string | null }[];
  attention: { pendingExpenses?: number; openVarianceCases?: number; importedSales?: number };
};
type Branch = { id: string; name: string };

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const PERIODS = [7, 30, 90];
const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Received", ADJUSTMENT: "Adjusted", TRANSFER_IN: "Transfer in", TRANSFER_OUT: "Transfer out",
  SALE: "Sold", INITIAL: "Opening stock", COUNT_VARIANCE: "Count variance", RETURN: "Returned",
};

export default function Dashboard() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => { api.get<Branch[]>("/branches").then(setBranches).catch(() => {}); }, []);
  useEffect(() => {
    setError("");
    const q = `?days=${days}${branchId ? `&branchId=${branchId}` : ""}`;
    api.get<Summary>(`/dashboard/summary${q}`).then(setS).catch((e) => setError(e.message));
  }, [days, branchId]);

  const trend = s?.salesTrend.map((x) => ({ ...x, label: x.date.slice(5) })) ?? [];
  const k = s?.kpis;
  const a = s?.attention;
  const hasAttention = a && ((a.pendingExpenses ?? 0) > 0 || (a.openVarianceCases ?? 0) > 0);

  return (
    <AppShell title="Executive Dashboard">
      <div className="dash-filters">
        <div className="seg">
          {PERIODS.map((d) => (
            <button key={d} className={d === days ? "seg-on" : ""} onClick={() => setDays(d)}>Last {d} days</button>
          ))}
        </div>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {s && <span className="muted">{s.period.from} to {s.period.to}</span>}
      </div>

      {error && <div className="error">{error}</div>}
      {!s && !error && <p className="muted">Loading dashboard...</p>}

      {s && k && <>
        <section className="kpis">
          <K icon="₵" tone="teal" title="Sales" value={money.format(k.totalSales)}
             sub={k.changePct === null ? "No earlier period to compare" : `${k.changePct >= 0 ? "▲" : "▼"} ${Math.abs(k.changePct)}% vs previous ${s.period.days} days`}
             subTone={k.changePct === null ? "" : k.changePct >= 0 ? "up" : "down"} />
          <K icon="↩" tone="amber" title="Net of returns" value={money.format(k.netSales)} sub={`${money.format(k.returnsValue)} returned`} />
          <K icon="#" tone="blue" title="Invoices" value={String(k.invoices)} sub={`Average ${money.format(k.averageInvoice)}`} />
          <K icon="▦" tone="teal" title="Stock value" value={money.format(k.inventoryValue)} sub={`${k.products} products, at selling price`} />
        </section>

        {hasAttention && (
          <section className="attention">
            {(a?.pendingExpenses ?? 0) > 0 && <Link href="/finance">{a?.pendingExpenses} expense(s) awaiting approval</Link>}
            {(a?.openVarianceCases ?? 0) > 0 && <Link href="/finance">{a?.openVarianceCases} open variance case(s) worth reviewing</Link>}
            {k.lowStock > 0 && <Link href="/inventory">{k.lowStock} item(s) at or below reorder level</Link>}
          </section>
        )}

        <section className="charts">
          <article className="panel">
            <h2>Sales trend</h2>
            <p className="muted">Completed sales per day</p>
            <div className="chart"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} /><YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => money.format(Number(v))} />
                <Line type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={3} dot={false} />
              </LineChart></ResponsiveContainer></div>
          </article>
          <article className="panel">
            <h2>Branch performance</h2>
            <p className="muted">Sales in the selected period</p>
            <div className="chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.branchPerformance}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="branch" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => money.format(Number(v))} />
                <Bar dataKey="amount" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
          </article>
        </section>

        <section className="dash-grid">
          <article className="panel">
            <h2>Top products</h2>
            {s.topProducts.length === 0 ? <p className="muted">No sales in this period.</p> : (
              <table><thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Revenue</th></tr></thead>
                <tbody>{s.topProducts.map((p) => (
                  <tr key={p.productId}><td>{p.name}<div className="muted small">{p.sku}</div></td>
                    <td className="num">{p.quantity}</td><td className="num">{money.format(p.revenue)}</td></tr>
                ))}</tbody></table>
            )}
          </article>
          <article className="panel">
            <h2>Low stock</h2>
            {s.lowStockItems.length === 0 ? <p className="muted">Everything is above its reorder level.</p> : (
              <table><thead><tr><th>Product</th><th className="num">On hand</th><th className="num">Reorder at</th></tr></thead>
                <tbody>{s.lowStockItems.map((p) => (
                  <tr key={p.sku}><td>{p.name}<div className="muted small">{p.sku}</div></td>
                    <td className="num"><span className={`badge ${p.stock === 0 ? "high" : "medium"}`}>{p.stock}</span></td>
                    <td className="num">{p.reorderLevel}</td></tr>
                ))}</tbody></table>
            )}
          </article>
        </section>

        <section className="dash-grid">
          <article className="panel">
            <h2>Recent stock activity</h2>
            {s.recentActivity.length === 0 ? <p className="muted">No stock movements yet.</p> : (
              <ul className="feed">{s.recentActivity.map((m) => (
                <li key={m.id}>
                  <span className={`badge ${m.quantityDelta < 0 ? "medium" : "active"}`}>{TYPE_LABEL[m.type] ?? m.type}</span>
                  <span><strong>{m.quantityDelta > 0 ? "+" : ""}{m.quantityDelta}</strong> {m.product} <span className="muted">at {m.branch}</span></span>
                  <span className="muted small">{m.by} · {new Date(m.at).toLocaleString()}</span>
                </li>
              ))}</ul>
            )}
          </article>
          <article className="panel">
            <h2>Money and reporting</h2>
            <ul className="feed">
              <li><span>Previous {s.period.days} days</span><strong>{money.format(k.previousPeriodSales)}</strong></li>
              {k.approvedExpenses !== null && <li><span>Approved expenses in period</span><strong>{money.format(k.approvedExpenses)}</strong></li>}
              {a?.importedSales !== undefined && <li><span>Imported weekly sales (Excel)</span><strong>{money.format(a.importedSales)}</strong></li>}
            </ul>
            <p className="muted small">Imported weekly sales are kept separate from live sales and are not added to the totals above.</p>
          </article>
        </section>
      </>}
    </AppShell>
  );
}

function K({ icon, tone, title, value, sub, subTone }: { icon: string; tone: string; title: string; value: string; sub?: string; subTone?: string }) {
  return (
    <article className="kpi">
      <div className={`kpi-icon ${tone}`}>{icon}</div>
      <p>{title}</p>
      <strong>{value}</strong>
      {sub && <div className={`kpi-sub ${subTone ?? ""}`}>{sub}</div>}
    </article>
  );
}
