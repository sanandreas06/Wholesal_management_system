'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { toast } from "../lib/toast";
import { exportCsv } from "../lib/exportCsv";
import SavedViews from "./SavedViews";
import { usePermissions } from "../hooks/usePermissions";
import { usePolling } from "../hooks/usePolling";

interface Ref { id: string; name: string }
interface ProductRef { id: string; name: string; sku: string; unitPrice?: number | string }
interface CustomerRef { id: string; name: string; creditLimit?: number | string | null }
interface SaleItem { id: string; productId: string; quantity: number; unitPrice: string; lineTotal: string; product: ProductRef }
interface Payment { id: string; method: string; amount: string; reference: string | null; receivedAt: string }
interface SaleReturn { id: string; reason: string; createdAt: string; items: { saleItemId: string; quantity: number }[] }
interface Sale {
  id: string; invoiceNumber: string; status: "COMPLETED" | "VOIDED"; totalAmount: string; soldAt: string;
  branch: Ref; customer: CustomerRef | null; user: Ref; items: SaleItem[]; payments: Payment[]; returns: SaleReturn[];
}

const METHODS = [["CASH", "Cash"], ["BANK", "Bank"], ["MOBILE_MONEY", "Mobile money"], ["CREDIT", "Credit"]];
const money = (n: number | string) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const paidOf = (s: Sale) => s.payments.reduce((a, p) => a + Number(p.amount), 0);
const balanceOf = (s: Sale) => Math.max(0, Number(s.totalAmount) - paidOf(s));
function payState(s: Sale): [string, string] {
  if (s.status === "VOIDED") return ["Voided", "inactive"];
  const b = balanceOf(s);
  if (b <= 0.005) return ["Paid", "active"];
  return paidOf(s) > 0 ? ["Partial", "medium"] : ["Unpaid", "high"];
}

