'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { getSessionUser, SessionUser, clearSession } from "../../lib/session";
import { useScanner, scanFeedback } from "../../lib/scanner";
import { shrinkImage } from "../../lib/image";
import { useTheme } from "../../hooks/useTheme";
import CameraScanner from "../CameraScanner";
import IdleGuard from "../IdleGuard";
import { LogoMark } from "../Logo";
import { channelName, DisplayMsg, Line } from "./display-channel";
import "./counter.css";
import "../app-extra.css";

type Product = { id: string; sku: string; name: string; unitPrice: string | number; stockQuantity: number; imageThumb?: string | null; barcodes?: string[]; categoryRef?: { id: string; name: string } | null; unit?: { name: string } | null };
type Branch = { id: string; name: string };
type Customer = { id: string; name: string; phone: string | null; code?: string };
type Payment = { momoNumber: string | null; momoName: string | null; momoMerchantId: string | null; momoQr: string | null };
type Brand = { name: string; logo: string | null; address: string | null; phone: string | null };
type SaleRow = { id: string; invoiceNumber: string; status: string; totalAmount: string; soldAt: string; customer: { name: string } | null; user: { name: string }; payments: { method: string; amount: string }[]; items: { quantity: number }[] };
type Method = "CASH" | "MOBILE_MONEY" | "BANK" | "CREDIT";
type Done = { invoice: string; total: number; paid: number; change: number; method: Method; lines: Line[]; customer: string | null; when: string };

const METHOD_LABEL: Record<Method, string> = { CASH: "Cash", MOBILE_MONEY: "Mobile money", BANK: "Bank transfer", CREDIT: "On credit" };
const n2 = (v: number | string) => Number(v).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (v: number) => Math.round(v * 100) / 100;
const TINTS = ["#E8EEFF", "#FDEBD3", "#E3F4E9", "#F3E8FF", "#FFE4E6", "#E0F2FE", "#FEF3C7", "#E7E5E4"];
const tint = (s: string) => TINTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

/** The counter (point of sale): pictures of what the branch sells, grouped by category, a basket that adds itself up, and payment
 *  by cash, mobile money, bank or credit. Products are added by tapping, a USB/Bluetooth scanner, or the camera.
 *  A second screen facing the customer (Customer screen) shows the basket, the total and how to pay by mobile money.
 *  Every sale is saved at once, so the branch manager and the owner see it straight away on their dashboards. */
