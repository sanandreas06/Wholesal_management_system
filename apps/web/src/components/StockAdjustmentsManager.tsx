'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Ref { id: string; name: string }
interface ProductRef { id: string; name: string; sku: string }
interface Adjustment {
  id: string; quantityDelta: number; resultingQuantity: number; notes: string | null; createdAt: string;
  product: ProductRef; branch: Ref; user: { name: string } | null;
}

export default function StockAdjustmentsManager() {
  const [adjustments, setAdjustments] = useState<Adjustment[] | null>(null);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [canCreate] = usePermissions("STOCK_ADJUSTMENTS:CREATE");

  function load() {
    api.get<Adjustment[]>("/stock-adjustments").then(setAdjustments).catch(e => setError(e.message));
    api.get<ProductRef[]>("/products").then(setProducts).catch(() => {});
    api.get<Ref[]>("/branches").then(setBranches).catch(() => {});
  }
  useEffect(load, []);

  return (
    <AppShell title="Stock Adjustments">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{adjustments ? `${adjustments.length} adjustment${adjustments.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setCreating(true)}>+ New Adjustment</button>}
      </div>
      <div className="table-wrap">
        {adjustments && adjustments.length === 0 && <div className="empty">No adjustments recorded yet.</div>}
        {adjustments && adjustments.length > 0 && (
          <table>
            <thead><tr><th>Date</th><th>Product</th><th>Branch</th><th>Change</th><th>Balance After</th><th>Reason</th><th>By</th></tr></thead>
            <tbody>
              {adjustments.map(a => (
                <tr key={a.id}>
                  <td>{new Date(a.createdAt).toLocaleString()}</td>
                  <td>{a.product.name} <span className="muted">({a.product.sku})</span></td>
                  <td>{a.branch.name}</td>
                  <td style={{ color: a.quantityDelta >= 0 ? "#067647" : "#b42318", fontWeight: 700 }}>
                    {a.quantityDelta >= 0 ? "+" : ""}{a.quantityDelta}
                  </td>
                  <td>{a.resultingQuantity}</td>
                  <td>{a.notes || "—"}</td>
                  <td>{a.user?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <AdjustmentModal products={products} branches={branches} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </AppShell>
  );
}

function AdjustmentModal({ products, branches, onClose, onSaved }: { products: ProductRef[]; branches: Ref[]; onClose: () => void; onSaved: () => void }) {
  const [productId, setProductId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const magnitude = Number(quantity);
    const quantityDelta = direction === "increase" ? magnitude : -magnitude;
    try {
      await api.post("/stock-adjustments", { productId, branchId, quantityDelta, reason });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>New Stock Adjustment</h2>
        <form onSubmit={submit}>
          <label>Product
            <select value={productId} onChange={e => setProductId(e.target.value)} required>
              <option value="">Select a product</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </label>
          <label>Branch
            <select value={branchId} onChange={e => setBranchId(e.target.value)} required>
              <option value="">Select a branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>Direction
            <select value={direction} onChange={e => setDirection(e.target.value as "increase" | "decrease")}>
              <option value="decrease">Decrease (loss, damage, spoilage)</option>
              <option value="increase">Increase (found stock, correction)</option>
            </select>
          </label>
          <label>Quantity<input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="e.g. 5" required /></label>
          <label>Reason<input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Damaged during transport, count discrepancy" required /></label>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Saving..." : "Record Adjustment"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
