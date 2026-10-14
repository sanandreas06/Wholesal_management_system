'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
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
  const [canCreate, canUpdate, canPay, canReturn] = usePermissions("SALES:CREATE", "SALES:UPDATE", "PAYMENTS:CREATE", "RETURNS:CREATE");

  function load() {
    api.get<Sale[]>("/sales").then(setSales).catch(e => setError(e.message));
  }
  useEffect(() => {
    load();
    api.get<Ref[]>("/branches").then(setBranches).catch(() => {});
    api.get<ProductRef[]>("/products").then(setProducts).catch(() => {});
    api.get<CustomerRef[]>("/customers").then(setCustomers).catch(() => {});
  }, []);
  usePolling(load, 10000);

  function updated(s: Sale) { setViewing(s); load(); }

  return (
    <AppShell title="Sales">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{sales ? `${sales.length} sale${sales.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setCreating(true)}>+ New Sale</button>}
      </div>
      <div className="table-wrap">
        {sales && sales.length === 0 && <div className="empty">No sales yet.</div>}
        {sales && sales.length > 0 && (
          <table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Branch</th><th>Customer</th><th>Total</th><th>Balance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {sales.map(s => {
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
        onClose={() => setCreating(false)} onSaved={s => { setCreating(false); load(); setViewing(s); }} />}
      {viewing && <SaleDetailModal sale={viewing} canUpdate={canUpdate} canPay={canPay} canReturn={canReturn}
        onClose={() => setViewing(null)} onUpdated={updated} />}
    </AppShell>
  );
}

function CreateSaleModal({ branches, products, customers, canPay, onClose, onSaved }: {
  branches: Ref[]; products: ProductRef[]; customers: CustomerRef[]; canPay: boolean; onClose: () => void; onSaved: (s: Sale) => void;
}) {
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<{ productId: string; quantity: string; unitPrice: string }[]>([{ productId: "", quantity: "1", unitPrice: "" }]);
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

  const total = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

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
        catch (pe) { alert(`Sale ${sale.invoiceNumber} was created, but the payment failed: ${pe instanceof ApiError ? pe.message : "error"}`); }
      }
      onSaved(sale);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>New Sale</h2>
        <form onSubmit={submit}>
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
          <div>
            <p className="field-hint" style={{ marginBottom: 8 }}>Line Items</p>
            {lines.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select value={l.productId} onChange={e => pickProduct(i, e.target.value)} style={{ flex: 3 }} required>
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}){branchId ? ` — ${stock[p.id] ?? 0} in stock` : ""}</option>)}
                </select>
                <input type="number" min="1" placeholder="Qty" value={l.quantity} onChange={e => updateLine(i, { quantity: e.target.value })} style={{ flex: 1 }} required />
                <input type="number" min="0" step="0.01" placeholder="Price" value={l.unitPrice} onChange={e => updateLine(i, { unitPrice: e.target.value })} style={{ flex: 1 }} required />
                {lines.length > 1 && <button type="button" className="secondary" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}>Remove</button>}
              </div>
            ))}
            <button type="button" className="secondary" onClick={() => setLines(prev => [...prev, { productId: "", quantity: "1", unitPrice: "" }])}>+ Add Line</button>
          </div>
          <p><strong>Total: {money(total)}</strong></p>
          {canPay && (
            <div>
              <label className="checkbox-row"><input type="checkbox" checked={payNow} onChange={e => { setPayNow(e.target.checked); if (e.target.checked && !amount) setAmount(String(total)); }} /> Record a payment now</label>
              {payNow && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <select value={method} onChange={e => setMethod(e.target.value)} style={{ flex: 1 }}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" style={{ flex: 1 }} />
                </div>
              )}
              <p className="field-hint">Leave unchecked to sell on account; the balance stays open for the customer.</p>
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Saving..." : "Complete Sale"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SaleDetailModal({ sale, canUpdate, canPay, canReturn, onClose, onUpdated }: {
  sale: Sale; canUpdate: boolean; canPay: boolean; canReturn: boolean; onClose: () => void; onUpdated: (s: Sale) => void;
}) {
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
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const rows = sale.items.map(i => `<tr><td>${i.product.name}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${money(i.unitPrice)}</td><td style="text-align:right">${money(i.lineTotal)}</td></tr>`).join("");
    w.document.write(`<html><head><title>${sale.invoiceNumber}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{font-size:12px;text-transform:uppercase}.r{text-align:right}</style></head><body>
      <h1>Invoice ${sale.invoiceNumber}</h1>${voided ? "<h2 style='color:#b42318'>VOIDED</h2>" : ""}
      <p>Date: ${new Date(sale.soldAt).toLocaleString()}<br/>Branch: ${sale.branch.name}<br/>Customer: ${sale.customer?.name || "Walk-in"}<br/>Served by: ${sale.user.name}</p>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="r"><strong>Total: ${money(sale.totalAmount)}</strong><br/>Paid: ${money(paidOf(sale))}<br/>Balance: ${money(balance)}</p>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  }

  const [label, cls] = payState(sale);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{sale.invoiceNumber} <span className={`badge ${cls}`}>{label}</span></h2>
        <p className="muted">{sale.branch.name} · {sale.customer?.name || "Walk-in"} · {new Date(sale.soldAt).toLocaleString()} · by {sale.user.name}</p>

        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th>Returned</th></tr></thead>
            <tbody>
              {sale.items.map(i => (
                <tr key={i.id}>
                  <td>{i.product.name} <span className="muted">({i.product.sku})</span></td>
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
          <button className="secondary" onClick={printInvoice}>Print Invoice</button>
          {canReturn && !voided && !returning && <button className="secondary" onClick={() => setReturning(true)}>Return Items</button>}
          {canUpdate && !voided && sale.returns.length === 0 && <button className="secondary" onClick={voidSale} disabled={busy}>Void Sale</button>}
        </div>
      </div>
    </div>
  );
}