export default function SalesManager() {
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [customers, setCustomers] = useState<CustomerRef[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [fBranch, setFBranch] = useState("");
  const [fProduct, setFProduct] = useState("");
  const [fUser, setFUser] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fDate, setFDate] = useState("");
  const [openId, setOpenId] = useState("");
  const [canCreate, canUpdate, canPay, canReturn] = usePermissions("SALES:CREATE", "SALES:UPDATE", "PAYMENTS:CREATE", "RETURNS:CREATE");

  function load() {
    api.get<Sale[]>("/sales").then(setSales).catch(e => setError(e.message));
  }
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFBranch(q.get("branchId") ?? ""); setFProduct(q.get("productId") ?? "");
    setFUser(q.get("userId") ?? ""); setFStatus(q.get("status") ?? ""); setOpenId(q.get("open") ?? ""); setFDate(q.get("date") ?? "");
    if (q.get("new") === "1") setCreating(true);
    load();
    api.get<Ref[]>("/branches?own=1").then(setBranches).catch(() => {});
    api.get<ProductRef[]>("/products").then(setProducts).catch(() => {});
    api.get<CustomerRef[]>("/customers").then(setCustomers).catch(() => {});
  }, []);
  usePolling(load, 10000);

  function updated(s: Sale) { setViewing(s); load(); }

  // open a specific sale once when arriving from a link (e.g. the dashboard)
  useEffect(() => {
    if (!openId || !sales) return;
    const hit = sales.find(x => x.id === openId);
    if (hit) setViewing(hit);
    setOpenId("");
  }, [openId, sales]);

  const shown = (sales ?? []).filter(x =>
    (!fBranch || x.branch.id === fBranch) &&
    (!fProduct || x.items.some(i => i.productId === fProduct)) &&
    (!fUser || x.user.id === fUser) &&
    (!fDate || x.soldAt.slice(0, 10) === fDate) &&
    (!fStatus || (fStatus === "unpaid" ? x.status === "COMPLETED" && balanceOf(x) > 0.005 : x.status === fStatus.toUpperCase())));
  const productName = products.find(p => p.id === fProduct)?.name ?? (sales ?? []).flatMap(x => x.items).find(i => i.productId === fProduct)?.product.name ?? "product";
  const userName = (sales ?? []).find(x => x.user.id === fUser)?.user.name ?? "user";
  const chips: [string, () => void][] = [];
  if (fBranch) chips.push([`Branch: ${branches.find(b => b.id === fBranch)?.name ?? "…"}`, () => setFBranch("")]);
  if (fProduct) chips.push([`Product: ${productName}`, () => setFProduct("")]);
  if (fUser) chips.push([`Served by: ${userName}`, () => setFUser("")]);
  if (fDate) chips.push([`Day: ${new Date(fDate + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`, () => setFDate("")]);
  if (fStatus) chips.push([fStatus === "unpaid" ? "Unpaid or part-paid" : `Status: ${fStatus}`, () => setFStatus("")]);

  return (
    <AppShell title="Sales">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{sales ? `${shown.length} sale${shown.length === 1 ? "" : "s"}${chips.length ? ` of ${sales.length}` : ""}` : "Loading..."}</p>
        <div className="toolbar-right">
          <SavedViews storageKey="sales" current={{ fBranch, fProduct, fUser, fStatus, fDate }} onApply={v => { setFBranch(v.fBranch); setFProduct(v.fProduct); setFUser(v.fUser); setFStatus(v.fStatus); setFDate(v.fDate); }} />
          <button type="button" className="secondary" disabled={!shown.length} onClick={() => exportCsv("sales", [
            { header: "Invoice", value: s => s.invoiceNumber }, { header: "Date", value: s => new Date(s.soldAt).toLocaleString() },
            { header: "Branch", value: s => s.branch.name }, { header: "Customer", value: s => s.customer?.name ?? "Walk-in" },
            { header: "Served by", value: s => s.user.name }, { header: "Total", value: s => Number(s.totalAmount) },
            { header: "Paid", value: s => paidOf(s) }, { header: "Balance", value: s => (s.status === "VOIDED" ? 0 : balanceOf(s)) }, { header: "Status", value: s => s.status },
          ], shown)}>Export CSV</button>
          {canCreate && <button onClick={() => setCreating(true)}>+ New Sale</button>}
        </div>
      </div>
      {chips.length > 0 && (
        <div className="chips">
          {chips.map(([t, clear]) => <button key={t} type="button" className="chip" onClick={clear}>{t} &times;</button>)}
        </div>
      )}
      <div className="table-wrap">
        {sales && shown.length === 0 && <div className="empty">{sales.length === 0 ? "No sales yet." : "No sales match these filters."}</div>}
        {sales && shown.length > 0 && (
          <table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Branch</th><th>Customer</th><th>Total</th><th>Balance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {shown.map(s => {
                const [label, cls] = payState(s);
                return (
                  <tr key={s.id}>
                    <td>{s.invoiceNumber}</td>
                    <td>{new Date(s.soldAt).toLocaleDateString()}</td>
                    <td>{s.branch.name}</td>
                    <td>{s.customer?.name || <span className="muted">Walk-in</span>}</td>
                    <td>{money(s.totalAmount)}</td>
                    <td>{s.status === "VOIDED" ? "—" : money(balanceOf(s))}</td>
                    <td><span className={`badge ${cls}`}>{label}</span></td>
                    <td className="row-actions"><button className="secondary" onClick={() => setViewing(s)}>View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {creating && <CreateSaleModal branches={branches} products={products} customers={customers} canPay={canPay}
        onClose={() => setCreating(false)} onSaved={s => { setCreating(false); load(); setViewing(s); toast.success(`Invoice ${s.invoiceNumber} created`); }} />}
      {viewing && <SaleDetailModal sale={viewing} canUpdate={canUpdate} canPay={canPay} canReturn={canReturn}
        onClose={() => setViewing(null)} onUpdated={updated}
        onFilterProduct={id => { setFProduct(id); setViewing(null); }} onFilterUser={id => { setFUser(id); setViewing(null); }} />}
    </AppShell>
  );
}

function CreateSaleModal({ branches, products, customers, canPay, onClose, onSaved }: {
  branches: Ref[]; products: ProductRef[]; customers: CustomerRef[]; canPay: boolean; onClose: () => void; onSaved: (s: Sale) => void;
}) {
  const blank = () => ({ productId: "", quantity: "1", unitPrice: "" });
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<{ productId: string; quantity: string; unitPrice: string }[]>([blank()]);
  const [payNow, setPayNow] = useState(false);
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [stock, setStock] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!branchId) { setStock({}); return; }
    api.get<{ productId: string; quantity: number }[]>("/inventory").then(rows => {
      const m: Record<string, number> = {};
      rows.forEach((r: any) => { if (r.branchId === branchId) m[r.productId] = r.quantity; });
      setStock(m);
    }).catch(() => {});
  }, [branchId]);

  const lineTotal = (l: { quantity: string; unitPrice: string }) => (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
  const total = lines.reduce((a, l) => a + lineTotal(l), 0);
  const units = lines.reduce((a, l) => a + (l.productId ? Number(l.quantity) || 0 : 0), 0);
  const customer = customers.find(c => c.id === customerId);
  const paying = payNow && canPay ? Number(amount) || 0 : 0;
  const balance = Math.max(0, total - paying);
  const overLimit = customer?.creditLimit != null && balance > Number(customer.creditLimit);
  const short = lines.filter(l => l.productId && branchId && (Number(l.quantity) || 0) > (stock[l.productId] ?? 0));

  function updateLine(i: number, patch: Partial<{ productId: string; quantity: string; unitPrice: string }>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find(x => x.id === productId);
    updateLine(i, { productId, unitPrice: p?.unitPrice != null ? String(Number(p.unitPrice)) : "" });
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const items = lines.filter(l => l.productId).map(l => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }));
    if (items.length === 0) { setError("Add at least one product"); setSaving(false); return; }
    try {
      let sale = await api.post<Sale>("/sales", { branchId, customerId: customerId || undefined, items });
      if (payNow && canPay && Number(amount) > 0) {
        try { sale = await api.post<Sale>(`/sales/${sale.id}/payments`, { method, amount: Number(amount) }); }
        catch (pe) { toast.error(`Sale ${sale.invoiceNumber} was created, but the payment failed: ${pe instanceof ApiError ? pe.message : "error"}`); }
      }
      onSaved(sale);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sale-modal" onClick={e => e.stopPropagation()}>
        <div className="pm-head">
          <div><h2>New Sale</h2><p className="field-hint">Pick a branch, add the items sold, then record any payment.</p></div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={submit} className="sale-form">
          <div className="sale-body">
            <div className="sale-main">
              <div className="form-grid">
                <label>Branch
                  <select value={branchId} onChange={e => setBranchId(e.target.value)} required>
                    <option value="">Select branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
                <label>Customer
                  <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
                    <option value="">Walk-in customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.creditLimit != null ? ` (limit ${money(c.creditLimit)})` : ""}</option>)}
                  </select>
                </label>
              </div>

              <div className="sale-lines">
                <div className="sale-line sale-line-head"><span>Product</span><span>Qty</span><span>Price</span><span>Amount</span><span /></div>
                {lines.map((l, i) => {
                  const avail = l.productId && branchId ? (stock[l.productId] ?? 0) : null;
                  const over = avail !== null && (Number(l.quantity) || 0) > avail;
                  return (
                    <div key={i} className="sale-line-wrap">
                      <div className="sale-line">
                        <select value={l.productId} onChange={e => pickProduct(i, e.target.value)} required aria-label="Product">
                          <option value="">Select product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
                        <input type="number" min="1" value={l.quantity} onChange={e => updateLine(i, { quantity: e.target.value })} required aria-label="Quantity" />
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={l.unitPrice} onChange={e => updateLine(i, { unitPrice: e.target.value })} required aria-label="Unit price" />
                        <span className="sale-amt">{money(lineTotal(l))}</span>
                        <button type="button" className="sale-x" disabled={lines.length === 1} onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} aria-label="Remove line">&times;</button>
                      </div>
                      {avail !== null && <div className={"sale-stock" + (over ? " over" : avail <= 5 ? " low" : "")}>{over ? `Only ${avail} in stock at this branch` : `${avail} in stock at this branch`}</div>}
                    </div>
                  );
                })}
                <button type="button" className="secondary sale-add" onClick={() => setLines(prev => [...prev, blank()])}>+ Add item</button>
              </div>
            </div>

            <aside className="sale-side">
              <h3>Summary</h3>
              <div className="sale-sum"><span>Items</span><strong>{lines.filter(l => l.productId).length} ({units} units)</strong></div>
              <div className="sale-sum total"><span>Total</span><strong>{money(total)}</strong></div>
              {canPay && (
                <div className="sale-pay">
                  <label className="checkbox-row"><input type="checkbox" checked={payNow} onChange={e => { setPayNow(e.target.checked); if (e.target.checked && !amount) setAmount(total ? String(total) : ""); }} /> Record a payment now</label>
                  {payNow && (
                    <>
                      <select value={method} onChange={e => setMethod(e.target.value)}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                      <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
                      <button type="button" className="link-btn" onClick={() => setAmount(String(total))}>Pay full amount</button>
                    </>
                  )}
                </div>
              )}
              <div className="sale-sum"><span>Paid now</span><strong>{money(paying)}</strong></div>
              <div className={"sale-sum bal" + (balance > 0 ? " due" : "")}><span>Balance on account</span><strong>{money(balance)}</strong></div>
              {overLimit && customer && <div className="sale-warn">This balance is above {customer.name}&rsquo;s credit limit of {money(customer.creditLimit as number)}.</div>}
              {short.length > 0 && <div className="sale-warn">{short.length} line{short.length === 1 ? "" : "s"} exceed{short.length === 1 ? "s" : ""} available stock and may be rejected.</div>}
              {!payNow && <p className="field-hint">Without a payment, the full amount stays open as a balance for the customer.</p>}
            </aside>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="pm-foot">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Saving..." : `Complete Sale · ${money(total)}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TrailEvent { at: string; kind: string; text: string; by: string }
