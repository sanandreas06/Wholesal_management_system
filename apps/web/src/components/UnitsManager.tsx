'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Unit { id: string; name: string; code: string; _count?: { products: number } }

export default function UnitsManager() {
  const [items, setItems] = useState<Unit[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Unit | "new" | null>(null);
  const [canCreate, canUpdate, canDelete] = usePermissions("UNITS:CREATE", "UNITS:UPDATE", "UNITS:DELETE");

  function load() { api.get<Unit[]>("/units").then(setItems).catch(e => setError(e.message)); }
  useEffect(load, []);

  async function remove(item: Unit) {
    if (!confirm(`Delete unit "${item.name}"?`)) return;
    try { await api.delete(`/units/${item.id}`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  return (
    <AppShell title="Units">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{items ? `${items.length} unit${items.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setEditing("new")}>+ New Unit</button>}
      </div>
      <div className="table-wrap">
        {items && items.length === 0 && <div className="empty">No units yet.</div>}
        {items && items.length > 0 && (
          <table>
            <thead><tr><th>Name</th><th>Code</th><th>Products</th><th></th></tr></thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id}>
                  <td>{i.name}</td><td>{i.code}</td><td>{i._count?.products ?? 0}</td>
                  <td className="row-actions">
                    {canUpdate && <button className="secondary" onClick={() => setEditing(i)}>Edit</button>}
                    {canDelete && <button className="secondary" onClick={() => remove(i)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <UnitModal item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </AppShell>
  );
}

function UnitModal({ item, onClose, onSaved }: { item: Unit | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name || "");
  const [code, setCode] = useState(item?.code || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      if (item) await api.put(`/units/${item.id}`, { name, code });
      else await api.post("/units", { name, code });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{item ? "Edit Unit" : "New Unit"}</h2>
        <form onSubmit={submit}>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 25kg Bag, Carton, 5L Bottle" required /></label>
          <label>Code<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. BAG25, CTN, BTL5L" required /></label>
          <p className="field-hint">A short, unique tag for this unit — used internally, doesn&apos;t need to match the name exactly.</p>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
