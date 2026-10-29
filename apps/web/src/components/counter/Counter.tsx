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
import { qrSvgString } from "../../lib/barcode";
import { isNetworkError, newClientRef, newConfirmToken, offlineCache, QueuedSale, saleQueue } from "../../lib/offlineStore";
import "./counter.css";
import "../app-extra.css";

type Product = { id: string; sku: string; name: string; unitPrice: string | number; stockQuantity: number; imageThumb?: string | null; barcodes?: string[]; categoryRef?: { id: string; name: string } | null; unit?: { name: string } | null; trackItems?: boolean; item?: { code: string; status: string; here: boolean } };
type Branch = { id: string; name: string };
type Customer = { id: string; name: string; phone: string | null; code?: string };
type Payment = { momoNumber: string | null; momoName: string | null; momoMerchantId: string | null; momoQr: string | null };
type Brand = { name: string; logo: string | null; address: string | null; phone: string | null };
type SaleRow = { id: string; invoiceNumber: string; status: string; totalAmount: string; soldAt: string; customer: { name: string } | null; user: { name: string }; payments: { method: string; amount: string }[]; items: { quantity: number }[] };
type Method = "CASH" | "MOBILE_MONEY" | "BANK" | "CREDIT";
type Shift = { id: string; status: string; branch: string; cashier: string; openedAt: string; closedAt: string | null; openingFloat: number; elsewhere?: boolean;
  totals: { cash: number; momo: number; bank: number; credit: number; sales: number; voided: number; salesTotal: number }; expectedCash: number; countedCash: number | null; difference: number | null; caseOpened?: boolean };
