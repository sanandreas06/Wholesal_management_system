'use client';
import { useEffect, useState } from "react";
import SettingsPage from "./settings/SettingsPage";
import OrgProfileForm, { OrgProfile, profileFrom } from "./OrgProfileForm";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";
import { getSessionUser, updateSessionUser } from "../lib/session";
import { toast } from "../lib/toast";

type Org = Partial<Record<keyof OrgProfile, string | null>> & { id: string; name: string; code: string; createdAt: string; plan: string; _count: { branches: number; users: number; regions: number; products: number } };

/** Settings → Organization profile: the same fields as the set-up screen, plus contact and tax details. */
export default function OrganizationSettings() {
  const [org, setOrg] = useState<Org | null>(null);
  const [error, setError] = useState("");
  const [canUpdate] = usePermissions("ORGANIZATION:UPDATE");
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(!!getSessionUser()?.demo);
    api.get<Org>("/organization").then(setOrg).catch((e) => setError(e.message));
  }, []);

  async function save(p: OrgProfile) {
    setError("");
    try {
      const o = await api.put<Org>("/organization", p);
      setOrg(o); updateSessionUser({ organization: o.name, currency: o.currency ?? undefined });
      toast.success("Company profile saved.");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
  }

  return (
    <SettingsPage title="Organization profile" intro="Your company's details. The currency and time zone here are used everywhere in the app.">
      {error && <div className="error">{error}</div>}
      {!org && !error && <p className="muted">Loading...</p>}
      {org && <>
        <section className="kpis">
          <article className="kpi"><p>Branches</p><strong>{org._count.branches}</strong></article>
          <article className="kpi"><p>Users</p><strong>{org._count.users}</strong></article>
          <article className="kpi"><p>Products</p><strong>{org._count.products}</strong></article>
          <article className="kpi"><p>Company code</p><strong className="kpi-code">{org.code}</strong></article>
        </section>
        <article className="panel st-form">
          {demo && <p className="st-note">This is the demo company, so changes are switched off.</p>}
          <OrgProfileForm key={org.id + (org as { updatedAt?: string }).updatedAt} initial={profileFrom(org)} onSubmit={save} submitLabel="Save changes" full disabled={!canUpdate || demo} />
        </article>
      </>}
    </SettingsPage>
  );
}
