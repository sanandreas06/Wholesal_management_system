'use client';
import { useEffect, useState } from "react";
import { toast } from "../lib/toast";
import { api, ApiError } from "../lib/api";

interface View<S> { id: string; name: string; state: S }

/** Remember a combination of filters under a name and bring it back with one click. Saved on the account, so it follows the person to any browser or device. */
export default function SavedViews<S extends Record<string, string | boolean>>({ storageKey, current, onApply }: { storageKey: string; current: S; onApply: (s: S) => void }) {
  const old = `wms_views_${storageKey}`; // views saved in this browser before they moved to the account
  const [views, setViews] = useState<View<S>[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        let rows = await api.get<View<S>[]>(`/saved-views?scope=${encodeURIComponent(storageKey)}`);
        // one-time move of anything saved in this browser onto the account
        let local: { name: string; state: S }[] = [];
        try { local = JSON.parse(localStorage.getItem(old) ?? "[]"); } catch { local = []; }
        if (local.length) {
          for (const v of local.slice(0, 30)) { try { await api.put("/saved-views", { scope: storageKey, name: v.name, state: v.state }); } catch { /* skip one that will not save */ } }
          try { localStorage.removeItem(old); } catch { /* ignore */ }
          rows = await api.get<View<S>[]>(`/saved-views?scope=${encodeURIComponent(storageKey)}`);
          if (live) toast.success(`Moved ${local.length} saved view${local.length === 1 ? "" : "s"} to your account`);
        }
        if (live) setViews(rows);
      } catch { /* offline or not signed in: the button simply shows no views */ }
    })();
    return () => { live = false; };
  }, [storageKey, old]);

  const hasFilters = Object.values(current).some(v => v !== "" && v !== false);
  async function save() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const v = await api.put<View<S>>("/saved-views", { scope: storageKey, name: n, state: current });
      setViews(list => [...list.filter(x => x.id !== v.id && x.name.toLowerCase() !== n.toLowerCase()), v].sort((x, y) => x.name.localeCompare(y.name)));
      setName(""); toast.success(`Saved view "${n}"`);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not save the view"); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    try { await api.delete(`/saved-views/${id}`); setViews(list => list.filter(x => x.id !== id)); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not delete the view"); }
  }

  return (
    <div className="views-wrap">
      <button type="button" className="secondary" onClick={() => setOpen(o => !o)} aria-expanded={open}>★ Views{views.length ? ` (${views.length})` : ""}</button>
      {open && <>
        <div className="bell-backdrop" onClick={() => setOpen(false)} />
        <div className="views-panel" role="dialog" aria-label="Saved views">
          <div className="bell-head">Saved views</div>
          {views.length === 0 && <div className="bell-empty">None yet. Set your filters, name them below and save.</div>}
          {views.map(v => (
            <div key={v.id} className="views-item">
              <button type="button" onClick={() => { onApply(v.state); setOpen(false); }}>{v.name}</button>
              <button type="button" className="views-x" aria-label={`Delete ${v.name}`} onClick={() => remove(v.id)}>&times;</button>
            </div>
          ))}
          <div className="views-save">
            <input value={name} onChange={e => setName(e.target.value)} placeholder={hasFilters ? "Name this view" : "Set some filters first"} maxLength={40} disabled={!hasFilters} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
            <button type="button" onClick={save} disabled={!hasFilters || !name.trim() || busy}>Save</button>
          </div>
        </div>
      </>}
    </div>
  );
}