type Done = { invoice: string; total: number; paid: number; change: number; method: Method; lines: Line[]; customer: string | null; when: string; confirmUrl?: string; /** saved on this device, to be sent when the internet is back */ offline?: boolean };

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
  // ---- working without internet: products, prices and item labels are kept on this device; sales wait here until they can be sent
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const itemCodes = useRef(new Map<string, string>());
  // ---- the cashier's shift: the cash in the drawer at the start, and the count at the end
  const [shift, setShift] = useState<Shift | null | undefined>(undefined);
  const [shiftDlg, setShiftDlg] = useState<"open" | "close" | null>(null);
  const chan = useRef<BroadcastChannel | null>(null);
  const can = (p: string) => !!user?.permissions.includes(p);

  // who is at the counter, and which branch
  useEffect(() => {
    const u = getSessionUser();
    if (!u) { router.replace(`/login?next=${encodeURIComponent("/counter")}`); return; }
    setUser(u);
    const who = u.id ?? u.email;
    const useBranches = (bs: Branch[]) => {
      setBranches(bs);
      let saved = ""; try { saved = localStorage.getItem("wms_counter_branch") ?? ""; } catch { /* ignore */ }
      setBranchId(bs.find(b => b.id === saved)?.id ?? bs[0]?.id ?? "");
    };
    api.get<Branch[]>("/branches?own=1").then(bs => { useBranches(bs); void offlineCache.set(`branches:${who}`, bs); })
      .catch(async e => {
        const kept = await offlineCache.get<Branch[]>(`branches:${who}`);
        if (kept?.length && isNetworkError(e)) { setOffline(true); useBranches(kept); }
        else setError("Could not load your branches. Check your connection and reload.");
      });
    api.get<Brand>("/organization/brand").then(b => { setBrand(b); void offlineCache.set("brand", b); }).catch(async () => { const b = await offlineCache.get<Brand>("brand"); if (b) setBrand(b); });
  }, [router]);

  // online / offline
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    if (typeof navigator !== "undefined" && navigator.onLine === false) setOffline(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const loadProducts = useCallback(() => {
    if (!branchId) return;
    api.get<Product[]>(`/products?branchId=${branchId}`).then(ps => { setProducts(ps); setError(""); setOffline(false); void offlineCache.set(`products:${branchId}`, ps); })
      .catch(async e => {
        const kept = await offlineCache.get<Product[]>(`products:${branchId}`);
        if (isNetworkError(e)) setOffline(true);
        if (kept) setProducts(cur => cur ?? kept); else setError("Could not load the products. Check your connection.");
      });
    // item labels on this branch's shelf, so labels can be scanned without internet
    api.get<[string, string][]>(`/tracking/codes?branchId=${branchId}`).then(rows => { itemCodes.current = new Map(rows); void offlineCache.set(`codes:${branchId}`, rows); })
      .catch(async () => { const rows = await offlineCache.get<[string, string][]>(`codes:${branchId}`); if (rows) itemCodes.current = new Map(rows); });
  }, [branchId]);
  useEffect(() => {
    if (!branchId) return;
    try { localStorage.setItem("wms_counter_branch", branchId); } catch { /* ignore */ }
    setProducts(null); setCart([]); loadProducts();
    api.get<Payment>(`/branches/${branchId}/payment`).then(i => { setPayInfo(i); void offlineCache.set(`payment:${branchId}`, i); })
      .catch(async () => setPayInfo((await offlineCache.get<Payment>(`payment:${branchId}`)) ?? null));
  }, [branchId, loadProducts]);
  const loadShift = useCallback(() => {
    if (!branchId) return;
    api.get<Shift | Record<string, never>>(`/shifts/current?branchId=${branchId}`).then(x => setShift("id" in x ? x as Shift : null)).catch(() => setShift(s => s ?? null));
  }, [branchId]);
  useEffect(() => { if (!offline) loadShift(); }, [loadShift, offline, done]);
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
    ? { type: "paid", invoice: done.invoice, total: done.total, paid: done.paid, change: done.change, method: done.method, confirmUrl: done.confirmUrl, items: done.lines.reduce((n, l) => n + l.qty, 0) }
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
  // tapping sets how many; scanning confirms them (a scan beyond the number adds one more)
  const add = useCallback((p: Product, qty = 1, code?: string, viaScan = false) => {
    if (done) { setDone(null); }
    setCart(c => {
      const have = c.find(l => l.id === p.id);
      const scanned = (have?.scanned ?? 0) + (viaScan ? 1 : 0);
      const next = viaScan ? Math.max(have?.qty ?? 0, scanned) : (have?.qty ?? 0) + qty;
      if (next > p.stockQuantity) { scanFeedback(false); say(p.stockQuantity <= 0 ? `${p.name} is out of stock at this branch` : `Only ${p.stockQuantity} ${p.name} in stock`, true); return c; }
      const codes = code ? [...(have?.codes ?? []), code] : have?.codes;
      const scannable = !!(p.barcodes?.length || p.trackItems);
      return have ? c.map(l => (l.id === p.id ? { ...l, qty: next, codes, scanned } : l)) : [...c, { id: p.id, name: p.name, price: Number(p.unitPrice), qty: next, stock: p.stockQuantity, codes, scanned, scannable }];
    });
  }, [done]);
  // fewer of a product: the last scans (and labels) come off too
  const setQty = (id: string, qty: number) => setCart(c => qty <= 0 ? c.filter(l => l.id !== id) : c.map(l => { if (l.id !== id) return l; const q = Math.min(qty, l.stock); return { ...l, qty: q, codes: l.codes?.slice(0, q), scanned: Math.min(l.scanned ?? 0, q) }; }));
  const unscanned = cart.reduce((s, l) => s + (l.scannable ? Math.max(0, l.qty - (l.scanned ?? 0)) : 0), 0);

  // ---- a scanned code: from a USB/Bluetooth scanner, the camera, or Enter in the search box
  const scanned = useCallback(async (raw: string) => {
    const code = raw.trim(); if (!code || !products) return false;
    // a WHOLESTRA item label: that exact item is sold, so its story ends at this sale
    if (/^W[2-9A-HJKMNP-Z]{9}$/i.test(code)) {
      const label = code.toUpperCase();
      if (cart.some(l => l.codes?.includes(label))) { scanFeedback(false); say(`Label ${label} is already in the basket.`, true); return false; }
      // without internet: the labels on this branch's shelf were saved on the device
      const local = () => { const pid = itemCodes.current.get(label); const p = pid ? products.find(x => x.id === pid) : undefined; return p; };
      if (offline) {
        const p = local();
        if (!p) { scanFeedback(false); say(`Label ${label} is not on this device's list. Sell it by tapping the product.`, true); return false; }
        scanFeedback(true); add(p, 1, label, true); say(`Scanned ${p.name} (${label})`); return true;
      }
      try {
        const found = await api.get<Product>(`/products/lookup?code=${encodeURIComponent(label)}&branchId=${branchId}`);
        if (found.item && (found.item.status !== "IN_STOCK" || !found.item.here)) { scanFeedback(false); say(found.item.status === "IN_STOCK" ? `This ${found.name} is recorded at another branch.` : `This ${found.name} is ${found.item.status.replace("_", " ").toLowerCase()}, so it cannot be sold.`, true); return false; }
        setProducts(ps => ps && !ps.some(x => x.id === found.id) ? [...ps, found] : ps);
        scanFeedback(true); add(found, 1, label, true); say(`Scanned ${found.name} (${label})`);
        return true;
      } catch (e) {
        if (isNetworkError(e)) { setOffline(true); const p = local(); if (p) { scanFeedback(true); add(p, 1, label, true); say(`Scanned ${p.name} (${label})`); return true; } }
        scanFeedback(false); say(`No item has the label ${label}.`, true); return false;
      }
    }
    let p = products.find(x => x.barcodes?.includes(code) || x.sku.toLowerCase() === code.toLowerCase());
    if (!p) {
      if (offline) { scanFeedback(false); say(`No product on this device has the barcode ${code}.`, true); return false; }
      try { const found = await api.get<Product>(`/products/lookup?code=${encodeURIComponent(code)}&branchId=${branchId}`); p = found; setProducts(ps => ps && !ps.some(x => x.id === found.id) ? [...ps, found] : ps); }
      catch (e) { if (isNetworkError(e)) setOffline(true); scanFeedback(false); say(isNetworkError(e) ? `No product on this device has the barcode ${code}.` : `No product has the barcode ${code}. Add it to the product first.`, true); return false; }
    }
    const line = cart.find(l => l.id === p!.id);
    if (p.trackItems) { scanFeedback(false); say(`${p.name} has a WHOLESTRA label on each item. Scan the item's own label.`, true); return false; }
    scanFeedback(true); add(p, 1, undefined, true);
    say(line && (line.scanned ?? 0) < line.qty ? `${p.name}: ${(line.scanned ?? 0) + 1} of ${line.qty} scanned` : `Scanned ${p.name}`);
    return true;
  }, [products, branchId, add, cart, offline]);
  useScanner(code => { void scanned(code); }, view === "sell" && !pay && !pickCustomer && !editPay && !camera);

  // ---- what shows in the grid
  const cats = useMemo(() => ["All", ...[...new Set((products ?? []).map(p => p.categoryRef?.name).filter(Boolean) as string[])].sort()], [products]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (products ?? []).filter(p => (cat === "All" || p.categoryRef?.name === cat) && (!t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || p.barcodes?.some(b => b.includes(t))));
  }, [products, cat, q]);

  // ---- paying
  async function complete(method: Method, reference: string, received: number, reason: string) {
    if (!user) return;
    const lines = cart.map(l => ({ productId: l.id, quantity: l.qty, unitPrice: l.price, scanned: Math.min(l.qty, l.scanned ?? 0), ...(l.codes?.length ? { itemCodes: l.codes } : {}) }));
    const payments = method === "CREDIT" ? [] : [{ method, amount: total, ...(reference ? { reference } : {}) }];
    // the sale's own id and QR code are made here, so a sale sent twice is saved once, and an offline receipt still has its QR
    const clientRef = newClientRef(), confirmToken = newConfirmToken(), now = new Date().toISOString();
    const body = { branchId, customerId: customer?.id, items: lines, payments, handover: "now", clientRef, confirmToken, ...(unscanned ? { reason } : {}) };
    const change = method === "CASH" ? round2(Math.max(0, received - total)) : 0;
    let sale: { invoiceNumber: string; soldAt: string; release: { confirmToken: string } | null } | null = null;
    if (!offline) {
      try { sale = await api.post("/sales", body); }
      catch (e) { if (!isNetworkError(e)) throw e; setOffline(true); }
    }
    if (!sale) {
      if (method === "CREDIT") throw new ApiError("Selling on credit needs the internet (to check what the customer owes). Take cash or mobile money, or wait for the connection.", 0);
      const offlineNumber = `OFF-${clientRef.slice(0, 6).toUpperCase()}`;
      await saleQueue.put({ clientRef, userId: user.id ?? user.email, userName: user.name, branchId, createdAt: now, offlineNumber, total, body: { ...body, offline: true, soldAt: now } });
      setQueue(await saleQueue.all());
      // take the items off this device's copy of the stock, so the counter does not sell what is no longer there
      setProducts(ps => ps && ps.map(p => { const l = cart.find(x => x.id === p.id); return l ? { ...p, stockQuantity: Math.max(0, p.stockQuantity - l.qty) } : p; }));
      setDone({ invoice: offlineNumber, total, paid: total, change, method, lines: cart, customer: customer?.name ?? null, when: now, confirmUrl: `${window.location.origin}/c/${confirmToken}`, offline: true });
      setPay(null); setCart([]); setCustomer(null); setCartOpen(true);
      return;
    }
    const confirmUrl = sale.release ? `${window.location.origin}/c/${sale.release.confirmToken}` : undefined;
    setDone({ invoice: sale.invoiceNumber, total, paid: method === "CREDIT" ? 0 : total, change, method, lines: cart, customer: customer?.name ?? null, when: sale.soldAt, confirmUrl });
    setPay(null); setCart([]); setCustomer(null); setCartOpen(true);
    loadProducts();
  }
  function newSale() { setDone(null); setCartOpen(false); }

  // ---- sending sales made offline, oldest first, as soon as the internet is back (each is saved once, whatever happens)
  const syncing = useRef(false);
  const sync = useCallback(async () => {
    if (syncing.current || !user) return;
    syncing.current = true;
    try {
      const all = (await saleQueue.all()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const me = user.id ?? user.email;
      let sent = 0;
      for (const q of all) {
        if (q.userId !== me || q.error) continue; // only the cashier who made a sale can send it (it is recorded in their name)
        try { await api.post("/sales", q.body); await saleQueue.remove(q.clientRef); sent++; }
        catch (e) {
          if (isNetworkError(e)) { setOffline(true); break; }
          await saleQueue.put({ ...q, error: e instanceof ApiError ? e.message : "The server refused this sale.", tries: (q.tries ?? 0) + 1 });
        }
      }
      if (sent) { setOffline(false); say(`${sent} offline sale${sent === 1 ? "" : "s"} sent.`); loadProducts(); }
      setQueue(await saleQueue.all());
    } finally { syncing.current = false; }
  }, [user, loadProducts]);
  useEffect(() => { void saleQueue.all().then(setQueue); }, []);
  useEffect(() => { if (!offline) void sync(); }, [offline, sync]);
  useEffect(() => {
    const t = setInterval(() => { if (queue.length && navigator.onLine !== false) void sync(); }, 30_000);
    return () => clearInterval(t);
  }, [queue.length, sync]);
  // while offline, look for the connection now and then (the browser's own signal is not always right)
  useEffect(() => {
    if (!offline) return;
    const t = setInterval(() => { if (navigator.onLine !== false) loadProducts(); }, 20_000);
    return () => clearInterval(t);
  }, [offline, loadProducts]);


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
      img{max-width:40mm;max-height:18mm;object-fit:contain}.q{margin:6px auto 0;width:110px}.q svg{display:block}
    </style></head><body>
      <div class="c">${brand?.logo && /^data:image\/(png|jpeg|webp);base64,/.test(brand.logo) ? `<img src="${brand.logo}" alt=""><br>` : ""}<h1>${esc(brand?.name || "WHOLESTRA")}</h1>
      <div class="m">${esc(branchName)}</div>${brand?.phone ? `<div class="m">${esc(brand.phone)}</div>` : ""}</div><hr>
      <div class="m">Receipt <b>${esc(d.invoice)}</b>${d.offline ? " (made offline, the invoice number follows)" : ""}</div><div class="m">${new Date(d.when).toLocaleString("en-GB")}</div>
      <div class="m">Served by ${esc(user?.name ?? "")}${d.customer ? ` · Customer: ${esc(d.customer)}` : ""}</div>
      <table>${rows}<tr class="t"><td>TOTAL</td><td class="r">${n2(d.total)}</td></tr></table>
      <div class="m">Paid by ${esc(METHOD_LABEL[d.method])}${d.method === "CREDIT" ? " (to pay later)" : ""}</div>
      ${d.change > 0 ? `<div class="m">Change: <b>${n2(d.change)}</b></div>` : ""}
      ${d.confirmUrl ? `<hr><div class="c"><b>Check your goods</b><br>Scan this with your phone camera to confirm you received all ${d.lines.reduce((n, l) => n + l.qty, 0)} item${d.lines.reduce((n, l) => n + l.qty, 0) === 1 ? "" : "s"}.<div class="q">${qrSvgString(d.confirmUrl, 110)}</div></div>` : ""}
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
      {/* no automatic sign-out while offline: signing back in needs the internet */}
      {user && !user.demo && !offline && <IdleGuard onTimeout={timedOut} />}
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
          {(offline || queue.length > 0) && <button type="button" className={"pos-net" + (offline ? " off" : "")} onClick={() => setShowQueue(true)} title="Sales saved on this device">
            {offline ? "Offline" : "Online"}{queue.length ? ` · ${queue.length} to send` : ""}</button>}
          <span className="pos-user" title={user.email}>{user.name.split(" ")[0]}</span>
        </div>
      </header>

      {error && <div className="pos-error" role="alert">{error}</div>}
      {!offline && !user.demo && shift === null && <div className="pos-shift-bar" role="status"><span><b>Start your shift.</b> Count the cash in the drawer first, so your till can be checked at the end.</span><button type="button" className="pos-btn primary" onClick={() => setShiftDlg("open")}>Start shift</button></div>}
      {!offline && shift?.elsewhere && <div className="pos-shift-bar" role="status"><span>Your shift is still open at <b>{shift.branch}</b>. End it there (Today&apos;s sales) before selling here.</span></div>}
      {offline && <div className="pos-offline" role="status"><b>No internet.</b> Keep selling: sales are saved on this device and sent by themselves when the connection is back. Do not clear this browser&apos;s data.</div>}

      {view === "today" ? <>{shift && !shift.elsewhere && <ShiftPanel shift={shift} onEnd={() => setShiftDlg("close")} />}<TodaySales branchId={branchId} branchName={branchName} /></> : (
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
              {done.offline && <p className="pos-offnote">Saved on this device. It is sent by itself when the internet is back.</p>}
              <p className="pos-done-total">GH₵ {n2(done.total)}</p>
              {done.change > 0 && <p className="pos-change">Give change: <b>GH₵ {n2(done.change)}</b></p>}
              {done.confirmUrl && <div className="pos-confirm-qr"><div dangerouslySetInnerHTML={{ __html: qrSvgString(done.confirmUrl, 132) }} /><p>The customer scans this (or the one on the receipt) to confirm they received everything.</p></div>}
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
                    <small>{n2(l.price)} each{l.scannable && <span className={"pos-scanchip" + ((l.scanned ?? 0) >= l.qty ? " ok" : "")}>{(l.scanned ?? 0) >= l.qty ? "✓ scanned" : `scan ${l.qty - (l.scanned ?? 0)} to confirm`}</span>}</small>
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
              <button type="button" className="pos-btn" disabled={!cart.length || !customer || offline} title={offline ? "Selling on credit needs the internet" : customer ? "" : "Choose a customer to sell on credit"} onClick={() => setPay("CREDIT")}>On credit</button>
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
      {shiftDlg && <ShiftDialog mode={shiftDlg} shift={shift ?? null} branchId={branchId} branchName={branchName} waiting={queue.filter(q => q.userId === (user.id ?? user.email)).length} brandName={brand?.name ?? ""}
        onClose={() => setShiftDlg(null)} onDone={x => { setShift(x); if (x === null) loadShift(); }} />}
      {showQueue && <QueueSheet queue={queue} me={user.id ?? user.email} offline={offline} onClose={() => setShowQueue(false)} onSend={() => void sync()}
        onRetry={async q => { await saleQueue.put({ ...q, error: undefined }); setQueue(await saleQueue.all()); void sync(); }} />}
      {pay && <PayDialog method={pay} total={total} info={payInfo} customer={customer} unscanned={unscanned} onCancel={() => setPay(null)} onDone={complete} />}
      {pickCustomer && <CustomerPicker onPick={c => { setCustomer(c); setPickCustomer(false); }} onClose={() => setPickCustomer(false)} canAdd={can("CUSTOMERS:CREATE")} />}
      {editPay && <PaymentSettings branchId={branchId} branchName={branchName} info={payInfo} onSaved={i => { setPayInfo(i); setEditPay(false); }} onClose={() => setEditPay(false)} />}
    </div>
  );
}

/** Taking the money: cash (with the change worked out), mobile money (with the branch's number and QR), bank, or credit. */
function PayDialog({ method, total, info, customer, unscanned, onCancel, onDone }: {
  method: Method; total: number; info: Payment | null; customer: Customer | null; unscanned: number; onCancel: () => void;
  onDone: (m: Method, reference: string, received: number, reason: string) => Promise<void>;
}) {
  const [received, setReceived] = useState("");
  const [ref, setRef] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const got = Number(received) || 0;
  const quick = [...new Set([total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100])].filter(v => v >= total).slice(0, 4);
  const short = method === "CASH" && got < total - 0.005;
  async function go() {
    if (method === "CASH" && received && short) { setErr("The cash received is less than the total."); return; }
    if (unscanned && why.trim().length < 5) { setErr("Go back and scan the items, or say why they cannot be scanned."); return; }
    setBusy(true); setErr("");
    try { await onDone(method, ref.trim(), method === "CASH" ? (got || total) : total, why.trim()); }
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
        {unscanned > 0 && <div className="pos-unscanned">
          <b>{unscanned} item{unscanned === 1 ? " was" : "s were"} not scanned.</b> Go back and scan {unscanned === 1 ? "it" : "them"}, or say why. The manager will be asked to check.
          <input className="pos-input" value={why} onChange={e => setWhy(e.target.value)} maxLength={300} placeholder="For example: barcode torn" aria-label="Why the items were not scanned" />
        </div>}
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

/** Sales made offline that are still on this device: what each is, and why one could not be sent. */
function QueueSheet({ queue, me, offline, onClose, onSend, onRetry }: { queue: QueuedSale[]; me: string; offline: boolean; onClose: () => void; onSend: () => void; onRetry: (q: QueuedSale) => void }) {
  const mine = queue.filter(q => q.userId === me), others = queue.filter(q => q.userId !== me);
  return (
    <div className="pos-dlg-back" onClick={onClose}>
      <div className="pos-dlg" role="dialog" aria-modal="true" aria-labelledby="q-h" onClick={e => e.stopPropagation()}>
        <h2 id="q-h">Sales waiting to be sent</h2>
        {queue.length === 0 ? <p className="pos-note">Nothing is waiting. Every sale has been sent.</p> : <>
          <p className="pos-note">{offline ? "There is no internet. These sales are safe on this device and go out by themselves when the connection is back." : "These are being sent now."}</p>
          <ul className="pos-queue">{mine.map(q => (
            <li key={q.clientRef} className={q.error ? "bad" : ""}>
              <div><b>{q.offlineNumber}</b><span>{new Date(q.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · GH₵ {n2(q.total)}</span></div>
              {q.error ? <><small>Not accepted: {q.error}</small><button type="button" className="pos-btn" onClick={() => onRetry(q)}>Try again</button></> : <small>Waiting</small>}
            </li>
          ))}</ul>
          {others.length > 0 && <p className="pos-note">{others.length} sale{others.length === 1 ? "" : "s"} made by {[...new Set(others.map(o => o.userName))].join(", ")} on this device: {others.length === 1 ? "it is" : "they are"} sent when that person signs in here.</p>}
          {mine.some(q => q.error) && <p className="pos-note">A sale that was not accepted stays here. Show it to your manager: the money was taken, so it must be recorded.</p>}
        </>}
        <div className="pos-dlg-acts"><button type="button" className="pos-btn" onClick={onClose}>Close</button>{!offline && mine.length > 0 && <button type="button" className="pos-btn primary" onClick={onSend}>Send now</button>}</div>
      </div>
    </div>
  );
}

/** The cashier's shift so far: what the drawer should hold now. */
function ShiftPanel({ shift, onEnd }: { shift: Shift; onEnd: () => void }) {
  return (
    <div className="pos-shift">
      <div><span>Shift started</span><b>{new Date(shift.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</b></div>
      <div><span>Float</span><b>{n2(shift.openingFloat)}</b></div>
      <div><span>Cash taken</span><b>{n2(shift.totals.cash)}</b></div>
      <div><span>Mobile money</span><b>{n2(shift.totals.momo)}</b></div>
      <div><span>Bank</span><b>{n2(shift.totals.bank)}</b></div>
      <div className="big"><span>Drawer should hold</span><b>GH₵ {n2(shift.expectedCash)}</b></div>
      <button type="button" className="pos-btn primary" onClick={onEnd}>End shift</button>
    </div>
  );
}

/** Starting a shift (count the float) or ending it (count the drawer). The result can be printed for the manager. */
function ShiftDialog({ mode, shift, branchId, branchName, waiting, brandName, onClose, onDone }: {
  mode: "open" | "close"; shift: Shift | null; branchId: string; branchName: string; waiting: number; brandName: string; onClose: () => void; onDone: (s: Shift | null) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<Shift | null>(null);
  async function go() {
    setBusy(true); setErr("");
    try {
      if (mode === "open") { onDone(await api.post<Shift>("/shifts", { branchId, openingFloat: Number(amount) || 0 })); onClose(); }
      else { const r = await api.post<Shift>(`/shifts/${shift!.id}/close`, { countedCash: Number(amount), note: note.trim() || undefined }); setResult(r); onDone(null); }
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not save. Check your connection."); }
    finally { setBusy(false); }
  }
  function print(r: Shift) {
    const w = window.open("", "_blank", "width=420,height=640"); if (!w) return;
    const row = (k: string, v: string) => `<tr><td>${k}</td><td class="r">${v}</td></tr>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Shift report</title><style>@page{size:80mm auto;margin:4mm}body{font-family:Arial,sans-serif;font-size:12px;width:72mm;margin:0}h1{font-size:15px;margin:0}table{width:100%;border-collapse:collapse;margin:8px 0}td{padding:3px 0;border-bottom:1px dashed #bbb}.r{text-align:right}.b td{font-weight:700;font-size:14px;border:0}</style></head><body>
      <h1>${brandName || "WHOLESTRA"}</h1><div>${branchName} · shift report</div><div>${r.cashier}</div>
      <div>${new Date(r.openedAt).toLocaleString("en-GB")} to ${r.closedAt ? new Date(r.closedAt).toLocaleString("en-GB") : ""}</div>
      <table>${row("Sales", `${r.totals.sales} · ${n2(r.totals.salesTotal)}`)}${row("Float", n2(r.openingFloat))}${row("Cash taken", n2(r.totals.cash))}${row("Mobile money", n2(r.totals.momo))}${row("Bank", n2(r.totals.bank))}${row("On credit", n2(r.totals.credit))}${row("Cash expected", n2(r.expectedCash))}${row("Cash counted", n2(r.countedCash ?? 0))}<tr class="b"><td>Difference</td><td class="r">${n2(r.difference ?? 0)}</td></tr></table>
      <div>Cashier: ____________</div><br><div>Manager: ____________</div><script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>`);
    w.document.close();
  }
  if (result) return (
    <div className="pos-dlg-back" onClick={onClose}>
      <div className="pos-dlg" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h2>Shift ended</h2>
        <p className="pos-dlg-total">{result.difference === 0 ? "The cash matches ✓" : `${(result.difference ?? 0) < 0 ? "Short" : "Over"} by GH₵ ${n2(Math.abs(result.difference ?? 0))}`}</p>
        <p className="pos-note">Expected GH₵ {n2(result.expectedCash)} · counted GH₵ {n2(result.countedCash ?? 0)}{result.caseOpened ? ". Your manager will look at the difference." : "."}</p>
        <div className="pos-dlg-acts"><button type="button" className="pos-btn" onClick={() => print(result)}>Print shift report</button><button type="button" className="pos-btn primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
  return (
    <div className="pos-dlg-back" onClick={onClose}>
      <form className="pos-dlg" role="dialog" aria-modal="true" aria-labelledby="sh-h" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); void go(); }}>
        <h2 id="sh-h">{mode === "open" ? "Start your shift" : "End your shift"}</h2>
        {mode === "open"
          ? <p className="pos-note">Count the cash in the drawer now (the float for change). At the end of your shift you count again: the drawer should then hold the float plus the cash you took.</p>
          : <p className="pos-note">Count all the cash in the drawer. It should be GH₵ <b>{n2(shift?.expectedCash ?? 0)}</b>. Type what you actually count, not what it should be.</p>}
        {mode === "close" && waiting > 0 && <p className="pos-err">{waiting} sale{waiting === 1 ? " made" : "s made"} offline {waiting === 1 ? "has" : "have"} not been sent yet. Wait for the internet so {waiting === 1 ? "it is" : "they are"} counted in this shift.</p>}
        <label className="pos-lbl" htmlFor="sh-amt">{mode === "open" ? "Cash in the drawer (float)" : "Cash counted"}</label>
        <input id="sh-amt" className="pos-input big" type="number" inputMode="decimal" step="0.01" min={0} value={amount} onChange={e => setAmount(e.target.value)} required autoFocus placeholder="0.00" />
        {mode === "close" && <input className="pos-input" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Note for the manager (optional)" aria-label="Note" />}
        {err && <p className="pos-err" role="alert">{err}</p>}
        <div className="pos-dlg-acts"><button type="button" className="pos-btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="pos-btn primary" disabled={busy || amount === "" || (mode === "close" && waiting > 0)}>{busy ? "Saving…" : mode === "open" ? "Start shift" : "End shift"}</button></div>
      </form>
    </div>
  );
}
