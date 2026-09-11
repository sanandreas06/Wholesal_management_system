'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Ref { id: string; name: string }
interface ProductRef { id: string; name: string; sku: string }
interface CountItem { id: string; productId: string; product: ProductRef; systemQuantity: number; countedQuantity: number | null }
interface StockCount {
  id: string; countNumber: string; status: string; notes: string | null; createdAt: string;
  branch: Ref; createdBy: Ref; items: CountItem[];
}

const STATUS_CLASS: Record<string, string> = { DRAFT: "inactive", COMPLETED: "active", CANCELLED: "inactive" };

export default function StockCountsManager() {
  const [counts, setCounts] = useState<StockCount[] | null>(null);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<StockCount | null>(null);
  const [canCreate, canUpdate] = usePermissions("STOCK_COUNTS:CREATE", "STOCK_COUNTS:UPDATE");

  function load() {
    api.get<StockCount[]>("/stock-counts").then(setCounts).catch(e => setError(e.message));
    api.get<Ref[]>("/branches").then(setBranches).catch(() => {});
  }
  useEffect(load, []);

  function refreshViewing(id: string) { api.get<StockCount>(`/stock-counts/${id}`).then(setViewing).catch(() => {}); }

  async function cancel(sc: StockCount) {
    if (!confirm(`Cancel count ${sc.countNumber}?`)) return;
    try { await api.patch(`/stock-counts/${sc.id}/cancel`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Failed to cancel"); }
  }

  return (
    <AppShell title="Stock Counts">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{counts ? `${counts.length} count${counts.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setCreating(true)}>+ New Stock Count</button>}
      </div>
      <div className="table-wrap">
        {counts && counts.length === 0 && <div className="empty">No stock counts yet.</div>}
        {counts && counts.length > 0 && (
          <table>
            <thead><tr><th>Count #</th><th>Branch</th><th>Date</th><th>Items</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {counts.map(c => (
                <tr key={c.id}>
                  <td>{c.countNumber}</td>
                  <td>{c.branch.name}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>{c.items.length}</td>
                  <td><span className={`badge ${STATUS_CLASS[c.status] || "inactive"}`}>{c.status}</span></td>
                  <td className="row-actions">
                    <button className="secondary" onClick={() => setViewing(c)}>View</button>
                    {canUpdate && c.status === "DRAFT" && <button className="secondary" onClick={() => cancel(c)}>Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <CreateCountModal branches={branches} onClose={() => setCreating(false)} onSaved={(sc) => { setCreating(false); load(); setViewing(sc); }} />}
      {viewing && <CountDetailModal count={viewing} canUpdate={canUpdate} onClose={() => setViewing(null)} onRefresh={() => refreshViewing(viewing.id)} onCompleted={() => { load(); setViewing(null); }} />}
    </AppShell>
  );
}

function CreateCountModal({ branches, onClose, onSaved }: { branches: Ref[]; onClose: () => void; onSaved: (sc: StockCount) => void }) {
  const [branchId, setBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const sc = await api.post<StockCount>("/stock-counts", { branchId, notes: notes || undefined });
      onSaved(sc);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>New Stock Count</h2>
        <form onSubmit={submit}>
          <label>Branch
            <select value={branchId} onChange={e => setBranchId(e.target.value)} required>
              <option value="">Select a branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>Notes<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Monthly count - September" /></label>
          <p className="field-hint">This will snapshot the current system quantity for every product at this branch. You&apos;ll enter the physical count on the next screen.</p>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Creating..." : "Start Count"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CountDetailModal({ count, canUpdate, onClose, onRefresh, onCompleted }: {
  count: StockCount; canUpdate: boolean; onClose: () => void; onRefresh: () => void; onCompleted: () => void;
}) {
  const [counted, setCounted] = useState<Record<string, string>>(() =>
    Object.fromEntries(count.items.map(i => [i.id, i.countedQuantity != null ? String(i.countedQuantity) : ""]))
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  const isDraft = count.status === "DRAFT";
  const allCounted = count.items.every(i => counted[i.id] !== "" && counted[i.id] !== undefined);

  async function saveCounts() {
    setSaving(true); setError("");
    const items = count.items.filter(i => counted[i.id] !== "").map(i => ({ itemId: i.id, countedQuantity: Number(counted[i.id]) }));
    try { await api.put(`/stock-counts/${count.id}/items`, { items }); onRefresh(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function complete() {
    if (!confirm("Complete this count? This will apply any variances to inventory and cannot be undone.")) return;
    setCompleting(true); setError("");
    try { await api.patch(`/stock-counts/${count.id}/complete`); onCompleted(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to complete"); }
    finally { setCompleting(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{count.countNumber} <span className={`badge ${STATUS_CLASS[count.status] || "inactive"}`}>{count.status}</span></h2>
        <p className="muted">{count.branch.name}{count.notes ? ` — ${count.notes}` : ""}</p>

        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead><tr><th>Product</th><th>System Qty</th><th>Counted Qty</th><th>Variance</th></tr></thead>
            <tbody>
              {count.items.map(item => {
                const enteredValue = counted[item.id];
                const entered = enteredValue !== "" && enteredValue !== undefined ? Number(enteredValue) : null;
                const variance = entered !== null ? entered - item.systemQuantity : null;
                return (
                  <tr key={item.id}>
                    <td>{item.product.name} <span className="muted">({item.product.sku})</span></td>
                    <td>{item.systemQuantity}</td>
                    <td>
                      {isDraft
                        ? <input type="number" min="0" style={{ width: 100 }} value={counted[item.id] ?? ""} onChange={e => setCounted(prev => ({ ...prev, [item.id]: e.target.value }))} />
                        : (item.countedQuantity ?? "—")}
                    </td>
                    <td style={{ color: variance == null || variance === 0 ? undefined : variance > 0 ? "#067647" : "#b42318", fontWeight: 700 }}>
                      {variance == null ? "—" : variance === 0 ? "0" : (variance > 0 ? `+${variance}` : variance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && <div className="error">{error}</div>}

        {isDraft && canUpdate && (
          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <button className="secondary" onClick={saveCounts} disabled={saving}>{saving ? "Saving..." : "Save Counts"}</button>
            <button onClick={complete} disabled={completing || !allCounted} title={!allCounted ? "Enter a count for every item first" : ""}>
              {completing ? "Completing..." : "Complete Count"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
