'use client';
import { useEffect, useRef, useState } from "react";
import SettingsPage from "./SettingsPage";
import { api, ApiError } from "../../lib/api";
import { shrinkImage } from "../../lib/image";
import { usePermissions } from "../../hooks/usePermissions";
import { getSessionUser } from "../../lib/session";
import { toast } from "../../lib/toast";

type Brand = { name: string; logo: string | null; address: string | null; phone: string | null; email: string | null; taxId: string | null };

/** Settings → Branding: the company logo, shown at the top of printed invoices and beside the company name in the app. */
export default function BrandingSettings() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [canUpdate] = usePermissions("ORGANIZATION:UPDATE");
  const [demo, setDemo] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setDemo(!!getSessionUser()?.demo); api.get<Brand>("/organization/brand").then((b) => { setBrand(b); setLogo(b.logo); }).catch((e) => setError(e.message)); }, []);

  async function pick(f: File | undefined) {
    if (!f) return;
    setError("");
    try { setLogo(await shrinkImage(f, { maxSide: 360, maxChars: 88000, keepTransparency: true })); }
    catch (e) { setError((e as Error).message); }
  }
  async function save(value: string | null) {
    setBusy(true); setError("");
    try {
      await api.put("/organization", { logo: value ?? "" });
      setBrand((b) => (b ? { ...b, logo: value } : b)); setLogo(value);
      try { sessionStorage.removeItem("wms_brand"); } catch { /* ignore */ }
      window.dispatchEvent(new Event("wms-brand"));
      toast.success(value ? "Logo saved." : "Logo removed.");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  const editable = canUpdate && !demo;
  const changed = brand && logo !== brand.logo;

  return (
    <SettingsPage title="Branding" intro="Your logo appears at the top of every printed invoice and next to your company name in the app.">
      {error && <div className="error">{error}</div>}
      {brand && (
        <div className="br-grid">
          <article className="panel">
            <h2>Company logo</h2>
            <div className={"br-drop" + (editable ? "" : " off")} onClick={() => editable && input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (editable) pick(e.dataTransfer.files[0]); }}
              role={editable ? "button" : undefined} tabIndex={editable ? 0 : undefined} onKeyDown={(e) => { if (editable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); input.current?.click(); } }}>
              {logo ? <img src={logo} alt="Your logo" /> : <span className="br-empty">{editable ? <>Drop your logo here, or <u>choose a file</u></> : "No logo yet"}</span>}
            </div>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            <p className="muted fine">PNG with a clear background works best. Large pictures are made smaller for you.</p>
            {demo && <p className="st-note">This is the demo company, so changes are switched off.</p>}
            {editable && (
              <div className="st-row">
                <button disabled={busy || !changed || !logo} onClick={() => save(logo)}>{busy ? "Saving..." : "Save logo"}</button>
                {logo && <button className="secondary" disabled={busy} onClick={() => input.current?.click()}>Choose another</button>}
                {brand.logo && <button className="secondary danger" disabled={busy} onClick={() => save(null)}>Remove</button>}
              </div>
            )}
          </article>
          <article className="panel">
            <h2>How invoices will look</h2>
            <div className="br-inv" aria-label="Preview of the top of an invoice">
              <div className="br-inv-top">
                <div className="br-inv-co">{logo && <img src={logo} alt="" />}<div><b>{brand.name}</b>{[brand.address, brand.phone, brand.email, brand.taxId ? `TIN ${brand.taxId}` : ""].filter(Boolean).map((x) => <small key={String(x)}>{x}</small>)}</div></div>
                <div className="br-inv-r"><b>INVOICE</b><small>INV-00001</small></div>
              </div>
              <div className="br-inv-lines"><i /><i /><i /></div>
            </div>
            <p className="muted fine">Address, phone, email and tax number come from <a href="/settings/organization">Organization profile</a>.</p>
          </article>
        </div>
      )}
    </SettingsPage>
  );
}
