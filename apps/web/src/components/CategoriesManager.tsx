'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Category { id: string; name: string; code: string; _count?: { products: number } }

export default function CategoriesManager() {
  const [items, setItems] = useState<Category[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [canCreate, canUpdate, canDelete] = usePermissions("CATEGORIES:CREATE", "CATEGORIES:UPDATE", "CATEGORIES:DELETE");

  function load() { api.get<Category[]>("/categories").then(setItems).catch(e => setError(e.message)); }
  useEffect(load, []);

  async function remove(item: Category) {
    if (!confirm(`Delete category "${item.name}"?`)) return;
    try { await api.delete(`/categories/${item.id}`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  return (
    <AppShell title="Categories">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{items ? `${items.length} categor${items.length === 1 ? "y" : "ies"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setEditing("new")}>+ New Category</button>}
      </div>
      <div className="table-wrap">
        {items && items.length === 0 && <div className="empty">No categories yet.</div>}
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
      {editing && <CategoryModal item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </AppShell>
  );
}

function CategoryModal({ item, onClose, onSaved }: { item: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name || "");
  const [code, setCode] = useState(item?.code || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      if (item) await api.put(`/categories/${item.id}`, { name, code });
      else await api.post("/categories", { name, code });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{item ? "Edit Category" : "New Category"}</h2>
        <form onSubmit={submit}>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rice, Cooking Oil, Beverages" required /></label>
          <label>Code<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. RICE, OIL, BEV" required /></label>
          <p className="field-hint">A short, unique tag for this category — used internally, doesn&apos;t need to match the name exactly.</p>
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