function SaleDetailModal({ sale, canUpdate, canPay, canReturn, onClose, onUpdated, onFilterProduct, onFilterUser }: {
  sale: Sale; canUpdate: boolean; canPay: boolean; canReturn: boolean; onClose: () => void; onUpdated: (s: Sale) => void;
  onFilterProduct: (id: string) => void; onFilterUser: (id: string) => void;
}) {
  const [trail, setTrail] = useState<TrailEvent[] | null>(null);
  const trailKey = `${sale.id}:${sale.payments.length}:${sale.returns.length}:${sale.status}`;
  useEffect(() => { api.get<TrailEvent[]>(`/sales/${sale.id}/audit`).then(setTrail).catch(() => setTrail([])); }, [trailKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const voided = sale.status === "VOIDED";
  const balance = balanceOf(sale);
  const returnedQty = (itemId: string) => sale.returns.reduce((a, r) => a + r.items.filter(i => i.saleItemId === itemId).reduce((x, i) => x + i.quantity, 0), 0);

  async function run(fn: () => Promise<Sale>) {
    setBusy(true); setError("");
    try { const s = await fn(); onUpdated(s); return true; }
    catch (e) { setError(e instanceof ApiError ? e.message : "Action failed"); return false; }
    finally { setBusy(false); }
  }
  async function pay(e: FormEvent) {
    e.preventDefault();
    if (await run(() => api.post<Sale>(`/sales/${sale.id}/payments`, { method, amount: Number(amount), reference: reference || undefined }))) { setAmount(""); setReference(""); }
  }
  async function submitReturn(e: FormEvent) {
    e.preventDefault();
    const items = Object.entries(qtys).filter(([, q]) => Number(q) > 0).map(([saleItemId, q]) => ({ saleItemId, quantity: Number(q) }));
    if (items.length === 0) { setError("Enter a quantity to return"); return; }
    if (await run(() => api.post<Sale>(`/sales/${sale.id}/returns`, { reason, items }))) { setReturning(false); setReason(""); setQtys({}); }
  }
  function voidSale() {
    if (!confirm(`Void ${sale.invoiceNumber}? Stock will be restored.`)) return;
    run(() => api.patch<Sale>(`/sales/${sale.id}/void`));
  }
  function printInvoice() {
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) { toast.error("Your browser blocked the invoice window. Allow pop-ups for this site and try again."); return; }
    const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    const rows = sale.items.map(i => `<tr><td>${esc(i.product.name)}<small>${esc(i.product.sku)}</small></td><td class="r">${i.quantity}</td><td class="r">${money(i.unitPrice)}</td><td class="r">${money(i.lineTotal)}</td></tr>`).join("");
    const pays = sale.payments.map(p => `<tr><td>${new Date(p.receivedAt).toLocaleDateString()}</td><td>${esc(p.method.replace("_", " "))}</td><td class="r">${money(p.amount)}</td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.invoiceNumber)}</title><style>
      @page{margin:16mm}*{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a2332;margin:0;padding:8px;font-size:13px}
      .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2563eb;padding-bottom:14px}
      .brand{font-size:22px;font-weight:800;color:#2563eb}.brand small{display:block;font-size:11px;color:#6b7280;font-weight:500}
      h1{margin:0;font-size:26px;text-align:right}.top .r small{display:block;color:#6b7280;font-weight:500}
      .void{color:#b42318;border:2px solid #b42318;display:inline-block;padding:2px 10px;font-weight:800;margin-top:6px;transform:rotate(-4deg)}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 30px;margin:18px 0}.meta b{display:block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280}
      table{width:100%;border-collapse:collapse;margin-top:6px}th{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;text-align:left;padding:8px;border-bottom:2px solid #e5e7eb}
      td{padding:9px 8px;border-bottom:1px solid #eef0f3}td small{display:block;color:#9ca3af;font-size:11px}.r{text-align:right}
      .tot{margin-left:auto;width:260px;margin-top:14px}.tot div{display:flex;justify-content:space-between;padding:5px 0}.tot .g{border-top:2px solid #1a2332;font-size:16px;font-weight:800;padding-top:9px;margin-top:4px}
      .due{color:#b45309;font-weight:700}h3{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin:22px 0 4px}
      .foot{margin-top:34px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;text-align:center}
      .hint{background:#eff6ff;color:#1e40af;padding:8px 12px;border-radius:8px;margin-bottom:14px;font-size:12px}@media print{.hint{display:none}}
    </style></head><body>
      <div class="hint">To save as a PDF, choose <b>Save as PDF</b> as the printer in the window that opens.</div>
      <div class="top"><div class="brand">WholesalePro<small>Management System</small></div><div class="r"><h1>INVOICE</h1><small>${esc(sale.invoiceNumber)}</small>${voided ? '<div class="void">VOIDED</div>' : ""}</div></div>
      <div class="meta"><div><b>Billed to</b>${esc(sale.customer?.name || "Walk-in customer")}</div><div><b>Date</b>${new Date(sale.soldAt).toLocaleString()}</div>
      <div><b>Branch</b>${esc(sale.branch.name)}</div><div><b>Served by</b>${esc(sale.user.name)}</div></div>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><div class="g"><span>Total</span><span>${money(sale.totalAmount)}</span></div><div><span>Paid</span><span>${money(paidOf(sale))}</span></div><div class="${balance > 0.005 && !voided ? "due" : ""}"><span>Balance due</span><span>${voided ? money(0) : money(balance)}</span></div></div>
      ${pays ? `<h3>Payments received</h3><table><tbody>${pays}</tbody></table>` : ""}
      <div class="foot">Thank you for your business.</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`);
    w.document.close();
  }

  const [label, cls] = payState(sale);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{sale.invoiceNumber} <span className={`badge ${cls}`}>{label}</span></h2>
        <p className="muted">{sale.branch.name} · {sale.customer?.name || "Walk-in"} · {new Date(sale.soldAt).toLocaleString()} · by <a href="#" className="drill" onClick={e => { e.preventDefault(); onFilterUser(sale.user.id); }}>{sale.user.name}</a></p>

        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th>Returned</th></tr></thead>
            <tbody>
              {sale.items.map(i => (
                <tr key={i.id}>
                  <td><a href="#" className="drill" onClick={e => { e.preventDefault(); onFilterProduct(i.productId); }}>{i.product.name}</a> <span className="muted">({i.product.sku})</span></td>
                  <td>{i.quantity}</td><td>{money(i.unitPrice)}</td><td>{money(i.lineTotal)}</td>
                  <td>{returning ? (
                    <input type="number" min="0" max={i.quantity - returnedQty(i.id)} value={qtys[i.id] || ""} placeholder={`max ${i.quantity - returnedQty(i.id)}`}
                      onChange={e => setQtys(p => ({ ...p, [i.id]: e.target.value }))} style={{ width: 90 }} />
                  ) : returnedQty(i.id) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p><strong>Total {money(sale.totalAmount)}</strong> · Paid {money(paidOf(sale))} · Balance {voided ? "—" : money(balance)}</p>

        <h3 style={{ fontSize: 14, margin: "18px 0 8px" }}>Audit trail</h3>
        {trail === null ? <p className="muted">Loading...</p> : (
          <ul className="trail">
            {trail.map((t, i) => (
              <li key={i}><span className="trail-when">{new Date(t.at).toLocaleString()}</span><span className="trail-text">{t.text}</span><span className="muted">{t.by}</span></li>
            ))}
          </ul>
        )}

        <h3>Payments</h3>
        {sale.payments.length === 0 ? <p className="muted">No payments recorded.</p> : (
          <div className="table-wrap" style={{ marginBottom: 12 }}><table>
            <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead>
            <tbody>{sale.payments.map(p => <tr key={p.id}><td>{new Date(p.receivedAt).toLocaleString()}</td><td>{p.method.replace("_", " ")}</td><td>{p.reference || "—"}</td><td>{money(p.amount)}</td></tr>)}</tbody>
          </table></div>
        )}
        {canPay && !voided && balance > 0.005 && (
          <form onSubmit={pay} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <select value={method} onChange={e => setMethod(e.target.value)}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <input type="number" min="0.01" step="0.01" placeholder={`Amount (max ${money(balance)})`} value={amount} onChange={e => setAmount(e.target.value)} required />
            <input placeholder="Reference (optional)" value={reference} onChange={e => setReference(e.target.value)} maxLength={60} />
            <button disabled={busy}>Record Payment</button>
          </form>
        )}

        {sale.returns.length > 0 && (<>
          <h3>Returns</h3>
          {sale.returns.map(r => <p key={r.id} className="muted">{new Date(r.createdAt).toLocaleDateString()} — {r.reason} ({r.items.reduce((a, i) => a + i.quantity, 0)} units)</p>)}
        </>)}
        {returning && (
          <form onSubmit={submitReturn} style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <input placeholder="Reason for return" value={reason} onChange={e => setReason(e.target.value)} maxLength={300} required />
            <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
              <button disabled={busy}>Confirm Return</button>
              <button type="button" className="secondary" onClick={() => { setReturning(false); setQtys({}); }}>Cancel</button>
            </div>
          </form>
        )}

        {error && <div className="error">{error}</div>}
        <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
          <button className="secondary" onClick={printInvoice}>Print / Save PDF</button>
          {canReturn && !voided && !returning && <button className="secondary" onClick={() => setReturning(true)}>Return Items</button>}
          {canUpdate && !voided && sale.returns.length === 0 && <button className="secondary" onClick={voidSale} disabled={busy}>Void Sale</button>}
        </div>
      </div>
    </div>
  );
}
