'use client';
import { FormEvent, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { toast } from "../lib/toast";
import Avatar, { PRESETS, shrinkImage } from "./Avatar";

export interface Profile { id: string; name: string; email: string; phone: string; avatar: string; branch: string | null; roles: string[]; mustChangePassword?: boolean }

export default function ProfileModal({ profile, onClose, onSaved, forced = false }: { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void; forced?: boolean }) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(forced); // someone handed a temporary password has to choose their own first
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function pick(f?: File) {
    if (!f) return;
    try { setAvatar(await shrinkImage(f)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not use that photo"); }
  }

  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      if (forced && !(cur && next)) throw new Error("Enter the temporary password you were given and choose a new one.");
      if (pwOpen && (cur || next || again)) {
        if (next !== again) throw new Error("The new passwords do not match.");
        await api.post("/profile/password", { currentPassword: cur, newPassword: next });
      }
      const p = await api.patch<Profile>("/profile", { name, phone, avatar });
      onSaved(p);
      toast.success(pwOpen && next ? "Profile and password updated" : "Profile updated");
      onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={forced ? undefined : onClose}>
      <div className="modal profile-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={forced ? "Choose your password" : "My profile"}>
        {!forced && <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>}
        <h2>{forced ? "Choose your own password" : "My profile"}</h2>
        <p className="modal-sub">{forced ? "An administrator gave you a temporary password. Enter it below as your current password, then choose one only you know. You can also update your details." : "Choose how you appear across WHOLESTRA and keep your details up to date."}</p>
        <form onSubmit={save}>
          <div className="pf-top">
            <Avatar avatar={avatar} name={name} size={84} />
            <div className="pf-top-actions">
              <button type="button" className="secondary" onClick={() => file.current?.click()}>Upload photo</button>
              {avatar && <button type="button" className="link-btn" onClick={() => setAvatar("")}>Remove picture</button>}
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
              <span className="field-hint">Or pick a look below. Photos are shrunk to a small square.</span>
            </div>
          </div>
          <div className="pf-presets" role="radiogroup" aria-label="Choose an icon">
            {PRESETS.map((p, i) => (
              <button key={i} type="button" role="radio" aria-checked={avatar === `preset:${i}`} className={"pf-preset" + (avatar === `preset:${i}` ? " on" : "")} onClick={() => setAvatar(`preset:${i}`)} style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}>{p.emoji}</button>
            ))}
          </div>

          <div className="pf-grid">
            <label>Full name<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={80} /></label>
            <label>Phone<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 024 000 0000" maxLength={40} /></label>
            <label>Email<input value={profile.email} disabled /></label>
            <label>Role and branch<input value={`${profile.roles.join(", ") || "No role"}${profile.branch ? ` · ${profile.branch}` : ""}`} disabled /></label>
          </div>
          <span className="field-hint">Email, role and branch are set by an administrator.</span>

          <div className="pf-pw">
            {!forced && <button type="button" className="link-btn" onClick={() => setPwOpen(o => !o)}>{pwOpen ? "Cancel password change" : "Change password"}</button>}
            {pwOpen && (
              <div className="pf-grid">
                <label>Current password<input type="password" value={cur} onChange={e => setCur(e.target.value)} autoComplete="current-password" /></label>
                <span />
                <label>New password<input type="password" value={next} onChange={e => setNext(e.target.value)} minLength={8} autoComplete="new-password" /></label>
                <label>Repeat new password<input type="password" value={again} onChange={e => setAgain(e.target.value)} minLength={8} autoComplete="new-password" /></label>
              </div>
            )}
          </div>

          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            {!forced && <button type="button" className="secondary" onClick={onClose}>Cancel</button>}
            <button disabled={saving}>{saving ? "Saving..." : forced ? "Save and continue" : "Save changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
