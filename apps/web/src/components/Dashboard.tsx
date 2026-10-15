'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppShell from "./AppShell";
import { api } from "../lib/api";
import { getSessionUser } from "../lib/session";

type Summary = {
  period: { days: number; from: string; to: string };
  kpis: {
    totalSales: number; returnsValue: number; netSales: number; invoices: number; averageInvoice: number;
    previousPeriodSales: number; changePct: number | null;
    approvedExpenses: number | null; previousExpenses: number | null;
    deposits: number | null; previousDeposits: number | null; outstanding: number | null;
    inventoryValue: number; products: number; lowStock: number;
  };
  salesTrend: { date: string; amount: number }[];
  branchPerformance: { branch: string; amount: number; invoices: number }[];
  topProducts: { productId: string; name: string; sku: string; quantity: number; revenue: number }[];
  stockAlerts: { name: string; sku: string; stock: number; reorderLevel: number; level: "out" | "low" }[];
  inventoryByCategory: { name: string; value: number }[];
  recentSales: { id: string; invoiceNumber: string; customer: string; branch: string; amount: number; soldAt: string; payment: string }[];
  recentActivity: { id: string; at: string; type: string; product: string; branch: string; quantityDelta: number; by: string }[];
  insights: string[];
};
type Branch = { id: string; name: string };

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const moneyShort = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 });
const PERIODS = [7, 30, 90];
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];
const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Stock received", ADJUSTMENT: "Stock adjusted", TRANSFER_IN: "Transfer in", TRANSFER_OUT: "Transfer out",
  SALE: "Sold", INITIAL: "Opening stock", COUNT_VARIANCE: "Count variance", RETURN: "Returned",
};

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins || 1} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
function pct(cur: number, prev: number | null): number | null {
  if (prev === null || prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export default function Dashboard() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [firstName, setFirstName] = useState("");
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    const u = getSessionUser();
    setFirstName((u?.name ?? "").split(" ")[0]);
    setPerms(u?.permissions ?? []);
    api.get<Branch[]>("/branches").then(setBranches).catch(() => {});
  }, []);
  useEffect(() => {
    setError("");
    const q = `?days=${days}${branchId ? `&branchId=${branchId}` : ""}`;
    api.get<Summary>(`/dashboard/summary${q}`).then(setS).catch((e) => setError(e.message));
  }, [days, branchId]);

  const can = (p: string) => perms.includes(p);
  const k = s?.kpis;
  const trend = s?.salesTrend.map((x) => ({ ...x, label: x.date.slice(5) })) ?? [];
  const catTotal = s?.inventoryByCategory.reduce((t, c) => t + c.value, 0) ?? 0;

  return (
    <AppShell title="">
      <div className="dash-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back{firstName ? `, ${firstName}` : ""}. Here&apos;s what&apos;s happening with your business.</p>
        </div>
        <div className="filters">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            {PERIODS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Branch">
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {!s && !error && <p className="muted">Loading...</p>}

      {s && k && <>
        <section className="kpi5">
          <KCard cls="c1" icon="₵" title="Total Sales" value={money.format(k.totalSales)} delta={k.changePct} vs={`vs previous ${s.period.days} days`} />
          <KCard cls="c2" icon="▦" title="Inventory Value" value={money.format(k.inventoryValue)} note={`${k.products} products, at selling price`} />
          {k.approvedExpenses !== null && <KCard cls="c3" icon="▤" title="Total Expenses" value={money.format(k.approvedExpenses)} delta={pct(k.approvedExpenses, k.previousExpenses)} bad vs="vs previous period" note="Approved only" />}
          {k.deposits !== null && <KCard cls="c4" icon="⌂" title="Deposits" value={money.format(k.deposits)} delta={pct(k.deposits, k.previousDeposits)} vs="vs previous period" />}
          {k.outstanding !== null && <KCard cls="c5" icon="◔" title="Outstanding Collections" value={money.format(k.outstanding)} note="Unpaid on completed sales" />}
        </section>

        <section className="g3 a">
          <article className="card2">
            <div className="card2-head"><div><h3>Sales Trend</h3><p className="sub">Completed sales per day, last {s.period.days} days</p></div></div>
            <div className="chart"><ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs><linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--c1)", stopOpacity: 0.28 }} /><stop offset="100%" style={{ stopColor: "var(--c1)", stopOpacity: 0 }} />
                </linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={28} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v) => money.format(Number(v))} />
                <Area type="monotone" dataKey="amount" stroke="var(--c1)" strokeWidth={2.5} fill="url(#gSales)" dot={false} />
              </AreaChart></ResponsiveContainer></div>
          </article>

          <article className="card2">
            <div className="card2-head"><div><h3>Sales by Branch</h3><p className="sub">Comparison across branches</p></div></div>
            <div className="chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.branchPerformance} margin={{ top: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="branch" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v) => money.format(Number(v))} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {s.branchPerformance.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  <LabelList dataKey="amount" position="top" formatter={(v) => moneyShort.format(Number(v))} style={{ fontSize: 10, fill: "var(--text-muted)" }} />
                </Bar>
              </BarChart></ResponsiveContainer></div>
          </article>

          <article className="card2">
            <div className="card2-head"><div><h3>Inventory by Category</h3><p className="sub">Current stock value</p></div></div>
            {s.inventoryByCategory.length === 0 ? <p className="empty">No stock yet.</p> : (
              <div className="donut-wrap">
                <div className="donut">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={s.inventoryByCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                      {s.inventoryByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><Tooltip formatter={(v) => money.format(Number(v))} /></PieChart>
                  </ResponsiveContainer>
                  <div className="donut-mid"><strong>{moneyShort.format(catTotal)}</strong>Total value</div>
                </div>
                <ul className="legend">{s.inventoryByCategory.map((c, i) => (
                  <li key={c.name}><span className="sw" style={{ background: COLORS[i % COLORS.length] }} /><span className="nm">{c.name}</span><strong>{catTotal ? Math.round((c.value / catTotal) * 1000) / 10 : 0}%</strong></li>
                ))}</ul>
              </div>
            )}
          </article>
        </section>

        <section className="g3 b">
          <article className="card2">
            <div className="card2-head"><h3>Recent Sales</h3>{can("SALES:READ") && <Link href="/sales">View all →</Link>}</div>
            {s.recentSales.length === 0 ? <p className="empty">No sales yet.</p> : (
              <div style={{ overflowX: "auto" }}><table className="dtable">
                <thead><tr><th>Invoice #</th><th>Customer</th><th>Branch</th><th>Amount</th><th>Date</th><th>Payment</th></tr></thead>
                <tbody>{s.recentSales.map((r) => (
                  <tr key={r.id}><td><Link href="/sales">{r.invoiceNumber}</Link></td><td>{r.customer}</td><td>{r.branch}</td>
                    <td>{money.format(r.amount)}</td><td>{new Date(r.soldAt).toLocaleDateString()}</td><td><span className={`pill ${r.payment}`}>{r.payment}</span></td></tr>
                ))}</tbody></table></div>
            )}
          </article>

          <article className="card2">
            <div className="card2-head"><div><h3>Top Selling Products</h3><p className="sub">By revenue, last {s.period.days} days</p></div></div>
            {s.topProducts.length === 0 ? <p className="empty">No sales in this period.</p> : (
              <ul className="toplist">{s.topProducts.map((p, i) => (
                <li key={p.productId}><span className="rank">{i + 1}</span><span className="nm" title={p.name}>{p.name}</span><span className="qty">{p.quantity} units</span></li>
              ))}</ul>
            )}
          </article>

          <article className="card2">
            <div className="card2-head"><h3>Stock Alerts</h3>{can("INVENTORY:READ") && <Link href="/inventory">View all →</Link>}</div>
            {s.stockAlerts.length === 0 ? <p className="empty">Everything is above its reorder level.</p> : (
              <ul className="alerts">{s.stockAlerts.map((a) => (
                <li key={a.sku}><span className={`aic ${a.level}`}>!</span>
                  <div><strong>{a.level === "out" ? "Out of stock" : "Low stock"}</strong>
                    <span className="t">{a.name} {a.level === "out" ? "is out of stock" : `is at ${a.stock} (reorder level ${a.reorderLevel})`}</span></div></li>
              ))}</ul>
            )}
          </article>
        </section>

        <section className="g3 c">
          <article className="card2">
            <div className="card2-head"><h3>Quick Actions</h3></div>
            <div className="qa">
              {can("SALES:CREATE") && <Link href="/sales" className="q1"><i>+</i>New Sale</Link>}
              {can("PURCHASING:READ") && <Link href="/purchase-orders" className="q2"><i>▤</i>Purchase Order</Link>}
              {can("STOCK_TRANSFERS:READ") && <Link href="/stock-transfers" className="q3"><i>⇄</i>Stock Transfer</Link>}
              {can("PRODUCTS:READ") && <Link href="/products" className="q4"><i>▦</i>Add Product</Link>}
            </div>
          </article>

          <article className="card2">
            <div className="card2-head"><h3>Recent Activity</h3>{can("AUDIT:READ") && <Link href="/audit">View all →</Link>}</div>
            {s.recentActivity.length === 0 ? <p className="empty">No stock movements yet.</p> : (
              <ul className="feed2">{s.recentActivity.slice(0, 5).map((m) => (
                <li key={m.id}><span className={`fi ${m.quantityDelta < 0 ? "neg" : ""}`}>{m.quantityDelta < 0 ? "−" : "+"}</span>
                  <span className="tx"><strong>{TYPE_LABEL[m.type] ?? m.type}</strong>: {m.quantityDelta > 0 ? "+" : ""}{m.quantityDelta} {m.product} ({m.branch})</span>
                  <span className="tm">{ago(m.at)}</span></li>
              ))}</ul>
            )}
          </article>

          <article className="card2 insights">
            <h3>✦ Insights</h3>
            <p className="sub">Plain rules on your recent data, not a prediction model</p>
            {s.insights.length === 0 ? <p className="sub">Not enough data yet.</p> : <ul>{s.insights.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          </article>
        </section>
      </>}
    </AppShell>
  );
}

function KCard({ cls, icon, title, value, delta, vs, note, bad }: { cls: string; icon: string; title: string; value: string; delta?: number | null; vs?: string; note?: string; bad?: boolean }) {
  const good = delta !== null && delta !== undefined && (bad ? delta <= 0 : delta >= 0);
  return (
    <article className="kcard">
      <div className="kcard-top"><span className={`kic ${cls}`}>{icon}</span>{title}</div>
      <div className="kval">{value}</div>
      <div className="kdelta">
        {delta !== null && delta !== undefined
          ? <><b className={good ? "up" : "down"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</b> {vs}</>
          : <>{note ?? "No earlier period to compare"}</>}
      </div>
    </article>
  );
}
