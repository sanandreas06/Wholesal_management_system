'use client';
import { useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api } from "../lib/api";

interface Ref { id: string; name: string }
interface InventoryRow { id: string; quantity: number; product: { id: string; name: string; sku: string; reorderLevel: number }; branch: Ref }
interface Movement {
  id: string; type: string; quantityDelta: number; resultingQuantity: number; referenceType: string | null; notes: string | null; createdAt: string;
  product: { name: string; sku: string }; branch: { name: string }; user: { name: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Goods Received", ADJUSTMENT: "Adjustment", TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out", SALE: "Sale", INITIAL: "Initial Stock"
};

export default function InventoryManager() {
  const [rows, setRows] = useState<InventoryRow[] | null>(null);
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [branchId, setBranchId] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [view, setView] = useState<"stock" | "ledger">("stock");
  const [error, setError] = useState("");

  useEffect(() => { api.get<Ref[]>("/branches").then(setBranches).catch(() => {}); }, []);

  function load() {
    const branchParam = branchId ? `?branchId=${branchId}` : "";
    if (view === "stock") {
      const path = lowStockOnly ? `/inventory/low-stock${branchParam}` : `/inventory${branchParam}`;
      api.get<InventoryRow[]>(path).then(setRows).catch(e => setError(e.message));
    } else {
      api.get<Movement[]>(`/inventory/movements${branchParam}`).then(setMovements).catch(e => setError(e.message));
    }
  }
  useEffect(load, [view, branchId, lowStockOnly]);

  return (
    <AppShell title="Inventory">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <div style={{ display: "flex", gap: 8 }}>
          <button className={view === "stock" ? "" : "secondary"} onClick={() => setView("stock")}>Stock Levels</button>
          <button className={view === "ledger" ? "" : "secondary"} onClick={() => setView("ledger")}>Movement Ledger</button>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {view === "stock" && (
            <label className="checkbox-row" style={{ fontWeight: 600 }}>
              <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} />
              Low stock only
            </label>
          )}
          <select value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {view === "stock" && (
        <div className="table-wrap">
          {rows && rows.length === 0 && <div className="empty">No stock records{lowStockOnly ? " below reorder level" : ""}.</div>}
          {rows && rows.length > 0 && (
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th>Branch</th><th>Quantity</th><th>Reorder Level</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map(r => {
                  const low = r.quantity <= r.product.reorderLevel;
                  return (
                    <tr key={r.id}>
                      <td>{r.product.name}</td>
                      <td>{r.product.sku}</td>
                      <td>{r.branch.name}</td>
                      <td><span className={`badge ${low ? "inactive" : "active"}`}>{r.quantity}</span></td>
                      <td>{r.product.reorderLevel}</td>
                      <td>{low ? <span className="badge inactive">Low Stock</span> : <span className="badge active">OK</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === "ledger" && (
        <div className="table-wrap">
          {movements && movements.length === 0 && <div className="empty">No stock movements recorded yet.</div>}
          {movements && movements.length > 0 && (
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>Branch</th><th>Type</th><th>Change</th><th>Balance After</th><th>By</th></tr></thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td>{new Date(m.createdAt).toLocaleString()}</td>
                    <td>{m.product.name} <span className="muted">({m.product.sku})</span></td>
                    <td>{m.branch.name}</td>
                    <td>{TYPE_LABEL[m.type] || m.type}</td>
                    <td style={{ color: m.quantityDelta >= 0 ? "#067647" : "#b42318", fontWeight: 700 }}>
                      {m.quantityDelta >= 0 ? "+" : ""}{m.quantityDelta}
                    </td>
                    <td>{m.resultingQuantity}</td>
                    <td>{m.user?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </AppShell>
  );
}