export default function Counter() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [view, setView] = useState<"sell" | "today">("sell");
  const [cartOpen, setCartOpen] = useState(false);
  const [camera, setCamera] = useState(false);
  const [pay, setPay] = useState<Method | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pickCustomer, setPickCustomer] = useState(false);
  const [payInfo, setPayInfo] = useState<Payment | null>(null);
  const [editPay, setEditPay] = useState(false);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [flash, setFlash] = useState<{ text: string; bad?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const chan = useRef<BroadcastChannel | null>(null);
  const can = (p: string) => !!user?.permissions.includes(p);

  // who is at the counter, and which branch
  useEffect(() => {
    const u = getSessionUser();
    if (!u) { router.replace(`/login?next=${encodeURIComponent("/counter")}`); return; }
    setUser(u);
    api.get<Branch[]>("/branches?own=1").then(bs => {
      setBranches(bs);
      let saved = ""; try { saved = localStorage.getItem("wms_counter_branch") ?? ""; } catch { /* ignore */ }
      setBranchId(bs.find(b => b.id === saved)?.id ?? bs[0]?.id ?? "");
    }).catch(() => setError("Could not load your branches. Check your connection and reload."));
    api.get<Brand>("/organization/brand").then(setBrand).catch(() => undefined);
  }, [router]);

  const loadProducts = useCallback(() => {
    if (!branchId) return;
    api.get<Product[]>(`/products?branchId=${branchId}`).then(setProducts).catch(() => setError("Could not load the products."));
  }, [branchId]);
  useEffect(() => {
    if (!branchId) return;
    try { localStorage.setItem("wms_counter_branch", branchId); } catch { /* ignore */ }
    setProducts(null); setCart([]); loadProducts();
    api.get<Payment>(`/branches/${branchId}/payment`).then(setPayInfo).catch(() => setPayInfo(null));
  }, [branchId, loadProducts]);
  // stock changes at other tills and from deliveries: refresh quietly every minute
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible" && !pay) loadProducts(); }, 60_000); return () => clearInterval(t); }, [loadProducts, pay]);

  const total = round2(cart.reduce((s, l) => s + l.qty * l.price, 0));
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const branchName = branches.find(b => b.id === branchId)?.name ?? "";

  // ---- the customer screen (same computer, second display): send it the basket on every change
  useEffect(() => {
    if (!branchId || typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(channelName(branchId));
    chan.current = c;
    return () => { c.close(); chan.current = null; };
  }, [branchId]);
  const state = useCallback((): DisplayMsg => done
    ? { type: "paid", invoice: done.invoice, total: done.total, paid: done.paid, change: done.change, method: done.method }
    : cart.length ? { type: "cart", lines: cart, total, customer: customer?.name ?? null, paying: pay } : { type: "idle" }, [cart, total, customer, pay, done]);
  useEffect(() => { chan.current?.postMessage(state()); }, [state]);
  useEffect(() => {
    const c = chan.current; if (!c) return;
    const on = (e: MessageEvent<DisplayMsg>) => { if (e.data?.type === "hello") c.postMessage(state()); };
    c.addEventListener("message", on);
    return () => c.removeEventListener("message", on);
  }, [state, branchId]);
  function openDisplay() {
    window.open(`/counter/display?branch=${encodeURIComponent(branchId)}`, "wms-customer-display", "popup,width=1024,height=640");
  }

  // ---- adding to the basket
  const say = (text: string, bad = false) => { setFlash({ text, bad }); setTimeout(() => setFlash(f => (f?.text === text ? null : f)), 2200); };
  const add = useCallback((p: Product, qty = 1) => {
    if (done) { setDone(null); }
    setCart(c => {
      const have = c.find(l => l.id === p.id);
      const next = (have?.qty ?? 0) + qty;
      if (next > p.stockQuantity) { scanFeedback(false); say(p.stockQuantity <= 0 ? `${p.name} is out of stock at this branch` : `Only ${p.stockQuantity} ${p.name} in stock`, true); return c; }
      return have ? c.map(l => (l.id === p.id ? { ...l, qty: next } : l)) : [...c, { id: p.id, name: p.name, price: Number(p.unitPrice), qty, stock: p.stockQuantity }];
    });
  }, [done]);
  const setQty = (id: string, qty: number) => setCart(c => qty <= 0 ? c.filter(l => l.id !== id) : c.map(l => (l.id === id ? { ...l, qty: Math.min(qty, l.stock) } : l)));

  // ---- a scanned code: from a USB/Bluetooth scanner, the camera, or Enter in the search box
  const scanned = useCallback(async (raw: string) => {
    const code = raw.trim(); if (!code || !products) return false;
    let p = products.find(x => x.barcodes?.includes(code) || x.sku.toLowerCase() === code.toLowerCase());
    if (!p) {
      try { const found = await api.get<Product>(`/products/lookup?code=${encodeURIComponent(code)}&branchId=${branchId}`); p = found; setProducts(ps => ps && !ps.some(x => x.id === found.id) ? [...ps, found] : ps); }
      catch { scanFeedback(false); say(`No product has the barcode ${code}. Add it to the product first.`, true); return false; }
    }
    scanFeedback(true); add(p); say(`Added ${p.name}`);
    return true;
  }, [products, branchId, add]);
  useScanner(code => { void scanned(code); }, view === "sell" && !pay && !pickCustomer && !editPay && !camera);

  // ---- what shows in the grid
  const cats = useMemo(() => ["All", ...[...new Set((products ?? []).map(p => p.categoryRef?.name).filter(Boolean) as string[])].sort()], [products]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (products ?? []).filter(p => (cat === "All" || p.categoryRef?.name === cat) && (!t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || p.barcodes?.some(b => b.includes(t))));
  }, [products, cat, q]);

  // ---- paying
  async function complete(method: Method, reference: string, received: number) {
    if (!user) return;
    const lines = cart.map(l => ({ productId: l.id, quantity: l.qty, unitPrice: l.price }));
    const payments = method === "CREDIT" ? [] : [{ method, amount: total, ...(reference ? { reference } : {}) }];
    const sale = await api.post<{ invoiceNumber: string; soldAt: string }>("/sales", { branchId, customerId: customer?.id, items: lines, payments });
    const change = method === "CASH" ? round2(Math.max(0, received - total)) : 0;
    setDone({ invoice: sale.invoiceNumber, total, paid: method === "CREDIT" ? 0 : total, change, method, lines: cart, customer: customer?.name ?? null, when: sale.soldAt });
    setPay(null); setCart([]); setCustomer(null); setCartOpen(true);
    loadProducts();
  }
  function newSale() { setDone(null); setCartOpen(false); }

  function printReceipt(d: Done) {
    const w = window.open("", "_blank", "width=420,height=640"); if (!w) { say("Allow pop-ups for this site to print receipts.", true); return; }
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    const rows = d.lines.map(l => `<tr><td>${esc(l.name)}<br><small>${l.qty} × ${n2(l.price)}</small></td><td class="r">${n2(l.qty * l.price)}</td></tr>`).join("");
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.invoice)}</title><style>
      @page{size:80mm auto;margin:4mm}body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;width:72mm}
      .c{text-align:center}h1{font-size:15px;margin:0 0 2px}small{color:#333}table{width:100%;border-collapse:collapse;margin:8px 0}
      td{padding:3px 0;vertical-align:top;border-bottom:1px dashed #bbb}.r{text-align:right;white-space:nowrap}
      .t td{border:0;font-weight:700;font-size:14px}.m{margin:2px 0}hr{border:0;border-top:1px dashed #000}
      img{max-width:40mm;max-height:18mm;object-fit:contain}
    </style></head><body>
      <div class="c">${brand?.logo && /^data:image\/(png|jpeg|webp);base64,/.test(brand.logo) ? `<img src="${brand.logo}" alt=""><br>` : ""}<h1>${esc(brand?.name || "WHOLESTRA")}</h1>
      <div class="m">${esc(branchName)}</div>${brand?.phone ? `<div class="m">${esc(brand.phone)}</div>` : ""}</div><hr>
      <div class="m">Receipt <b>${esc(d.invoice)}</b></div><div class="m">${new Date(d.when).toLocaleString("en-GB")}</div>
      <div class="m">Served by ${esc(user?.name ?? "")}${d.customer ? ` · Customer: ${esc(d.customer)}` : ""}</div>
      <table>${rows}<tr class="t"><td>TOTAL</td><td class="r">${n2(d.total)}</td></tr></table>
      <div class="m">Paid by ${esc(METHOD_LABEL[d.method])}${d.method === "CREDIT" ? " (to pay later)" : ""}</div>
      ${d.change > 0 ? `<div class="m">Change: <b>${n2(d.change)}</b></div>` : ""}
      <hr><div class="c">Thank you for buying from us.</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>`);
    w.document.close();
  }

  const timedOut = useCallback((why: "idle" | "elsewhere") => {
    clearSession(); window.location.replace(`/login?expired=1&why=${why}&next=${encodeURIComponent("/counter")}`);
  }, []);

  if (!user) return null;
  if (!can("SALES:CREATE")) return (
    <div className="pos-blocked"><h1>The counter is for staff who sell</h1><p>Your role cannot record sales. Ask your owner or administrator to add selling to your role.</p><Link href="/dashboard" className="pos-btn primary">Go to my dashboard</Link></div>
  );

  const MORE = [
    { href: "/inventory", label: "Stock levels", p: "INVENTORY:READ" },
    { href: "/purchase-orders", label: "Receive goods", p: "GOODS_RECEIVING:CREATE" },
    { href: "/stock-counts", label: "Count stock", p: "STOCK_COUNTS:CREATE" },
    { href: "/stock-transfers", label: "Transfers", p: "STOCK_TRANSFERS:READ" },
    { href: "/customers", label: "Customers", p: "CUSTOMERS:READ" },
    { href: "/sales", label: "All sales", p: "SALES:READ" },
    { href: "/finance", label: "Close the day", p: "BRANCH_CLOSING:CREATE" },
    { href: "/dashboard", label: "Reports", p: "DASHBOARD:READ" },
    { href: "/settings", label: "Settings", p: "" },
  ].filter(m => !m.p || can(m.p));

  return (
    <div className="pos">
      {user && !user.demo && <IdleGuard onTimeout={timedOut} />}
      <header className="pos-top">
        <Link href="/dashboard" className="pos-logo" aria-label="WHOLESTRA dashboard"><LogoMark size={34} tone="dark" /><span>Counter</span></Link>
        {branches.length > 1
          ? <select className="pos-branch" value={branchId} onChange={e => setBranchId(e.target.value)} aria-label="Branch" disabled={cart.length > 0}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          : <span className="pos-branch fixed">{branchName}</span>}
        <div className="pos-views" role="tablist">
          <button type="button" role="tab" aria-selected={view === "sell"} className={view === "sell" ? "on" : ""} onClick={() => setView("sell")}>Sell</button>
          <button type="button" role="tab" aria-selected={view === "today"} className={view === "today" ? "on" : ""} onClick={() => setView("today")}>Today&apos;s sales</button>
        </div>
        <div className="pos-tools">
          <button type="button" className="pos-icon" onClick={openDisplay} title="Open the customer screen on a second display" aria-label="Open the customer screen">🖥<span>Customer screen</span></button>
          <div className="pos-more">
            <button type="button" className="pos-icon" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen} aria-haspopup="menu">☰<span>More</span></button>
            {moreOpen && <><div className="pos-scrim" onClick={() => setMoreOpen(false)} /><div className="pos-menu" role="menu">
              {MORE.map(m => <Link key={m.href} href={m.href} role="menuitem">{m.label}</Link>)}
              {can("BRANCHES:UPDATE") && <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setEditPay(true); }}>Mobile money details</button>}
              <button type="button" role="menuitem" onClick={toggle}>{theme === "light" ? "Dark mode" : "Light mode"}</button>
            </div></>}
          </div>
          <span className="pos-user" title={user.email}>{user.name.split(" ")[0]}</span>
        </div>
      </header>

      {error && <div className="pos-error" role="alert">{error}</div>}

      {view === "today" ? <TodaySales branchId={branchId} branchName={branchName} /> : (
      <div className={"pos-main" + (cartOpen ? " cart-open" : "")}>
        <section className="pos-shelf" aria-label="Products">
          <div className="pos-find">
            <input data-scan-passthrough="" className="pos-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search, or scan a barcode"
              onKeyDown={async e => { if (e.key === "Enter" && q.trim()) { e.preventDefault(); if (await scanned(q)) setQ(""); } }} aria-label="Search products or type a barcode" />
            <button type="button" className="pos-btn" onClick={() => setCamera(true)} title="Scan with the camera">📷<span className="pos-hide-s"> Camera</span></button>
          </div>
          <div className="pos-cats" role="tablist" aria-label="Categories">
            {cats.map(c => <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          {!products ? <div className="pos-wait">Loading products…</div>
            : shown.length === 0 ? <div className="pos-wait">{products.length ? "Nothing matches. Clear the search or pick another category." : "No products yet. Add products first, then they show here."}</div>
            : <div className="pos-grid">
                {shown.map(p => {
                  const inCart = cart.find(l => l.id === p.id)?.qty ?? 0;
                  const out = p.stockQuantity <= 0;
                  return (
                    <button key={p.id} type="button" className={"pos-card" + (out ? " out" : "")} onClick={() => add(p)} disabled={out} aria-label={`${p.name}, ${n2(p.unitPrice)}, ${out ? "out of stock" : `${p.stockQuantity} in stock`}`}>
                      <span className="pos-pic" style={p.imageThumb ? undefined : { background: tint(p.categoryRef?.name ?? p.name) }}>
                        {p.imageThumb ? <img src={p.imageThumb} alt="" /> : <b>{initials(p.name)}</b>}
                        {inCart > 0 && <i className="pos-badge">{inCart}</i>}
                      </span>
                      <span className="pos-name">{p.name}</span>
                      <span className="pos-row"><b className="pos-price">{n2(p.unitPrice)}</b><small className={out ? "bad" : p.stockQuantity <= 5 ? "low" : ""}>{out ? "Out" : `${p.stockQuantity} left`}</small></span>
                    </button>
                  );
                })}
              </div>}
        </section>

        <aside className="pos-cart" aria-label="Basket">
          <div className="pos-cart-head">
            <button type="button" className="pos-cust" onClick={() => setPickCustomer(true)}>👤 {customer ? customer.name : "Walk-in customer"}</button>
            {customer && <button type="button" className="pos-link" onClick={() => setCustomer(null)}>Remove</button>}
            <button type="button" className="pos-close-cart" onClick={() => setCartOpen(false)} aria-label="Back to products">✕</button>
          </div>
          {done ? (
            <div className="pos-done" role="status">
              <div className="pos-done-ic" aria-hidden="true">✓</div>
              <h2>Sale saved</h2>
              <p>Receipt <b>{done.invoice}</b> · {METHOD_LABEL[done.method]}</p>
              <p className="pos-done-total">GH₵ {n2(done.total)}</p>
              {done.change > 0 && <p className="pos-change">Give change: <b>GH₵ {n2(done.change)}</b></p>}
              <div className="pos-done-acts"><button type="button" className="pos-btn" onClick={() => printReceipt(done)}>🧾 Print receipt</button><button type="button" className="pos-btn primary" onClick={newSale} autoFocus>New sale</button></div>
            </div>
          ) : cart.length === 0 ? (
            <div className="pos-empty"><b>The basket is empty</b><p>Tap a product, scan its barcode, or use the camera.</p></div>
          ) : (
            <ul className="pos-lines">
              {cart.map(l => (
                <li key={l.id}>
                  <div className="pos-line-top"><span>{l.name}</span><b>{n2(l.qty * l.price)}</b></div>
                  <div className="pos-line-bot">
                    <small>{n2(l.price)} each</small>
                    <div className="pos-qty">
                      <button type="button" onClick={() => setQty(l.id, l.qty - 1)} aria-label={`One less ${l.name}`}>−</button>
                      <input type="number" inputMode="numeric" min={0} max={l.stock} value={l.qty} onChange={e => setQty(l.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))} aria-label={`Quantity of ${l.name}`} />
                      <button type="button" onClick={() => setQty(l.id, l.qty + 1)} disabled={l.qty >= l.stock} aria-label={`One more ${l.name}`}>+</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!done && <div className="pos-total">
            <div className="pos-sum"><span>{count} item{count === 1 ? "" : "s"}</span><span>Total</span></div>
            <div className="pos-big">GH₵ {n2(total)}</div>
            <div className="pos-pay">
              {(["CASH", "MOBILE_MONEY", "BANK"] as Method[]).map(m => <button key={m} type="button" className="pos-btn" disabled={!cart.length} onClick={() => setPay(m)}>{METHOD_LABEL[m]}</button>)}
              <button type="button" className="pos-btn" disabled={!cart.length || !customer} title={customer ? "" : "Choose a customer to sell on credit"} onClick={() => setPay("CREDIT")}>On credit</button>
            </div>
            <button type="button" className="pos-link pos-clear" disabled={!cart.length} onClick={() => setCart([])}>Clear basket</button>
          </div>}
        </aside>

        {!cartOpen && <button type="button" className="pos-cartbar" onClick={() => setCartOpen(true)}>
          <span>🛒 {count} item{count === 1 ? "" : "s"}</span><b>GH₵ {n2(total)}</b><span>View basket →</span>
        </button>}
      </div>)}

      {flash && <div className={"pos-flash" + (flash.bad ? " bad" : "")} role="status">{flash.text}</div>}
      {camera && <CameraScanner keepOpen title="Scan products" onScan={c => { void scanned(c); }} onClose={() => setCamera(false)} />}
      {pay && <PayDialog method={pay} total={total} info={payInfo} customer={customer} onCancel={() => setPay(null)} onDone={complete} />}
      {pickCustomer && <CustomerPicker onPick={c => { setCustomer(c); setPickCustomer(false); }} onClose={() => setPickCustomer(false)} canAdd={can("CUSTOMERS:CREATE")} />}
      {editPay && <PaymentSettings branchId={branchId} branchName={branchName} info={payInfo} onSaved={i => { setPayInfo(i); setEditPay(false); }} onClose={() => setEditPay(false)} />}
    </div>
  );
}

/** Taking the money: cash (with the change worked out), mobile money (with the branch's number and QR), bank, or credit. */
function PayDialog({ method, total, info, customer, onCancel, onDone }: {
  method: Method; total: number; info: Payment | null; customer: Customer | null; onCancel: () => void;
  onDone: (m: Method, reference: string, received: number) => Promise<void>;
}) {
  const [received, setReceived] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const got = Number(received) || 0;
  const quick = [...new Set([total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100])].filter(v => v >= total).slice(0, 4);
  const short = method === "CASH" && got < total - 0.005;
  async function go() {
    if (method === "CASH" && received && short) { setErr("The cash received is less than the total."); return; }
    setBusy(true); setErr("");
    try { await onDone(method, ref.trim(), method === "CASH" ? (got || total) : total); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "The sale could not be saved. Check your connection and try again."); setBusy(false); }
  }
  return (
    <div className="pos-dlg-back" onClick={onCancel}>
      <form className="pos-dlg" role="dialog" aria-modal="true" aria-labelledby="pay-h" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); void go(); }}>
        <h2 id="pay-h">{METHOD_LABEL[method]}</h2>
        <p className="pos-dlg-total">GH₵ {n2(total)}</p>
        {method === "CASH" && <>
          <label className="pos-lbl" htmlFor="rcv">Cash received</label>
          <input id="rcv" className="pos-input big" type="number" inputMode="decimal" step="0.01" min={0} value={received} onChange={e => setReceived(e.target.value)} placeholder={n2(total)} autoFocus />
          <div className="pos-quick">{quick.map(v => <button key={v} type="button" className="pos-btn" onClick={() => setReceived(String(v))}>{n2(v)}</button>)}</div>
          <p className="pos-change">{received && !short ? <>Change: <b>GH₵ {n2(got - total)}</b></> : received ? "Not enough yet" : "Leave empty if the exact amount was paid."}</p>
        </>}
        {method === "MOBILE_MONEY" && <>
          {info?.momoNumber || info?.momoQr || info?.momoMerchantId
            ? <div className="pos-momo">
                {info.momoQr && <img src={info.momoQr} alt="Mobile money QR code" />}
                <div>{info.momoMerchantId && <p>Merchant ID <b>{info.momoMerchantId}</b></p>}{info.momoNumber && <p>Number <b>{info.momoNumber}</b></p>}{info.momoName && <p>Name <b>{info.momoName}</b></p>}</div>
              </div>
            : <p className="pos-note">This branch has no mobile money details yet. The owner or manager can add them under More → Mobile money details.</p>}
          <label className="pos-lbl" htmlFor="mref">Transaction ID from the payment message</label>
          <input id="mref" className="pos-input" value={ref} onChange={e => setRef(e.target.value)} maxLength={60} placeholder="e.g. 61234567890" autoFocus />
          <p className="pos-note">Only press Paid once the money has arrived on the branch phone.</p>
        </>}
        {method === "BANK" && <>
          <label className="pos-lbl" htmlFor="bref">Bank reference</label>
          <input id="bref" className="pos-input" value={ref} onChange={e => setRef(e.target.value)} maxLength={60} autoFocus />
        </>}
        {method === "CREDIT" && <p className="pos-note"><b>{customer?.name}</b> takes the goods now and pays later. It is added to what they owe, within their credit limit.</p>}
        {err && <p className="pos-err" role="alert">{err}</p>}
        <div className="pos-dlg-acts">
          <button type="button" className="pos-btn" onClick={onCancel} disabled={busy}>Back</button>
          <button type="submit" className="pos-btn primary" disabled={busy}>{busy ? "Saving…" : method === "CREDIT" ? "Save on credit" : "Paid"}</button>
        </div>
      </form>
    </div>
  );
}

function CustomerPicker({ onPick, onClose, canAdd }: { onPick: (c: Customer) => void; onClose: () => void; canAdd: boolean }) {
  const [list, setList] = useState<Customer[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { api.get<Customer[]>("/customers").then(setList).catch(() => setList([])); }, []);
  const t = q.trim().toLowerCase();
  const shown = (list ?? []).filter(c => !t || c.name.toLowerCase().includes(t) || (c.phone ?? "").includes(t)).slice(0, 40);
  return (
    <div className="pos-dlg-back" onClick={onClose}>
      <div className="pos-dlg" role="dialog" aria-modal="true" aria-labelledby="cp-h" onClick={e => e.stopPropagation()}>
        <h2 id="cp-h">Choose a customer</h2>
        <input className="pos-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Name or phone" autoFocus aria-label="Search customers" />
        <ul className="pos-picks">
          {!list ? <li className="muted">Loading…</li> : shown.length === 0 ? <li className="muted">No customer matches.</li>
            : shown.map(c => <li key={c.id}><button type="button" onClick={() => onPick(c)}><b>{c.name}</b>{c.phone && <small>{c.phone}</small>}</button></li>)}
        </ul>
        <div className="pos-dlg-acts">{canAdd ? <Link href="/customers" className="pos-link">+ Add a new customer</Link> : <span />}<button type="button" className="pos-btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function PaymentSettings({ branchId, branchName, info, onSaved, onClose }: { branchId: string; branchName: string; info: Payment | null; onSaved: (i: Payment) => void; onClose: () => void }) {
  const [num, setNum] = useState(info?.momoNumber ?? "");
  const [name, setName] = useState(info?.momoName ?? "");
  const [mid, setMid] = useState(info?.momoMerchantId ?? "");
  const [qr, setQr] = useState(info?.momoQr ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setBusy(true); setErr("");
    try { onSaved(await api.put<Payment>(`/branches/${branchId}/payment`, { momoNumber: num, momoName: name, momoMerchantId: mid, momoQr: qr })); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not save."); setBusy(false); }
  }
  return (
    <div className="pos-dlg-back" onClick={onClose}>
      <form className="pos-dlg" role="dialog" aria-modal="true" aria-labelledby="ps-h" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); void save(); }}>
        <h2 id="ps-h">Mobile money for {branchName}</h2>
        <p className="pos-note">Shown to customers on the customer screen and when paying by mobile money.</p>
        <label className="pos-lbl" htmlFor="ps-n">Mobile money number</label><input id="ps-n" className="pos-input" value={num} onChange={e => setNum(e.target.value)} maxLength={30} inputMode="tel" placeholder="e.g. 024 000 0000" />
        <label className="pos-lbl" htmlFor="ps-name">Account name</label><input id="ps-name" className="pos-input" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
        <label className="pos-lbl" htmlFor="ps-m">Merchant ID</label><input id="ps-m" className="pos-input" value={mid} onChange={e => setMid(e.target.value)} maxLength={40} />
        <label className="pos-lbl" htmlFor="ps-q">QR code picture</label>
        <div className="pos-qr-row">{qr && <img src={qr} alt="Current QR code" />}<input id="ps-q" type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return;
          try { setQr(await shrinkImage(f, { maxSide: 700, maxChars: 190000 })); } catch (x) { setErr((x as Error).message); }
        }} />{qr && <button type="button" className="pos-link" onClick={() => setQr("")}>Remove</button>}</div>
        {err && <p className="pos-err" role="alert">{err}</p>}
        <div className="pos-dlg-acts"><button type="button" className="pos-btn" onClick={onClose}>Cancel</button><button type="submit" className="pos-btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
      </form>
    </div>
  );
}

/** Today's sales at this branch, newest first, with the day's total. Refreshes every 30 seconds. */
function TodaySales({ branchId, branchName }: { branchId: string; branchName: string }) {
  const [rows, setRows] = useState<SaleRow[] | null>(null);
  useEffect(() => {
    if (!branchId) return;
    const load = () => api.get<SaleRow[]>(`/sales?branchId=${branchId}`).then(all => {
      const d = new Date().toDateString();
      setRows(all.filter(s => new Date(s.soldAt).toDateString() === d).sort((a, b) => b.soldAt.localeCompare(a.soldAt)));
    }).catch(() => setRows([]));
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [branchId]);
  const live = (rows ?? []).filter(s => s.status !== "VOIDED");
  const sum = live.reduce((a, s) => a + Number(s.totalAmount), 0);
  const by = (m: string) => live.reduce((a, s) => a + s.payments.filter(p => p.method === m).reduce((x, p) => x + Number(p.amount), 0), 0);
  const credit = sum - by("CASH") - by("MOBILE_MONEY") - by("BANK");
  return (
    <section className="pos-today">
      <div className="pos-today-tiles">
        <div><small>Sold today at {branchName}</small><b>GH₵ {n2(sum)}</b><span>{live.length} sale{live.length === 1 ? "" : "s"}</span></div>
        <div><small>Cash</small><b>GH₵ {n2(by("CASH"))}</b></div>
        <div><small>Mobile money</small><b>GH₵ {n2(by("MOBILE_MONEY"))}</b></div>
        <div><small>Bank</small><b>GH₵ {n2(by("BANK"))}</b></div>
        <div><small>On credit</small><b>GH₵ {n2(Math.max(0, credit))}</b></div>
      </div>
      {!rows ? <div className="pos-wait">Loading…</div> : rows.length === 0 ? <div className="pos-wait">No sales yet today.</div> : (
        <ul className="pos-sales">
          {rows.map(s => (
            <li key={s.id} className={s.status === "VOIDED" ? "void" : ""}>
              <span className="t">{new Date(s.soldAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="w"><b>{s.invoiceNumber}</b><small>{s.customer?.name ?? "Walk-in"} · {s.items.reduce((a, i) => a + i.quantity, 0)} items · {s.user.name}</small></span>
              <span className="a">{s.status === "VOIDED" ? "Voided" : `GH₵ ${n2(s.totalAmount)}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
