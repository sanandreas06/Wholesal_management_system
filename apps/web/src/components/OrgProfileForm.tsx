'use client';
import { FormEvent, useMemo, useState } from "react";
import "./auth/auth.css";
import { COUNTRIES, CURRENCIES, INDUSTRIES, LANGUAGES, MONTHS, countryInfo, timeZones, today } from "../lib/orgOptions";

export type OrgProfile = {
  name: string; industry: string; country: string; stateProvince: string; address: string; phone: string; email: string; website: string; taxId: string;
  currency: string; language: string; timeZone: string; inventoryStartDate: string; fiscalYearStart: string;
};
export const emptyProfile = (): OrgProfile => ({ name: "", industry: "", country: "Ghana", stateProvince: "", address: "", phone: "", email: "", website: "", taxId: "", currency: "GHS", language: "en", timeZone: "Africa/Accra", inventoryStartDate: today(), fiscalYearStart: "January" });
export function profileFrom(o: Partial<Record<keyof OrgProfile, string | null>>): OrgProfile {
  const e = emptyProfile();
  return (Object.keys(e) as (keyof OrgProfile)[]).reduce((p, k) => ({ ...p, [k]: (o[k] ?? "") || e[k] }), {} as OrgProfile);
}

/** The company profile, laid out like the "Set up your organization profile" screen: name, industry, where you are, then the regional settings.
 *  `full` adds the contact and tax fields shown in Settings. Fields marked * are required. */
export default function OrgProfileForm({ initial, onSubmit, submitLabel, busyLabel, full, disabled, footer }: {
  initial: OrgProfile; onSubmit: (p: OrgProfile) => Promise<void>; submitLabel: string; busyLabel?: string; full?: boolean; disabled?: boolean; footer?: React.ReactNode;
}) {
  const [p, setP] = useState<OrgProfile>(initial);
  const [busy, setBusy] = useState(false);
  const [showAddress, setShowAddress] = useState(!!initial.address || !!full);
  const zones = useMemo(() => { const z = timeZones(); return z.includes(p.timeZone) ? z : [p.timeZone, ...z]; }, [p.timeZone]);
  const regions = countryInfo(p.country)?.regions;
  const set = <K extends keyof OrgProfile>(k: K, v: OrgProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  function chooseCountry(name: string) {
    const c = countryInfo(name);
    setP((x) => ({ ...x, country: name, stateProvince: "", ...(c ? { currency: c.currency, timeZone: c.zone } : {}) }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await onSubmit(p); } finally { setBusy(false); }
  }
  const tz = (z: string) => z.replace(/_/g, " ");
  const req = <span className="req" aria-hidden="true">*</span>;

  return (
    <form className="opf" onSubmit={submit}>
      <fieldset disabled={disabled || busy}>
        <div className="opf-grid">
          <label className="span2"><span className="opf-l">Organization name{req}</span><input value={p.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={160} autoComplete="organization" /></label>
          <label className="span2">Industry<select value={p.industry} onChange={(e) => set("industry", e.target.value)}><option value="">Choose your industry</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}{p.industry && !INDUSTRIES.includes(p.industry) && <option>{p.industry}</option>}</select></label>
          <label><span className="opf-l">Organization location{req}</span><select value={p.country} onChange={(e) => chooseCountry(e.target.value)} required>{COUNTRIES.map((c) => <option key={c.name}>{c.name}</option>)}{!countryInfo(p.country) && <option>{p.country}</option>}</select></label>
          <label>{p.country === "Ghana" ? "Region" : "State / province"}
            {regions ? <select value={p.stateProvince} onChange={(e) => set("stateProvince", e.target.value)}><option value="">Choose</option>{regions.map((r) => <option key={r}>{r}</option>)}</select>
              : <input value={p.stateProvince} onChange={(e) => set("stateProvince", e.target.value)} maxLength={80} />}
          </label>
          {showAddress
            ? <label className="span2">Address<textarea rows={2} value={p.address} onChange={(e) => set("address", e.target.value)} maxLength={500} placeholder="Street, area, city, digital address" /></label>
            : <button type="button" className="opf-add span2" onClick={() => setShowAddress(true)}>+ Add organization address</button>}
          {full && <>
            <label>Business phone<input type="tel" value={p.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} /></label>
            <label>Business email<input type="email" value={p.email} onChange={(e) => set("email", e.target.value)} maxLength={160} /></label>
            <label>Website<input value={p.website} onChange={(e) => set("website", e.target.value)} maxLength={200} placeholder="www.example.com" /></label>
            <label>Tax ID (TIN)<input value={p.taxId} onChange={(e) => set("taxId", e.target.value)} maxLength={60} /></label>
          </>}
        </div>

        <h3 className="opf-h">Regional settings</h3>
        <div className="opf-grid">
          <label><span className="opf-l">Currency{req}</span><select value={p.currency} onChange={(e) => set("currency", e.target.value)} required>{CURRENCIES.map(([c, n]) => <option key={c} value={c}>{c} - {n}</option>)}</select></label>
          <label><span className="opf-l">Language{req}</span><select value={p.language} onChange={(e) => set("language", e.target.value)} required>{LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
          <label className="span2"><span className="opf-l">Time zone{req}</span><select value={p.timeZone} onChange={(e) => set("timeZone", e.target.value)} required>{zones.map((z) => <option key={z} value={z}>{tz(z)}</option>)}</select></label>
          <label><span className="opf-l">Inventory start date{req} <span className="opf-tip" role="img" aria-label="The day you start counting stock in WHOLESTRA. Opening stock is recorded on this date." title="The day you start counting stock in WHOLESTRA. Opening stock is recorded on this date.">ⓘ</span></span><input type="date" value={p.inventoryStartDate} onChange={(e) => set("inventoryStartDate", e.target.value)} required /></label>
          <label><span className="opf-l">Fiscal year starts in{req}</span><select value={p.fiscalYearStart} onChange={(e) => set("fiscalYearStart", e.target.value)} required>{MONTHS.map((m) => <option key={m}>{m}</option>)}</select></label>
        </div>
        <p className="opf-note">Money is shown in the currency you choose here, everywhere in the app. Changing it later does not convert amounts already recorded.</p>
        {footer}
        {!disabled && <button className="au-primary opf-submit" disabled={busy}>{busy ? busyLabel ?? "Saving..." : submitLabel}</button>}
      </fieldset>
    </form>
  );
}
