'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Ref { id: string; name: string }
interface ProductRef { id: string; name: string; sku: string }
interface POItem { id: string; productId: string; product: ProductRef; quantityOrdered: number; quantityReceived: number; unitCost: string | number }
interface Receipt { id: string; receivedAt: string; supplierInvoiceNumber: string | null; supplierInvoiceAmount: string | number | null; items: { quantityReceived: number; productId: string }[] }
interface PurchaseOrder {
  id: string; orderNumber: string; status: string; orderDate: string; expectedDate: string | null; notes: string | null;
  supplier: Ref; branch: Ref; items: POItem[]; receipts: Receipt[];
}

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const STATUS_CLASS: Record<string, string> = { DRAFT: "inactive", SENT: "active", PARTIALLY_RECEIVED: "active", RECEIVED: "active", CLOSED: "inactive", CANCELLED: "inactive" };

export default function PurchaseOrdersManager() {
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [suppliers, setSuppliers] = useState<Ref[]>([]);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<PurchaseOrder | null>(null);
  const [canCreate, canUpdate, canDelete] = usePermissions("PURCHASING:CREATE", "PURCHASING:UPDATE", "PURCHASING:DELETE");

  function load() {
    api.get<PurchaseOrder[]>("/purchase-orders").then(setOrders).catch(e => setError(e.message));
    api.get<Ref[]>("/suppliers").then(setSuppliers).catch(() => {});
    api.get<Ref[]>("/branches").then(setBranches).catch(() => {});
    api.get<ProductRef[]>("/products").then(setProducts).catch(() => {});
  }
  useEffect(load, []);

  async function send(po: PurchaseOrder) {
    try { await api.patch(`/purchase-orders/${po.id}/send`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Failed to send"); }
  }

  async function cancel(po: PurchaseOrder) {
    if (!confirm(`Cancel order ${po.orderNumber}?`)) return;
    try { await api.patch(`/purchase-orders/${po.id}/cancel`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Failed to cancel"); }
  }

  async function remove(po: PurchaseOrder) {
    if (!confirm(`Delete draft order ${po.orderNumber}?`)) return;
    try { await api.delete(`/purchase-orders/${po.id}`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Failed to delete"); }
  }

  return (
    <AppShell title="Purchase Orders">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{orders ? `${orders.length} order${orders.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setCreating(true)}>+ New Purchase Order</button>}
      </div>
      <div className="table-wrap">
        {orders && orders.length === 0 && <div className="empty">No purchase orders yet.</div>}
        {orders && orders.length > 0 && (
          <table>
            <thead><tr><th>Order #</th><th>Supplier</th><th>Branch</th><th>Order Date</th><th>Items</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {orders.map(po => (
                <tr key={po.id}>
                  <td>{po.orderNumber}</td>
                  <td>{po.supplier.name}</td>
                  <td>{po.branch.name}</td>
                  <td>{new Date(po.orderDate).toLocaleDateString()}</td>
                  <td>{po.items.length}</td>
                  <td><span className={`badge ${STATUS_CLASS[po.status] || "inactive"}`}>{po.status.replace("_", " ")}</span></td>
                  <td className="row-actions">
                    <button className="secondary" onClick={() => setViewing(po)}>View</button>
                    {canUpdate && po.status === "DRAFT" && <button className="secondary" onClick={() => send(po)}>Send</button>}
                    {canUpdate && (po.status === "DRAFT" || po.status === "SENT") && <button className="secondary" onClick={() => cancel(po)}>Cancel</button>}
                    {canDelete && po.status === "DRAFT" && <button className="secondary" onClick={() => remove(po)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <CreatePOModal suppliers={suppliers} branches={branches} products={products} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {viewing && <PODetailModal po={viewing} onClose={() => setViewing(null)} onChanged={() => { load(); api.get<PurchaseOrder>(`/purchase-orders/${viewing.id}`).then(setViewing); }} />}
    </AppShell>
  );
}

function CreatePOModal({ suppliers, branches, products, onClose, onSaved }: {
  suppliers: Ref[]; branches: Ref[]; products: ProductRef[]; onClose: () => void; onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ productId: string; quantityOrdered: string; unitCost: string }[]>([{ productId: "", quantityOrdered: "1", unitCost: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateLine(i: number, field: string, value: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }
  function addLine() { setLines(prev => [...prev, { productId: "", quantityOrdered: "1", unitCost: "" }]); }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)); }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const items = lines.filter(l => l.productId).map(l => ({ productId: l.productId, quantityOrdered: Number(l.quantityOrdered), unitCost: Number(l.unitCost) }));
    if (items.length === 0) { setError("Add at least one line item"); setSaving(false); return; }
    try {
      await api.post("/purchase-orders", { supplierId, branchId, expectedDate: expectedDate || undefined, notes: notes || undefined, items });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>New Purchase Order</h2>
        <form onSubmit={submit}>
          <label>Supplier
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
              <option value="">Select a supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>Branch
            <select value={branchId} onChange={e => setBranchId(e.target.value)} required>
              <option value="">Select a branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>Expected Date<input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></label>
          <label>Notes<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes for this order" /></label>

          <div>
            <p className="field-hint" style={{ marginBottom: 8 }}>Line Items</p>
            {lines.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                <select value={line.productId} onChange={e => updateLine(i, "productId", e.target.value)} style={{ flex: 2 }} required>
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <input type="number" min="1" placeholder="Qty" value={line.quantityOrdered} onChange={e => updateLine(i, "quantityOrdered", e.target.value)} style={{ flex: 1 }} required />
                <input type="number" step="0.01" min="0" placeholder="Unit Cost" value={line.unitCost} onChange={e => updateLine(i, "unitCost", e.target.value)} style={{ flex: 1 }} required />
                {lines.length > 1 && <button type="button" className="secondary" onClick={() => removeLine(i)}>Remove</button>}
              </div>
            ))}
            <button type="button" className="secondary" onClick={addLine}>+ Add Line</button>
          </div>

          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Saving..." : "Create Order"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PODetailModal({ po, onClose, onChanged }: { po: PurchaseOrder; onClose: () => void; onChanged: () => void }) {
  const [receiving, setReceiving] = useState(false);
  const canReceive = po.status === "SENT" || po.status === "PARTIALLY_RECEIVED";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{po.orderNumber} <span className={`badge ${STATUS_CLASS[po.status] || "inactive"}`}>{po.status.replace("_", " ")}</span></h2>
        <p className="muted">{po.supplier.name} — {po.branch.name}</p>

        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead><tr><th>Product</th><th>Ordered</th><th>Received</th><th>Unit Cost</th></tr></thead>
            <tbody>
              {po.items.map(item => (
                <tr key={item.id}>
                  <td>{item.product.name} <span className="muted">({item.product.sku})</span></td>
                  <td>{item.quantityOrdered}</td>
                  <td>{item.quantityReceived}</td>
                  <td>{money.format(Number(item.unitCost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {po.receipts.length > 0 && (
          <>
            <p className="field-hint">Receipt History</p>
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table>
                <thead><tr><th>Date</th><th>Invoice #</th><th>Invoice Amount</th></tr></thead>
                <tbody>
                  {po.receipts.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.receivedAt).toLocaleString()}</td>
                      <td>{r.supplierInvoiceNumber || "—"}</td>
                      <td>{r.supplierInvoiceAmount != null ? money.format(Number(r.supplierInvoiceAmount)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!receiving && canReceive && (
          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <button onClick={() => setReceiving(true)}>+ Record Goods Receipt</button>
          </div>
        )}

        {receiving && <ReceiveGoodsForm po={po} onCancel={() => setReceiving(false)} onSaved={() => { setReceiving(false); onChanged(); }} />}
      </div>
    </div>
  );
}

function ReceiveGoodsForm({ po, onCancel, onSaved }: { po: PurchaseOrder; onCancel: () => void; onSaved: () => void }) {
  const receivable = po.items.filter(i => i.quantityReceived < i.quantityOrdered);
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(receivable.map(i => [i.id, ""])));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const items = receivable
      .filter(i => Number(quantities[i.id]) > 0)
      .map(i => ({ purchaseOrderItemId: i.id, quantityReceived: Number(quantities[i.id]) }));
    if (items.length === 0) { setError("Enter a quantity for at least one item"); setSaving(false); return; }
    try {
      await api.post(`/purchase-orders/${po.id}/receipts`, {
        items, supplierInvoiceNumber: invoiceNumber || undefined, supplierInvoiceAmount: invoiceAmount ? Number(invoiceAmount) : undefined
      });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Failed to record receipt"); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 8 }}>
      <p className="field-hint" style={{ marginBottom: 8 }}>Enter quantity received for each item (leave blank for items not in this shipment)</p>
      {receivable.map(item => {
        const remaining = item.quantityOrdered - item.quantityReceived;
        return (
          <label key={item.id}>
            {item.product.name} <span className="muted">(remaining: {remaining})</span>
            <input type="number" min="0" max={remaining} value={quantities[item.id]} onChange={e => setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder="0" />
          </label>
        );
      })}
      <label>Supplier Invoice Number<input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2026-0088" /></label>
      <label>Supplier Invoice Amount (GHS)<input type="number" step="0.01" min="0" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} /></label>
      {error && <div className="error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        <button disabled={saving}>{saving ? "Recording..." : "Record Receipt"}</button>
      </div>
    </form>
  );
}
