'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { toast } from "../lib/toast";
import { TableSkeleton } from "./Skeleton";
import { usePermissions } from "../hooks/usePermissions";

interface Item {
  productId: string; sku: string; name: string; onHand: number; onOrder: number; perDay: number; daysLeft: number | null;
  suggestedQty: number; unitCost: number; urgency: "urgent" | "soon" | "routine"; reason: string; leadDays: number; leadSource: "supplier" | "learned" | "default";
}
interface Group { branchId: string; branch: string; supplierId: string | null; supplier: string | null; items: Item[] }
interface Result { params: { days: number; leadDays: number; coverDays: number }; itemCount: number; groups: Group[] }
interface Ref { id: string; name: string }

const URGENCY: Record<string, [string, string]> = { urgent: ["Out of stock", "high"], soon: ["Running low soon", "medium"], routine: ["Routine", "active"] };
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReorderManager() {
  const [canCreate] = usePermissions("PURCHASING:CREATE");
  const [data, setData] = useState<Result | null>(null);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [suppliers, setSuppliers] = useState<Ref[]>([]);
  const [branchId, setBranchId] = useState("");
  const [days, setDays] = useState(30);
  const [lead, setLead] = useState(7);
  const [cover, setCover] = useState(14);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string[]>([]);

  function load() {
    setError("");
    const q = `?days=${days}&leadDays=${lead}&coverDays=${cover}${branchId ? `&branchId=${branchId}` : ""}`;
    api.get<Result>(`/reorder/suggestions${q}`).then(setData).catch(e => setError(e.message));
  }
  useEffect(() => { api.get<Ref[]>("/branches?own=1").then(setBranches).catch(() => {}); api.get<Ref[]>("/suppliers").then(setSuppliers).catch(() => {}); }, []);
  useEffect(load, [branchId, days, lead, cover]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell title="Reorder Suggestions">
      {error && <div className="error">{error}</div>}
      <p className="muted" style={{ marginBottom: 14 }}>
        Based on how fast each product has been selling at each branch, compared with what is on hand and already on order. Suggestions never place an order: each group becomes a <strong>draft</strong> purchase order that you review and send.
      </p>
      {done.length > 0 && <div className="panel" style={{ marginBottom: 14 }}>Created {done.join(", ")}. <Link href="/purchase-orders" className="drill">Open purchase orders →</Link></div>}
      <div className="toolbar" style={{ gap: 10, flexWrap: "wrap" }}>
        <select value={branchId} onChange={e => setBranchId(e.target.value)} aria-label="Branch"><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <label className="inline-field">Sales looked at <select value={days} onChange={e => setDays(Number(e.target.value))}>{[14, 30, 60, 90].map(d => <option key={d} value={d}>last {d} days</option>)}</select></label>
        <label className="inline-field" title="Used only for products whose supplier has no lead time set and no delivery history yet. Set a supplier's own lead time on the Suppliers page.">Unknown suppliers take <input type="number" min={1} max={60} value={lead} onChange={e => setLead(Number(e.target.value) || 1)} style={{ width: 64 }} /> days</label>
        <label className="inline-field">Cover <input type="number" min={1} max={90} value={cover} onChange={e => setCover(Number(e.target.value) || 1)} style={{ width: 64 }} /> days of selling</label>
      </div>
      {!data && !error && <TableSkeleton />}
      {data && data.groups.length === 0 && <div className="empty">Nothing needs reordering right now with these settings.</div>}
      {data?.groups.map(g => (
        <GroupCard key={`${g.branchId}|${g.supplierId ?? "none"}`} group={g} suppliers={suppliers} canCreate={canCreate}
          onCreated={n => { setDone(d => [...d, n]); load(); toast.success(`Draft order ${n} created`); }} onError={setError} />
      ))}
    </AppShell>
  );
}

function GroupCard({ group, suppliers, canCreate, onCreated, onError }: { group: Group; suppliers: Ref[]; canCreate: boolean; onCreated: (orderNumber: string) => void; onError: (m: string) => void }) {
  const [supplierId, setSupplierId] = useState(group.supplierId ?? "");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [cost, setCost] = useState<Record<string, string>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const qOf = (i: Item) => Number(qty[i.productId] ?? i.suggestedQty);
  const cOf = (i: Item) => Number(cost[i.productId] ?? i.unitCost);
  const chosen = group.items.filter(i => !off[i.productId] && qOf(i) > 0);
  const total = chosen.reduce((s, i) => s + qOf(i) * cOf(i), 0);

  async function create() {
    onError(""); setBusy(true);
    try {
      const po = await api.post<{ orderNumber: string }>("/reorder/draft-order", {
        supplierId, branchId: group.branchId,
        items: chosen.map(i => ({ productId: i.productId, quantityOrdered: Math.round(qOf(i)), unitCost: cOf(i) })),
      });
      onCreated(po.orderNumber);
    } catch (e) { onError(e instanceof ApiError ? e.message : "Could not create the draft order"); }
    finally { setBusy(false); }
  }

  return (
    <div className="table-wrap" style={{ marginBottom: 16 }}>
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong>{group.branch}</strong>
          <span className="muted"> · {group.supplier ? `last bought from ${group.supplier}` : "no supplier on record for these products"}</span>
          {group.items[0] && <span className={`lead-chip ${group.items[0].leadSource}`} title={group.items[0].leadSource === "supplier" ? "Lead time set on the supplier" : group.items[0].leadSource === "learned" ? "Worked out from this supplier's past deliveries (order date to first delivery)" : "No lead time for this supplier yet: using the default above"}>
            ≈ {group.items[0].leadDays} days to arrive · {group.items[0].leadSource === "supplier" ? "supplier's lead time" : group.items[0].leadSource === "learned" ? "from past deliveries" : "default"}
          </span>}
        </div>
        {canCreate && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!group.supplierId && (
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} aria-label="Supplier">
                <option value="">Choose supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <button disabled={busy || !supplierId || chosen.length === 0 || chosen.some(i => cOf(i) <= 0)} onClick={create}>
              {busy ? "Creating..." : `Create draft PO (${chosen.length}) · ${money(total)}`}
            </button>
          </div>
        )}
      </div>
      <table>
        <thead><tr><th></th><th>Product</th><th>On hand</th><th>On order</th><th>Sells / day</th><th>Days left</th><th>Order qty</th><th>Unit cost</th><th>Priority</th></tr></thead>
        <tbody>{group.items.map(i => {
          const [label, cls] = URGENCY[i.urgency];
          return (
            <tr key={i.productId} style={off[i.productId] ? { opacity: 0.45 } : undefined} title={i.reason}>
              <td><input type="checkbox" checked={!off[i.productId]} onChange={e => setOff(o => ({ ...o, [i.productId]: !e.target.checked }))} /></td>
              <td>{i.name}<div className="muted" style={{ fontSize: 12 }}>{i.sku}</div></td>
              <td>{i.onHand}</td><td>{i.onOrder || "—"}</td><td>{i.perDay || "—"}</td><td>{i.daysLeft ?? "—"}</td>
              <td><input type="number" min={1} value={qty[i.productId] ?? i.suggestedQty} onChange={e => setQty(q => ({ ...q, [i.productId]: e.target.value }))} style={{ width: 80 }} /></td>
              <td><input type="number" min={0} step="0.01" value={cost[i.productId] ?? i.unitCost} onChange={e => setCost(c => ({ ...c, [i.productId]: e.target.value }))} style={{ width: 90 }} /></td>
              <td><span className={`badge ${cls}`}>{label}</span></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}
