'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Organization { id: string; name: string; code: string; createdAt: string; _count: { branches: number; users: number; regions: number; products: number } }

export default function OrganizationSettings() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [canUpdate] = usePermissions("ORGANIZATION:UPDATE");

  function load() {
    api.get<Organization>("/organization").then(o => { setOrg(o); setName(o.name); }).catch(e => setError(e.message));
  }
  useEffect(load, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSaved(false);
    try { const updated = await api.put<Organization>("/organization", { name }); setOrg(updated); setSaved(true); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <AppShell title="Organization Settings">
      {error && <div className="error">{error}</div>}
      {!org && !error && <p className="muted">Loading...</p>}
      {org && (
        <>
          <section className="kpis">
            <article className="kpi"><p>Regions</p><strong>{org._count.regions}</strong></article>
            <article className="kpi"><p>Branches</p><strong>{org._count.branches}</strong></article>
            <article className="kpi"><p>Users</p><strong>{org._count.users}</strong></article>
            <article className="kpi"><p>Products</p><strong>{org._count.products}</strong></article>
          </section>
          <article className="panel">
            <h2>Organization Details</h2>
            <form onSubmit={submit} className="org-form">
              <label>Organization Name
                <input value={name} onChange={e => setName(e.target.value)} required disabled={!canUpdate} />
              </label>
              <label>Organization Code
                <input value={org.code} disabled />
              </label>
              <p className="muted">Code is fixed and cannot be changed.</p>
              {canUpdate && (
                <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                  <button disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
                  {saved && <span className="muted">Saved.</span>}
                </div>
              )}
            </form>
          </article>
        </>
      )}
    </AppShell>
  );
}
