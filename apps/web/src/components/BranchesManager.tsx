'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { toast } from "../lib/toast";
import { usePermissions } from "../hooks/usePermissions";
import { getSessionUser } from "../lib/session";
import { here } from "../lib/geo";

interface Region { id: string; name: string; code: string }
interface Branch { id: string; name: string; code: string; location: string | null; regionId: string | null; region: Region | null; lat?: number | null; lng?: number | null }

export default function BranchesManager() {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Branch | "new" | null>(null);

  const [canCreate, canUpdate, canDelete] = usePermissions("BRANCHES:CREATE", "BRANCHES:UPDATE", "BRANCHES:DELETE");

  /** Puts the branch on the map from this phone's GPS: do it standing in the branch. Used for the live map of goods on the road. */
  async function pin(b: Branch) {
    if (!window.confirm(`Pin ${b.name} at the place where this device is now?\n\nDo this standing inside ${b.name}, with the phone's location turned on.`)) return;
    const p = await here(15_000);
    if (!p) { toast.error("Could not get this device's location. Allow location for this site and turn on GPS, then try again."); return; }
    try { await api.put(`/branches/${b.id}/location`, p); toast.success(`${b.name} is on the map.`); setBranches(list => list && list.map(x => x.id === b.id ? { ...x, lat: p.lat, lng: p.lng } : x)); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not save the location."); }
  }

  function load() {
    api.get<Branch[]>("/branches").then(setBranches).catch(e => setError(e.message));
    api.get<Region[]>("/regions").then(setRegions).catch(() => {});
  }
  useEffect(load, []);
  // "+" quick-create menu opens this page with ?new=1
  useEffect(() => { if (new URLSearchParams(window.location.search).get("new") === "1") setEditing("new"); }, []);

  async function remove(branch: Branch) {
    if (!confirm(`Delete branch "${branch.name}"?`)) return;
    try { await api.delete(`/branches/${branch.id}`); load(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  return (
    <AppShell title="Branches">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{branches ? `${branches.length} branch${branches.length === 1 ? "" : "es"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setEditing("new")}>+ New Branch</button>}
      </div>
      <div className="table-wrap">
        {branches && branches.length === 0 && <div className="empty">No branches yet.</div>}
        {branches && branches.length > 0 && (
          <table>
            <thead><tr><th>Name</th><th>Code</th><th>Region</th><th>Location</th><th></th></tr></thead>
            <tbody>
              {branches.map(b => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.code}</td>
                  <td>{b.region?.name || "—"}</td>
                  <td>{b.location || "—"}</td>
                  <td className="row-actions">
                    {canUpdate && <button className="secondary" onClick={() => setEditing(b)}>Edit</button>}
                    {canUpdate && <button className="secondary" title={b.lat != null ? `On the map at ${b.lat.toFixed(4)}, ${b.lng?.toFixed(4)}` : "Not on the map yet"} onClick={() => pin(b)}>{b.lat != null ? "📍 Move pin" : "📍 Pin location"}</button>}
                    {canDelete && <button className="secondary" onClick={() => remove(b)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <BranchModal branch={editing === "new" ? null : editing} regions={regions} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </AppShell>
  );
}

function BranchModal({ branch, regions, onClose, onSaved }: { branch: Branch | null; regions: Region[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(branch?.name || "");
  const [code, setCode] = useState(branch?.code || "");
  const [location, setLocation] = useState(branch?.location || "");
  const [regionId, setRegionId] = useState(branch?.regionId || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const payload = { name, code, location, regionId: regionId || undefined };
    try {
      if (branch) await api.put(`/branches/${branch.id}`, payload);
      else await api.post("/branches", payload);
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{branch ? "Edit Branch" : "New Branch"}</h2>
        <p className="modal-sub company-line">{branch ? "A branch of" : "A new branch of"} <b>{getSessionUser()?.organization ?? "your company"}</b>. Each company only ever sees its own records.</p>
        <form onSubmit={submit}>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kumasi Central" required /></label>
          <label>Code<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. KSI-001" required /></label>
          <label>Location<input value={location} onChange={e => setLocation(e.target.value)} /></label>
          <label>Region
            <select value={regionId} onChange={e => setRegionId(e.target.value)}>
              <option value="">— None —</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
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
