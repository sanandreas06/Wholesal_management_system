'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Region { id: string; name: string; code: string; description: string | null; status: "ACTIVE" | "INACTIVE"; _count?: { branches: number } }

export default function RegionsManager() {
  const [regions, setRegions] = useState<Region[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Region | "new" | null>(null);

  const [canCreate, canUpdate, canDelete] = usePermissions("REGIONS:CREATE", "REGIONS:UPDATE", "REGIONS:DELETE");

  function load() { api.get<Region[]>("/regions").then(setRegions).catch(e => setError(e.message)); }
  useEffect(load, []);

  async function remove(region: Region) {
    if (!confirm(`Delete region "${region.name}"?`)) return;
    try { await api.delete(`/regions/${region.id}`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  return (
    <AppShell title="Regions">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{regions ? `${regions.length} region${regions.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setEditing("new")}>+ New Region</button>}
      </div>
      <div className="table-wrap">
        {regions && regions.length === 0 && <div className="empty">No regions yet.</div>}
        {regions && regions.length > 0 && (
          <table>
            <thead><tr><th>Name</th><th>Code</th><th>Branches</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {regions.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.code}</td>
                  <td>{r._count?.branches ?? 0}</td>
                  <td><span className={`badge ${r.status === "ACTIVE" ? "active" : "inactive"}`}>{r.status}</span></td>
                  <td className="row-actions">
                    {canUpdate && <button className="secondary" onClick={() => setEditing(r)}>Edit</button>}
                    {canDelete && <button className="secondary" onClick={() => remove(r)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <RegionModal region={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </AppShell>
  );
}

function RegionModal({ region, onClose, onSaved }: { region: Region | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(region?.name || "");
  const [code, setCode] = useState(region?.code || "");
  const [description, setDescription] = useState(region?.description || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      if (region) await api.put(`/regions/${region.id}`, { name, code, description });
      else await api.post("/regions", { name, code, description });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{region ? "Edit Region" : "New Region"}</h2>
        <form onSubmit={submit}>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} required /></label>
          <label>Code<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} required /></label>
          <label>Description<input value={description} onChange={e => setDescription(e.target.value)} /></label>
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
