'use client';
import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { getSessionUser } from "../../lib/session";

export interface AddedProduct { id: string; sku: string; name: string; barcodes: string[]; trackItems: boolean; needsPrice?: boolean }
interface Pick { id: string; name: string; sku: string; barcodes?: string[]; trackItems?: boolean }
interface Info { found: boolean; name?: string; brand?: string; size?: string; source?: string }

/**
 * A barcode WHOLESTRA has never seen. Either it is a new product (made here in a few seconds, the name suggested from the free
 * product databases when it is a known packaged product), or a product we already have whose carton carries a code nobody recorded.
 * `choices` limits "we already have it" to the products on a transfer or release; otherwise every product can be picked.
 */
export default function NewBarcodeDialog({ code, allowNew, choices, onDone, onClose }: {
  code: string; allowNew: boolean; choices?: Pick[]; onDone: (p: AddedProduct) => void; onClose: () => void;
}) {
  const me = getSessionUser();
  const mayPrice = !!me?.permissions.includes("PRODUCTS:CREATE"), mayCost = !!me?.permissions.includes("PROFIT:READ");
  const [mode, setMode] = useState<"new" | "existing">(allowNew ? "new" : "existing");
  const [info, setInfo] = useState<Info | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [all, setAll] = useState<Pick[] | null>(choices ?? null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!allowNew) return;
    api.get<Info>(`/products/quick/barcode-info?code=${encodeURIComponent(code)}`).then(i => { setInfo(i); if (i.found && i.name) setName(n => n || i.name!); }).catch(() => setInfo({ found: false }));
    api.get<{ id: string; name: string }[]>("/categories").then(setCats).catch(() => setCats([]));
  }, [code, allowNew]);
  useEffect(() => { if (mode === "existing" && !all) api.get<Pick[]>("/products").then(setAll).catch(() => setAll([])); }, [mode, all]);

  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const p = await api.post<AddedProduct>("/products/quick", { barcode: code, name: name.trim(), categoryId: categoryId || undefined, ...(mayPrice ? { unitPrice: Number(price) } : {}), ...(mayPrice && mayCost && cost !== "" ? { costPrice: Number(cost) } : {}) });
      onDone(p);
    } catch (er) { setError(er instanceof ApiError ? er.message : "Could not save. Check your connection."); setBusy(false); }
  }
  async function attach(p: Pick) {
    setBusy(true); setError("");
    try { onDone(await api.post<AddedProduct>("/products/quick/attach", { productId: p.id, barcode: code })); }
    catch (er) { setError(er instanceof ApiError ? er.message : "Could not save. Check your connection."); setBusy(false); }
  }

  const t = q.trim().toLowerCase();
  const shown = (all ?? []).filter(p => !t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)).slice(0, 40);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal nb" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="nb-h">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2 id="nb-h">New barcode</h2>
        <p className="nb-code"><code>{code}</code> is not in WHOLESTRA yet.</p>
        {allowNew && <div className="tk-filter" role="tablist">
          <button type="button" className={mode === "new" ? "on" : ""} onClick={() => setMode("new")}>It&apos;s a new product</button>
          <button type="button" className={mode === "existing" ? "on" : ""} onClick={() => setMode("existing")}>We already have it</button>
        </div>}

        {mode === "new" && <form onSubmit={create}>
          {info === null ? <p className="nb-hint">Looking the barcode up…</p>
            : info.found ? <p className="nb-hint ok">Found in {info.source}. Check the name and change it if your shop calls it something else.</p>
            : <p className="nb-hint">Not found in the public product lists. Type the name the way your shop calls it.</p>}
          <label>Product name<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={160} autoFocus placeholder="e.g. Gino Tomato Paste 70g" /></label>
          {cats.length > 0 && <label>Category (optional)<select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">None</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          {mayPrice ? <div className="nb-two">
            <label>Selling price (GH₵)<input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} required /></label>
            {mayCost && <label>Cost price (optional)<input type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} /></label>}
          </div> : <p className="nb-hint">Your manager sets the selling price. Until then the product can be stocked but not sold.</p>}
          {error && <div className="error">{error}</div>}
          <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button disabled={busy || name.trim().length < 2}>{busy ? "Saving…" : "Add product and count this one"}</button></div>
        </form>}

        {mode === "existing" && <>
          <p className="nb-hint">{choices ? "Pick the product on this list that has this barcode. The barcode is added to it, so next time it scans straight away." : "Find the product. The barcode is added to it, so next time it scans straight away."}</p>
          {!choices && <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or code" aria-label="Search products" autoFocus={!allowNew} />}
          {all === null ? <p className="muted">Loading…</p> : shown.length === 0 ? <p className="muted">No product matches.</p> :
            <ul className="nb-list">{shown.map(p => <li key={p.id}><button type="button" disabled={busy} onClick={() => attach(p)}><b>{p.name}</b><span>{p.sku}{p.barcodes?.length ? ` · ${p.barcodes.length} barcode${p.barcodes.length === 1 ? "" : "s"}` : " · no barcode yet"}</span></button></li>)}</ul>}
          {error && <div className="error">{error}</div>}
          <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button></div>
        </>}
      </div>
    </div>
  );
}
