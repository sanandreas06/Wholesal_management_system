'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import ProductThumb from "./ProductThumb";
import { api } from "../../lib/api";
import { money, moneyShort } from "../../lib/format";

type Item = { lowAt?: string[]; id: string; name: string; sku: string; imageUrl: string | null; unit: string | null; onHand: number; reorderLevel: number; price: number; branches: { name: string; qty: number }[]; sold?: number; revenue?: number };
type Tracking = {
  topSelling: Item[]; topStocked: Item[]; lowStock: Item[];
  byBranch: { id: string; name: string; units: number; value: number; items: number; low: number }[];
  pending: Record<"ordersToReceive" | "ordersPartlyReceived" | "transfersInTransit" | "transfersWaiting" | "expensesToApprove" | "unpaidInvoices" | "countsInProgress" | "openVariance", number | null>;
  unpaidAmount: number | null;
  onTheWay: {
    transfers: { id: string; number: string; from: string; to: string; dispatchedAt: string | null; units: number; items: string[] }[];
    orders: { id: string; number: string; status: string; supplier: string; branch: string; expectedDate: string | null; ordered: number; received: number }[];
  };
};

const fmtN = (n: number) => n.toLocaleString();
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

/** The "Products & tracking" tab on Home: what sells, what is waiting for someone, what is on the road, and where the stock is. */
export default function HomeTracking() {
  const [d, setD] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get<Tracking>("/home/tracking").then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="error">{error}</div>;
  if (!d) return <div className="ht-skel" aria-busy="true"><i /><i /><i /></div>;

  const p = d.pending;
  const goods: [string, number | null, string, string][] = [
    ["Orders to receive from suppliers", p.ordersToReceive, "/purchase-orders", "📦"],
    ["Orders partly received", p.ordersPartlyReceived, "/purchase-orders", "◐"],
    ["Transfers on the road", p.transfersInTransit, "/stock-transfers", "🚚"],
    ["Transfers waiting to be sent", p.transfersWaiting, "/stock-transfers", "⏳"],
    ["Stock counts in progress", p.countsInProgress, "/stock-counts", "📋"],
  ];
  const money_: [string, number | null, string, string, string?][] = [
    ["Unpaid invoices", p.unpaidInvoices, "/sales?status=unpaid", "🧾", d.unpaidAmount ? money.format(d.unpaidAmount) : undefined],
    ["Expenses to approve", p.expensesToApprove, "/finance?tab=expenses&status=PENDING", "✍"],
    ["Open variance cases", p.openVariance, "/finance?tab=cases", "⚠"],
  ];
  const visible = <T extends [string, number | null, ...unknown[]]>(rows: T[]) => rows.filter((r) => r[1] !== null);
  const noProducts = !d.topSelling.length && !d.topStocked.length;

  return (
    <div className="ht">
      <section className="ht-pending">
        {visible(goods).length > 0 && (
          <article className="card2">
            <div className="card2-head"><div><h3>Goods to act on</h3><p className="sub">Things waiting for someone</p></div></div>
            <ul className="ht-acts">{visible(goods).map(([label, n, href, ic]) => (
              <li key={label}><Link href={href} className={n ? "" : "zero"}><span className="ht-ic" aria-hidden="true">{ic}</span><span className="ht-l">{label}</span><strong>{n}</strong></Link></li>
            ))}</ul>
          </article>
        )}
        {visible(money_).length > 0 && (
          <article className="card2">
            <div className="card2-head"><div><h3>Money to act on</h3><p className="sub">Last 6 months of sales</p></div></div>
            <ul className="ht-acts">{visible(money_).map(([label, n, href, ic, extra]) => (
              <li key={label}><Link href={href} className={n ? "" : "zero"}><span className="ht-ic" aria-hidden="true">{ic}</span><span className="ht-l">{label}{extra && <small>{extra} owed</small>}</span><strong>{n}</strong></Link></li>
            ))}</ul>
          </article>
        )}
      </section>

      <article className="card2">
        <div className="card2-head"><div><h3>Top selling items</h3><p className="sub">Last 30 days, by units sold</p></div><Link href="/products">All products →</Link></div>
        {d.topSelling.length === 0
          ? <p className="empty">{noProducts ? <>No products yet. <Link href="/products?new=1">Add your first product</Link> with a picture.</> : "No sales in the last 30 days."}</p>
          : <div className="ht-cards">{d.topSelling.map((it, i) => (
              <Link key={it.id} href={`/sales?productId=${it.id}`} className="ht-card">
                <span className="ht-rank">#{i + 1}</span>
                <ProductThumb name={it.name} src={it.imageUrl} size={84} />
                <b title={it.name}>{it.name}</b>
                <small>{fmtN(it.sold ?? 0)} {it.unit ?? "units"} sold</small>
                <em>{moneyShort.format(it.revenue ?? 0)}</em>
              </Link>
            ))}</div>}
      </article>

      <section className="g2">
        <article className="card2">
          <div className="card2-head"><div><h3>Goods on the way</h3><p className="sub">Between branches and from suppliers</p></div></div>
          {d.onTheWay.transfers.length === 0 && d.onTheWay.orders.length === 0 && <p className="empty">Nothing on the road right now.</p>}
          <ul className="ht-way">
            {d.onTheWay.transfers.map((t) => (
              <li key={t.id}><Link href={`/stock-transfers?open=${t.id}`}>
                <span className="ht-way-ic" aria-hidden="true">🚚</span>
                <div><b>{t.from} → {t.to}</b><small>{t.number} · {fmtN(t.units)} units · {t.items.join(", ")}{t.dispatchedAt ? ` · sent ${day(t.dispatchedAt)}` : ""}</small></div>
                <span className="pill warn">On the road</span>
              </Link></li>
            ))}
            {d.onTheWay.orders.map((o) => {
              const pct = o.ordered ? Math.round((o.received / o.ordered) * 100) : 0;
              const late = o.expectedDate && new Date(o.expectedDate) < new Date(new Date().toDateString());
              return (
                <li key={o.id}><Link href={`/purchase-orders?open=${o.id}`}>
                  <span className="ht-way-ic" aria-hidden="true">📦</span>
                  <div><b>{o.supplier} → {o.branch}</b><small>{o.number} · {fmtN(o.received)} of {fmtN(o.ordered)} received{o.expectedDate ? ` · ${late ? "was due" : "due"} ${day(o.expectedDate)}` : ""}</small>
                    <span className="ht-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span></div>
                  <span className={"pill " + (late ? "bad" : "warn")}>{late ? "Late" : `${pct}%`}</span>
                </Link></li>
              );
            })}
          </ul>
        </article>

        <article className="card2">
          <div className="card2-head"><div><h3>Stock by branch</h3><p className="sub">Units on hand and value at selling price</p></div><Link href="/inventory">Stock levels →</Link></div>
          {d.byBranch.length === 0 ? <p className="empty">No branches yet.</p> : (
            <ul className="ht-branches">{d.byBranch.map((b) => {
              const max = Math.max(...d.byBranch.map((x) => x.value), 1);
              return (
                <li key={b.id}>
                  <div className="ht-bt"><b>{b.name}</b><span>{moneyShort.format(b.value)}</span></div>
                  <span className="ht-bar big" aria-hidden="true"><i style={{ width: `${Math.max(3, (b.value / max) * 100)}%` }} /></span>
                  <small>{fmtN(b.units)} units · {b.items} products{b.low ? <> · <Link href="/reorder" className="ht-low">{b.low} running low</Link></> : ""}</small>
                </li>
              );
            })}</ul>
          )}
        </article>
      </section>

      <section className="g2">
        <article className="card2">
          <div className="card2-head"><div><h3>Running low</h3><p className="sub">At or below the reorder level in at least one branch</p></div><Link href="/reorder">Reorder →</Link></div>
          {d.lowStock.length === 0 ? <p className="empty">Nothing is running low. 👍</p> : (
            <ul className="ht-items">{d.lowStock.map((it) => (
              <li key={it.id}>
                <ProductThumb name={it.name} src={it.imageUrl} size={44} />
                <div><b>{it.name}</b><small>Reorder at {fmtN(it.reorderLevel)}: {it.branches.map((b, i) => <span key={b.name} className={b.qty <= 0 ? "ht-b out" : b.qty <= it.reorderLevel ? "ht-b low" : "ht-b"}>{i ? " · " : ""}{b.name} {fmtN(b.qty)}</span>)}</small></div>
                <span className="ht-qty low">{it.lowAt?.length ?? 0}/{it.branches.length}<small>branches low</small></span>
              </li>
            ))}</ul>
          )}
        </article>
        <article className="card2">
          <div className="card2-head"><div><h3>Most in stock</h3><p className="sub">Where your money is sitting</p></div></div>
          {d.topStocked.length === 0 ? <p className="empty">No stock recorded yet.</p> : (
            <ul className="ht-items">{d.topStocked.map((it) => (
              <li key={it.id}>
                <ProductThumb name={it.name} src={it.imageUrl} size={44} />
                <div><b>{it.name}</b><small>{it.sku} · {money.format(it.price)} each</small></div>
                <span className="ht-qty">{fmtN(it.onHand)}<small>{moneyShort.format(it.onHand * it.price)}</small></span>
              </li>
            ))}</ul>
          )}
        </article>
      </section>
    </div>
  );
}
