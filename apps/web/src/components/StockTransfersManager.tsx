'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import StatusStepper from "./StatusStepper";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";
import { usePolling } from "../hooks/usePolling";

interface Ref { id: string; name: string }
interface ProductRef { id: string; name: string; sku: string }
interface TransferItem { id: string; productId: string; product: ProductRef; quantity: number }
interface StockTransfer {
  id: string; transferNumber: string; status: string; notes: string | null; createdAt: string;
  fromBranch: Ref; toBranch: Ref; createdBy: Ref; items: TransferItem[];
}

const STATUS_CLASS: Record<string, string> = { DRAFT: "inactive", APPROVED: "active", DISPATCHED: "active", RECEIVED: "active", CANCELLED: "inactive" };

export default function StockTransfersManager() {
  const [transfers, setTransfers] = useState<StockTransfer[] | null>(null);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<StockTransfer | null>(null);
  const [canCreate, canUpdate] = usePermissions("STOCK_TRANSFERS:CREATE", "STOCK_TRANSFERS:UPDATE");

  function load() {
    api.get<StockTransfer[]>("/stock-transfers").then(setTransfers).catch(e => setError(e.message));
    api.get<Ref[]>("/branches").then(setBranches).catch(() => {});
    api.get<ProductRef[]>("/products").then(setProducts).catch(() => {});
  }
  useEffect(load, []);
  usePolling(load, 8000);
  usePolling(() => { if (viewing) refreshViewing(viewing.id); }, 6000, !!viewing);

  function refreshViewing(id: string) {
    api.get<StockTransfer>(`/stock-transfers/${id}`).then(setViewing).catch(() => {});
  }

  async function runAction(id: string, action: "approve" | "dispatch" | "receive" | "cancel") {
    try { await api.patch(`/stock-transfers/${id}/${action}`); load(); if (viewing?.id === id) refreshViewing(id); }
    catch (e) { alert(e instanceof ApiError ? e.message : `Failed to ${action}`); }
  }

  return (
    <AppShell title="Stock Transfers">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{transfers ? `${transfers.length} transfer${transfers.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setCreating(true)}>+ New Transfer</button>}
      </div>
      <div className="table-wrap">
        {transfers && transfers.length === 0 && <div className="empty">No stock transfers yet.</div>}
        {transfers && transfers.length > 0 && (
          <table>
            <thead><tr><th>Transfer #</th><th>From</th><th>To</th><th>Date</th><th>Items</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id}>
                  <td>{t.transferNumber}</td>
                  <td>{t.fromBranch.name}</td>
                  <td>{t.toBranch.name}</td>
                  <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td>{t.items.length}</td>
                  <td><span className={`badge ${STATUS_CLASS[t.status] || "inactive"}`}>{t.status}</span></td>
                  <td className="row-actions">
                    <button className="secondary" onClick={() => setViewing(t)}>View</button>
                    {canUpdate && t.status === "DRAFT" && <button className="secondary" onClick={() => runAction(t.id, "approve")}>Approve</button>}
                    {canUpdate && t.status === "APPROVED" && <button className="secondary" onClick={() => runAction(t.id, "dispatch")}>Dispatch</button>}
                    {canUpdate && t.status === "DISPATCHED" && <button className="secondary" onClick={() => runAction(t.id, "receive")}>Receive</button>}
                    {canUpdate && (t.status === "DRAFT" || t.status === "APPROVED") && <button className="secondary" onClick={() => runAction(t.id, "cancel")}>Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <CreateTransferModal branches={branches} products={products} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {viewing && <TransferDetailModal transfer={viewing} canUpdate={canUpdate} onClose={() => setViewing(null)} onAction={(action) => runAction(viewing.id, action)} />}
    </AppShell>
  );
}

function CreateTransferModal({ branches, products, onClose, onSaved }: { branches: Ref[]; products: ProductRef[]; onClose: () => void; onSaved: () => void }) {
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ productId: string; quantity: string }[]>([{ productId: "", quantity: "1" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateLine(i: number, field: string, value: string) { setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l)); }
  function addLine() { setLines(prev => [...prev, { productId: "", quantity: "1" }]); }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)); }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    if (fromBranchId === toBranchId) { setError("Source and destination branch must be different"); setSaving(false); return; }
    const items = lines.filter(l => l.productId).map(l => ({ productId: l.productId, quantity: Number(l.quantity) }));
    if (items.length === 0) { setError("Add at least one line item"); setSaving(false); return; }
    try {
      await api.post("/stock-transfers", { fromBranchId, toBranchId, notes: notes || undefined, items });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>New Stock Transfer</h2>
        <form onSubmit={submit}>
          <label>From Branch
            <select value={fromBranchId} onChange={e => setFromBranchId(e.target.value)} required>
              <option value="">Select source branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>To Branch
            <select value={toBranchId} onChange={e => setToBranchId(e.target.value)} required>
              <option value="">Select destination branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>Notes<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes for this transfer" /></label>

          <div>
            <p className="field-hint" style={{ marginBottom: 8 }}>Line Items</p>
            {lines.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                <select value={line.productId} onChange={e => updateLine(i, "productId", e.target.value)} style={{ flex: 2 }} required>
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <input type="number" min="1" placeholder="Qty" value={line.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} style={{ flex: 1 }} required />
                {lines.length > 1 && <button type="button" className="secondary" onClick={() => removeLine(i)}>Remove</button>}
              </div>
            ))}
            <button type="button" className="secondary" onClick={addLine}>+ Add Line</button>
          </div>

          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Saving..." : "Create Transfer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransferDetailModal({ transfer, canUpdate, onClose, onAction }: {
  transfer: StockTransfer; canUpdate: boolean; onClose: () => void; onAction: (action: "approve" | "dispatch" | "receive" | "cancel") => void;
}) {
  const steps = [{ key: "DRAFT", label: "Draft" }, { key: "APPROVED", label: "Approved" }, { key: "DISPATCHED", label: "Dispatched" }, { key: "RECEIVED", label: "Received" }];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{transfer.transferNumber}</h2>
        <p className="muted">{transfer.fromBranch.name} → {transfer.toBranch.name}</p>
        {transfer.notes && <p className="muted">{transfer.notes}</p>}

        <StatusStepper steps={steps} currentKey={transfer.status} cancelledLabel={transfer.status === "CANCELLED" ? "This transfer was cancelled" : undefined} />

        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead><tr><th>Product</th><th>Quantity</th></tr></thead>
            <tbody>
              {transfer.items.map(item => (
                <tr key={item.id}>
                  <td>{item.product.name} <span className="muted">({item.product.sku})</span></td>
                  <td>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canUpdate && (
          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            {transfer.status === "DRAFT" && <button onClick={() => onAction("approve")}>Approve</button>}
            {transfer.status === "APPROVED" && <button onClick={() => onAction("dispatch")}>Dispatch</button>}
            {transfer.status === "DISPATCHED" && <button onClick={() => onAction("receive")}>Mark as Received</button>}
            {(transfer.status === "DRAFT" || transfer.status === "APPROVED") && <button className="secondary" onClick={() => onAction("cancel")}>Cancel Transfer</button>}
          </div>
        )}
      </div>
    </div>
  );
}
