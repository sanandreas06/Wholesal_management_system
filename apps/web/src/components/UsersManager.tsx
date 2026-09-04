'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Branch { id: string; name: string }
interface RoleRef { id: string; name: string; code: string }
interface User { id: string; name: string; email: string; status: "ACTIVE" | "INACTIVE" | "SUSPENDED"; branchId: string | null; branch: { id: string; name: string } | null; userRoles: { role: RoleRef }[] }

export default function UsersManager() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<RoleRef[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [assigningRoles, setAssigningRoles] = useState<User | null>(null);

  const [canCreate, canUpdate] = usePermissions("USERS:CREATE", "USERS:UPDATE");

  function load() {
    api.get<User[]>("/users").then(setUsers).catch(e => setError(e.message));
    api.get<Branch[]>("/branches").then(setBranches).catch(() => {});
    api.get<{ id: string; name: string; code: string }[]>("/roles").then(setRoles).catch(() => {});
  }
  useEffect(load, []);

  async function setStatus(user: User, action: "activate" | "deactivate") {
    try { await api.patch(`/users/${user.id}/${action}`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Update failed"); }
  }

  return (
    <AppShell title="Users">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{users ? `${users.length} user${users.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setEditing("new")}>+ New User</button>}
      </div>
      <div className="table-wrap">
        {users && users.length === 0 && <div className="empty">No users yet.</div>}
        {users && users.length > 0 && (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Branch</th><th>Roles</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.branch?.name || "—"}</td>
                  <td>{u.userRoles.map(ur => ur.role.name).join(", ") || "—"}</td>
                  <td><span className={`badge ${u.status === "ACTIVE" ? "active" : "inactive"}`}>{u.status}</span></td>
                  <td className="row-actions">
                    {canUpdate && <button className="secondary" onClick={() => setEditing(u)}>Edit</button>}
                    {canUpdate && <button className="secondary" onClick={() => setAssigningRoles(u)}>Roles</button>}
                    {canUpdate && u.status === "ACTIVE" && <button className="secondary" onClick={() => setStatus(u, "deactivate")}>Deactivate</button>}
                    {canUpdate && u.status !== "ACTIVE" && <button className="secondary" onClick={() => setStatus(u, "activate")}>Activate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <UserModal user={editing === "new" ? null : editing} branches={branches} roles={roles} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {assigningRoles && <RolesModal user={assigningRoles} roles={roles} onClose={() => setAssigningRoles(null)} onSaved={() => { setAssigningRoles(null); load(); }} />}
    </AppShell>
  );
}

function UserModal({ user, branches, roles, onClose, onSaved }: { user: User | null; branches: Branch[]; roles: RoleRef[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState(user?.branchId || "");
  const [roleIds, setRoleIds] = useState<string[]>(user?.userRoles.map(ur => ur.role.id) || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleRole(id: string) { setRoleIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]); }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      if (user) await api.put(`/users/${user.id}`, { name, branchId: branchId || undefined });
      else await api.post("/users", { name, email, password, branchId: branchId || undefined, roleIds });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{user ? "Edit User" : "New User"}</h2>
        <form onSubmit={submit}>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={!!user} /></label>
          {!user && <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required /></label>}
          <label>Branch
            <select value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">— None —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          {!user && (
            <label>Roles
              <div className="checkbox-list">
                {roles.map(r => (
                  <label key={r.id} className="checkbox-row"><input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />{r.name}</label>
                ))}
              </div>
            </label>
          )}
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

function RolesModal({ user, roles, onClose, onSaved }: { user: User; roles: RoleRef[]; onClose: () => void; onSaved: () => void }) {
  const [roleIds, setRoleIds] = useState<string[]>(user.userRoles.map(ur => ur.role.id));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleRole(id: string) { setRoleIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]); }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { await api.put(`/users/${user.id}/roles`, { roleIds }); onSaved(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>Roles for {user.name}</h2>
        <form onSubmit={submit}>
          <div className="checkbox-list">
            {roles.map(r => (
              <label key={r.id} className="checkbox-row"><input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />{r.name}</label>
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
