'use client';
import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface PermissionRef { id: string; resource: string; action: string }
interface Role { id: string; name: string; code: string; description: string | null; status: "ACTIVE" | "INACTIVE"; permissions: { permission: PermissionRef }[]; _count: { userRoles: number } }

export default function RolesManager() {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [allPermissions, setAllPermissions] = useState<PermissionRef[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [assigningPermissions, setAssigningPermissions] = useState<Role | null>(null);

  const [canCreate, canUpdate] = usePermissions("ROLES:CREATE", "ROLES:UPDATE");

  function load() {
    api.get<Role[]>("/roles").then(setRoles).catch(e => setError(e.message));
    api.get<PermissionRef[]>("/permissions").then(setAllPermissions).catch(() => {});
  }
  useEffect(load, []);

  async function setStatus(role: Role, action: "activate" | "deactivate") {
    try { await api.patch(`/roles/${role.id}/${action}`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Update failed"); }
  }

  return (
    <AppShell title="Roles">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{roles ? `${roles.length} role${roles.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setEditing("new")}>+ New Role</button>}
      </div>
      <div className="table-wrap">
        {roles && roles.length === 0 && <div className="empty">No roles yet.</div>}
        {roles && roles.length > 0 && (
          <table>
            <thead><tr><th>Name</th><th>Code</th><th>Permissions</th><th>Users</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.code}</td>
                  <td>{r.permissions.length}</td>
                  <td>{r._count.userRoles}</td>
                  <td><span className={`badge ${r.status === "ACTIVE" ? "active" : "inactive"}`}>{r.status}</span></td>
                  <td className="row-actions">
                    {canUpdate && <button className="secondary" onClick={() => setEditing(r)}>Edit</button>}
                    {canUpdate && <button className="secondary" onClick={() => setAssigningPermissions(r)}>Permissions</button>}
                    {canUpdate && r.status === "ACTIVE" && <button className="secondary" onClick={() => setStatus(r, "deactivate")}>Deactivate</button>}
                    {canUpdate && r.status !== "ACTIVE" && <button className="secondary" onClick={() => setStatus(r, "activate")}>Activate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <RoleModal role={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {assigningPermissions && <PermissionsModal role={assigningPermissions} allPermissions={allPermissions} onClose={() => setAssigningPermissions(null)} onSaved={() => { setAssigningPermissions(null); load(); }} />}
    </AppShell>
  );
}

function RoleModal({ role, onClose, onSaved }: { role: Role | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.name || "");
  const [code, setCode] = useState(role?.code || "");
  const [description, setDescription] = useState(role?.description || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      if (role) await api.put(`/roles/${role.id}`, { name, code, description });
      else await api.post("/roles", { name, code, description });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{role ? "Edit Role" : "New Role"}</h2>
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

function PermissionsModal({ role, allPermissions, onClose, onSaved }: { role: Role; allPermissions: PermissionRef[]; onClose: () => void; onSaved: () => void }) {
  const [permissionIds, setPermissionIds] = useState<string[]>(role.permissions.map(p => p.permission.id));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionRef[]>();
    for (const p of allPermissions) { if (!map.has(p.resource)) map.set(p.resource, []); map.get(p.resource)!.push(p); }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allPermissions]);

  function toggle(id: string) { setPermissionIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]); }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { await api.put(`/roles/${role.id}/permissions`, { permissionIds }); onSaved(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>Permissions for {role.name}</h2>
        <form onSubmit={submit}>
          <div className="permission-groups">
            {grouped.map(([resource, perms]) => (
              <div key={resource} className="permission-group">
                <p className="permission-group-title">{resource}</p>
                <div className="checkbox-list checkbox-list-inline">
                  {perms.map(p => (
                    <label key={p.id} className="checkbox-row"><input type="checkbox" checked={permissionIds.includes(p.id)} onChange={() => toggle(p.id)} />{p.action}</label>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
