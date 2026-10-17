'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppShell from "./AppShell";
import { DashboardSkeleton } from "./Skeleton";
import AnimatedValue from "./AnimatedValue";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { usePolling } from "../hooks/usePolling";
import { getSessionUser } from "../lib/session";
import HomeTracking from "./home/HomeTracking";
import GettingStarted from "./home/GettingStarted";

const TABS = [
  { id: "overview", label: "Dashboard" },
  { id: "tracking", label: "Products & tracking" },
  { id: "start", label: "Getting started" },
] as const;
type Tab = (typeof TABS)[number]["id"];
import { money, moneyShort } from "../lib/format";

type Summary = {
  period: { days: number; from: string; to: string };
  kpis: {
    totalSales: number; returnsValue: number; netSales: number; invoices: number; averageInvoice: number;
    previousPeriodSales: number; changePct: number | null;
    approvedExpenses: number | null; previousExpenses: number | null;
    grossProfit: number | null; previousProfit: number | null; marginPct: number | null; costCoverage: number | null;
    deposits: number | null; previousDeposits: number | null; outstanding: number | null;
    inventoryValue: number; products: number; lowStock: number; outOfStock: number;
  };
  salesTrend: { date: string; amount: number }[];
  branchPerformance: { id: string; branch: string; amount: number; invoices: number; profit: number | null }[];
  topProducts: { productId: string; name: string; sku: string; quantity: number; revenue: number }[];
  stockAlerts: { name: string; sku: string; branch: string; stock: number; daysLeft: number | null; suggestedQty: number; level: "out" | "low" }[];
  inventoryByCategory: { name: string; value: number }[];
  recentSales: { id: string; invoiceNumber: string; customer: string; branch: string; amount: number; soldAt: string; payment: string }[];
  recentActivity: { id: string; at: string; type: string; product: string; branch: string; quantityDelta: number; by: string }[];
  insights: string[];
};
type Branch = { id: string; name: string };

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
  const router = useRouter();
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [firstName, setFirstName] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [tab, setTabState] = useState<Tab>("overview");
  const [company, setCompany] = useState("");
  // the tab lives in the address (?tab=tracking) so it can be bookmarked and the Back button works
  useEffect(() => {
    const read = () => { const t = new URLSearchParams(window.location.search).get("tab"); setTabState(TABS.some((x) => x.id === t) ? (t as Tab) : "overview"); };
    read(); window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  function setTab(t: Tab) {
    setTabState(t);
    const u = new URL(window.location.href);
    if (t === "overview") u.searchParams.delete("tab"); else u.searchParams.set("tab", t);
    window.history.pushState(null, "", u.pathname + u.search);
  }

  useEffect(() => {
    const u = getSessionUser();
    setFirstName(u?.demo && u.demoFor ? u.demoFor : (u?.name ?? "").split(" ")[0]);
    setPerms(u?.permissions ?? []);
    setCompany(u?.organization ?? "");
    api.get<Branch[]>("/branches?own=1").then(setBranches).catch(() => {});
  }, []);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [, tick] = useState(0);
  const newestSale = useRef<string | null>(null);
  const load = useCallback((quiet = false) => {
    if (!quiet) setError("");
    const q = `?days=${days}${branchId ? `&branchId=${branchId}` : ""}`;
    api.get<Summary>(`/dashboard/summary${q}`).then((next) => {
      // tell the person when a sale arrives while they are watching
      const top = next.recentSales[0];
      if (quiet && top && newestSale.current && top.id !== newestSale.current) {
        const idx = next.recentSales.findIndex((x) => x.id === newestSale.current);
        const fresh = idx === -1 ? next.recentSales.length : idx;
        toast.info(fresh === 1 ? `New sale: ${top.invoiceNumber} (${money.format(top.amount)})` : `${fresh} new sales just came in`);
      }
      newestSale.current = top?.id ?? null;
      setS(next); setUpdatedAt(new Date());
    }).catch((e) => { if (!quiet) setError(e.message); });
  }, [days, branchId]);
  useEffect(() => { newestSale.current = null; load(); }, [load]);
  usePolling(() => load(true), 60000);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t); }, []);
  const updatedText = !updatedAt ? "" : (() => { const sec = Math.round((Date.now() - updatedAt.getTime()) / 1000); return sec < 20 ? "just now" : sec < 90 ? "a minute ago" : `${Math.round(sec / 60)} min ago`; })();

  const can = (p: string) => perms.includes(p);
  const k = s?.kpis;
  const trend = s?.salesTrend.map((x) => ({ ...x, label: x.date.slice(5) })) ?? [];
  const catTotal = s?.inventoryByCategory.reduce((t, c) => t + c.value, 0) ?? 0;

  return (
    <AppShell title="">
      <div className="home-top">
        <div className="home-hello">
          <span className="home-av" aria-hidden="true">{(company || firstName || "W").slice(0, 1).toUpperCase()}</span>
          <div>
            <h1>Hello{firstName ? `, ${firstName}` : ""}</h1>
            <p>{company || "Your company"}</p>
          </div>
        </div>
        <nav className="home-tabs" role="tablist" aria-label="Home">
          {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </nav>
      </div>

      {tab === "tracking" && <HomeTracking />}
      {tab === "start" && <GettingStarted />}
      {tab === "overview" && <>
      <div className="dash-head">
        <div>
          <h1>Dashboard</h1>
          <p>Here&apos;s what&apos;s happening with your business.</p>
        </div>
        <div className="filters">
          <button type="button" className="live-pill" onClick={() => load(true)} title="Refresh now" aria-label="Refresh now"><span className="live-dot" />Live{updatedText ? ` · ${updatedText}` : ""} ↻</button>
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
      {!s && !error && <DashboardSkeleton />}

      {s && k && <>
        {k.lowStock > 0 && (
          <Link href={can("PURCHASING:READ") ? "/reorder" : "/inventory"} className={"alert-banner " + (k.outOfStock > 0 ? "red" : "amber")}>
            <span className="alert-icon">!</span>
            <span>
              <strong>{k.outOfStock > 0 ? `${k.outOfStock} item${k.outOfStock === 1 ? " is" : "s are"} out of stock` : `${k.lowStock} item${k.lowStock === 1 ? "" : "s"} need${k.lowStock === 1 ? "s" : ""} restocking soon`}</strong>
              {k.outOfStock > 0 && k.lowStock - k.outOfStock > 0 ? `, and ${k.lowStock - k.outOfStock} more ${k.lowStock - k.outOfStock === 1 ? "needs" : "need"} restocking.` : "."}
              {" "}{can("PURCHASING:READ") ? "See what to reorder" : "Review stock levels"} →
            </span>
          </Link>
        )}
        <section className="kpi5">
          <KCard href="/sales" cls="c1" icon="₵" title="Total Sales" value={money.format(k.totalSales)} delta={k.changePct} vs={`vs previous ${s.period.days} days`} />
          {k.grossProfit !== null && <KCard href="/products" cls="c1" icon="↗" title="Gross Profit" value={money.format(k.grossProfit)} delta={pct(k.grossProfit, k.previousProfit)} vs={`vs previous ${s.period.days} days`}
            note={k.marginPct === null ? "Add cost prices to see profit" : undefined} sub={k.marginPct === null ? undefined : `${k.marginPct}% margin${k.returnsValue ? `, after ${money.format(k.returnsValue)} returned` : ""}${k.costCoverage !== null && k.costCoverage < 99.5 ? `, cost known for ${k.costCoverage}% of sales` : ""}`} />}
          <KCard href="/inventory" cls="c2" icon="▦" title="Inventory Value" value={money.format(k.inventoryValue)} note={`${k.products} products, at selling price`} />
          {k.approvedExpenses !== null && <KCard href={`/finance?tab=expenses&status=APPROVED&from=${s.period.from}&to=${s.period.to}${branchId ? `&branchId=${branchId}` : ""}`} cls="c3" icon="▤" title="Total Expenses" value={money.format(k.approvedExpenses)} delta={pct(k.approvedExpenses, k.previousExpenses)} bad vs="vs previous period" note="Approved only" />}
          {k.deposits !== null && <KCard href={`/finance?tab=deposits&from=${s.period.from}&to=${s.period.to}${branchId ? `&branchId=${branchId}` : ""}`} cls="c4" icon="⌂" title="Deposits" value={money.format(k.deposits)} delta={pct(k.deposits, k.previousDeposits)} vs="vs previous period" />}
          {k.outstanding !== null && <KCard href="/sales?status=unpaid" cls="c5" icon="◔" title="Outstanding Collections" value={money.format(k.outstanding)} note="Unpaid on completed sales" />}
        </section>

        <section className="g3 a">
          <article className="card2">
            <div className="card2-head"><div><h3>Sales Trend</h3><p className="sub">Click a day to see its sales</p></div></div>
            <div className="chart"><ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} style={{ cursor: "pointer" }} onClick={(st) => { const d = (st as unknown as { activePayload?: { payload?: { date?: string } }[] } | null)?.activePayload?.[0]?.payload?.date; if (d) router.push(`/sales?date=${d}${branchId ? `&branchId=${branchId}` : ""}`); }}>
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
            <div className="card2-head"><div><h3>Sales by Branch</h3><p className="sub">Click a bar to see that branch&apos;s sales</p></div></div>
            <div className="chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.branchPerformance} margin={{ top: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="branch" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v) => money.format(Number(v))} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48} cursor="pointer" onClick={(d) => { const id = (d as unknown as { id?: string }).id; if (id) router.push(`/sales?branchId=${id}`); }}>
                  {s.branchPerformance.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  <LabelList dataKey="amount" position="top" formatter={(v) => moneyShort.format(Number(v))} style={{ fontSize: 10, fill: "var(--text-muted)" }} />
                </Bar>
              </BarChart></ResponsiveContainer></div>
          </article>

          <article className="card2">
            <div className="card2-head"><div><h3>Inventory by Category</h3><p className="sub">Click a slice to see its products</p></div></div>
            {s.inventoryByCategory.length === 0 ? <p className="empty">No stock yet.</p> : (
              <div className="donut-wrap">
                <div className="donut">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={s.inventoryByCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none" cursor="pointer" onClick={(d) => { const n = (d as unknown as { name?: string }).name; router.push(n && n !== "Others" ? `/products?category=${encodeURIComponent(n)}` : "/products"); }}>
                      {s.inventoryByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><Tooltip formatter={(v) => money.format(Number(v))} /></PieChart>
                  </ResponsiveContainer>
                  <div className="donut-mid"><strong>{moneyShort.format(catTotal)}</strong>Total value</div>
                </div>
                <ul className="legend">{s.inventoryByCategory.map((c, i) => (
                  <li key={c.name} className="legend-link" onClick={() => router.push(c.name !== "Others" ? `/products?category=${encodeURIComponent(c.name)}` : "/products")}><span className="sw" style={{ background: COLORS[i % COLORS.length] }} /><span className="nm">{c.name}</span><strong>{catTotal ? Math.round((c.value / catTotal) * 1000) / 10 : 0}%</strong></li>
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
                  <tr key={r.id}><td><Link href={`/sales?open=${r.id}`}>{r.invoiceNumber}</Link></td><td>{r.customer}</td><td>{r.branch}</td>
                    <td>{money.format(r.amount)}</td><td>{new Date(r.soldAt).toLocaleDateString()}</td><td><span className={`pill ${r.payment}`}>{r.payment}</span></td></tr>
                ))}</tbody></table></div>
            )}
          </article>

          <article className="card2">
            <div className="card2-head"><div><h3>Top Selling Products</h3><p className="sub">By revenue, last {s.period.days} days</p></div></div>
            {s.topProducts.length === 0 ? <p className="empty">No sales in this period.</p> : (
              <ul className="toplist">{s.topProducts.map((p, i) => (
                <li key={p.productId}><Link href={`/sales?productId=${p.productId}`}><span className="rank">{i + 1}</span><span className="nm" title={p.name}>{p.name}</span><span className="qty">{p.quantity} units</span></Link></li>
              ))}</ul>
            )}
          </article>

          <article className="card2">
            <div className="card2-head"><h3>Stock Alerts{k.lowStock > 0 && <span className="count-pill">{k.lowStock}</span>}</h3><span>{can("PURCHASING:READ") && <Link href="/reorder">Reorder →</Link>}{can("INVENTORY:READ") && <Link href="/inventory" style={{ marginLeft: 12 }}>View all →</Link>}</span></div>
            {s.stockAlerts.length === 0 ? <p className="empty">Nothing needs restocking right now.</p> : (
              <ul className="alerts">{s.stockAlerts.map((a) => (
                <li key={`${a.sku}-${a.branch}`}><span className={`aic ${a.level}`}>!</span>
                  <div><strong>{a.level === "out" ? "Out of stock" : "Low stock"}</strong>
                    <span className="t">{a.name} at {a.branch}: {a.level === "out" ? "none left" : `${a.stock} left${a.daysLeft !== null ? `, about ${a.daysLeft} days of stock` : ""}`}. Suggest ordering {a.suggestedQty}.</span></div></li>
              ))}</ul>
            )}
          </article>
        </section>

        <section className="g3 c">
          <article className="card2">
            <div className="card2-head"><h3>Quick Actions</h3></div>
            <div className="qa">
              {can("SALES:CREATE") && <Link href="/sales?new=1" className="q1"><i>+</i>New Sale</Link>}
              {can("PURCHASING:READ") && <Link href="/purchase-orders" className="q2"><i>▤</i>Purchase Order</Link>}
              {can("STOCK_TRANSFERS:READ") && <Link href="/stock-transfers" className="q3"><i>⇄</i>Stock Transfer</Link>}
              {can("PRODUCTS:READ") && <Link href="/products?new=1" className="q4"><i>▦</i>Add Product</Link>}
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
      </>}
    </AppShell>
  );
}

function KCard({ href, cls, icon, title, value, delta, vs, note, bad, sub }: { href: string; cls: string; icon: string; title: string; value: string; delta?: number | null; vs?: string; note?: string; bad?: boolean; sub?: string }) {
  const good = delta !== null && delta !== undefined && (bad ? delta <= 0 : delta >= 0);
  return (
    <Link href={href} className="kcard">
      <div className="kcard-top"><span className={`kic ${cls}`}>{icon}</span>{title}</div>
      <div className="kval"><AnimatedValue value={value} /></div>
      <div className="kdelta">
        {delta !== null && delta !== undefined
          ? <><b className={good ? "up" : "down"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</b> {vs}</>
          : <>{note ?? "No earlier period to compare"}</>}
      </div>
      {sub && <div className="kdelta">{sub}</div>}
    </Link>
  );
}
