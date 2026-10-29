'use client';
import { useRef, useState } from "react";
import CameraScanner from "../CameraScanner";
import NewBarcodeDialog, { AddedProduct } from "./NewBarcodeDialog";
import { getSessionUser } from "../../lib/session";
import { api, ApiError } from "../../lib/api";
import { scanFeedback, useScanner } from "../../lib/scanner";
import "./scan.css";

/** One product being counted at a handover. `quantity` is the number the person states; `scanned` is how many scans confirm it. */
export interface ScanLine {
  key: string;
  productId: string;
  name: string;
  sku: string;
  barcodes: string[];
  trackItems: boolean;
  /** the most that may be counted on this line (what was ordered, requested or sent) */
  limit?: number;
  quantity: number;
  scanned: number;
  /** item labels scanned, for products with a label on each item */
  codes: string[];
  /** true once the person typed the number themselves (it then stops following the scans) */
  typed?: boolean;
}

interface Looked { id: string; name: string; sku: string; barcodes?: string[]; ownCode?: string | null; trackItems?: boolean; item?: { code: string; status: string; here?: boolean } }

const isItemLabel = (c: string) => /^W[2-9A-HJKMNP-Z]{9}$/i.test(c);

/**
 * The scanning list used for goods in, sending, receiving and releasing goods.
 * A USB/Bluetooth scanner works anywhere on the page; the camera button opens the phone camera and keeps scanning.
 * Each scan adds one to the matching product. Products with a label on each item need the item's own label (when `labelsRequired`).
 */
export default function ScanSession({ lines, setLines, allowAdd = false, labelsRequired = false, countUp = false, disabled = false, branchId }: {
  lines: ScanLine[];
  setLines: (f: (prev: ScanLine[]) => ScanLine[]) => void;
  /** goods in: a product that is not on the list yet is added when scanned */
  allowAdd?: boolean;
  /** sending, receiving, releasing: labelled products must be scanned by their item labels */
  labelsRequired?: boolean;
  /** the number follows the scans until the person types a number */
  countUp?: boolean;
  disabled?: boolean;
  branchId?: string;
}) {
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const [camera, setCamera] = useState(false);
  const [unknown, setUnknown] = useState<string | null>(null);
  const cache = useRef(new Map<string, Looked | null>());
  const latest = useRef(lines); latest.current = lines;
  const timer = useRef(0);

  function say(text: string, ok: boolean) {
    scanFeedback(ok); setFlash({ text, ok });
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setFlash(null), ok ? 2200 : 5000);
  }

  function bump(key: string, code?: string) {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const scanned = l.scanned + 1;
      return { ...l, scanned, codes: code ? [...l.codes, code] : l.codes, quantity: countUp && !l.typed ? Math.max(l.quantity, scanned) : l.quantity };
    }));
  }

  async function lookup(code: string): Promise<Looked | null> {
    if (cache.current.has(code)) return cache.current.get(code)!;
    try {
      const p = await api.get<Looked>(`/products/lookup?code=${encodeURIComponent(code)}${branchId ? `&branchId=${branchId}` : ""}`);
      cache.current.set(code, p); return p;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) { cache.current.set(code, null); return null; }
      throw e;
    }
  }

  async function onScan(raw: string) {
    if (disabled) return;
    const code = raw.trim(), label = isItemLabel(code), up = code.toUpperCase();
    const list = latest.current;
    if (label && list.some(l => l.codes.includes(up))) { say(`Label ${up} was already scanned.`, false); return; }
    let line = label ? undefined : list.find(l => l.barcodes.includes(code) || l.sku.toLowerCase() === code.toLowerCase());
    let found: Looked | null = null;
    if (!line) {
      try { found = await lookup(label ? up : code); } catch { say("Could not check this code. Check your connection.", false); return; }
      if (!found) {
        // a barcode nobody has recorded: add the product (goods in), or add the code to a product on the list
        const perms = getSessionUser()?.permissions ?? [];
        const canNew = allowAdd && (perms.includes("PRODUCTS:CREATE") || perms.includes("GOODS_RECEIVING:CREATE"));
        const canAttach = perms.includes("PRODUCTS:UPDATE") || perms.includes("GOODS_RECEIVING:CREATE") || perms.includes("STOCK_TRANSFERS:UPDATE");
        if (!label && (canNew || (canAttach && (allowAdd || list.length > 0)))) { scanFeedback(false); setFlash({ text: `New barcode ${code}: say what it is.`, ok: false }); setUnknown(code); return; }
        say(allowAdd ? `No product has the barcode ${code}. Add it to a product first (Products, then Edit).` : `${code} is not a product in WHOLESTRA.`, false); return;
      }
      line = latest.current.find(l => l.productId === found!.id);
      if (!line) {
        if (!allowAdd) { say(`${found.name} is not on this list.`, false); return; }
        // goods in: only the maker's barcodes count as "can be scanned" (the WHOLESTRA label goes on after receiving)
        const fresh: ScanLine = { key: found.id, productId: found.id, name: found.name, sku: found.sku, barcodes: (found.barcodes ?? []).filter(b => b !== found!.ownCode), trackItems: !!found.trackItems, quantity: countUp ? 1 : 0, scanned: 1, codes: label ? [up] : [] };
        setLines(prev => [fresh, ...prev]);
        say(`${found.name}: 1 scanned`, true);
        return;
      }
    }
    if (label && found?.item && branchId && found.item.status === "IN_STOCK" && found.item.here === false) { say(`Label ${up} is recorded at another branch, not this one.`, false); return; }
    if (label && found?.item && found.item.status !== "IN_STOCK" && found.item.status !== "IN_TRANSIT") { say(`Label ${up} is ${found.item.status.replace("_", " ").toLowerCase()}. It cannot be used here.`, false); return; }
    if (labelsRequired && line.trackItems && !label) { say(`${line.name} has a WHOLESTRA label on each item. Scan the item's own label, not the maker's barcode.`, false); return; }
    const cap = countUp ? line.limit : (line.typed || line.quantity ? line.quantity : line.limit);
    if (cap !== undefined && line.scanned >= cap) { say(`All ${cap} × ${line.name} are already scanned.${countUp ? "" : " Change the number if more are going."}`, false); return; }
    bump(line.key, label ? up : undefined);
    say(`${line.name}: ${line.scanned + 1}${line.quantity ? ` of ${Math.max(line.quantity, countUp && !line.typed ? line.scanned + 1 : 0)}` : ""} scanned`, true);
  }

  useScanner((c) => { void onScan(c); }, !disabled && !unknown);

  /** The barcode now belongs to a product: count this scan for it. */
  function added(p: AddedProduct) {
    const code = unknown!;
    setUnknown(null); cache.current.delete(code);
    const have = latest.current.find(l => l.productId === p.id);
    if (have) {
      setLines(prev => prev.map(l => l.productId === p.id ? { ...l, barcodes: [...new Set([...l.barcodes, ...p.barcodes])] } : l));
      if (have.trackItems && labelsRequired) { say(`Barcode added to ${p.name}. It has a label on each item: scan the item's label.`, true); return; }
      bump(have.key); say(`Barcode added to ${p.name}: ${have.scanned + 1} scanned`, true); return;
    }
    if (!allowAdd) { say(`Barcode added to ${p.name}.`, true); return; }
    setLines(prev => [{ key: p.id, productId: p.id, name: p.name, sku: p.sku, barcodes: p.barcodes.filter(b => b !== p.ownCode), trackItems: p.trackItems, quantity: countUp ? 1 : 0, scanned: 1, codes: [] }, ...prev]);
    say(`${p.name} added${p.ownCode ? `, code ${p.ownCode}` : ""}${p.needsPrice ? " (the manager sets its price)" : ""}: 1 scanned`, true);
  }

  function setQty(key: string, v: string) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    setLines(prev => prev.map(l => l.key === key ? { ...l, quantity: l.limit !== undefined ? Math.min(n, l.limit) : n, typed: true } : l));
  }
  function undo(key: string) {
    setLines(prev => prev.map(l => l.key === key && l.scanned > 0 ? { ...l, scanned: l.scanned - 1, codes: l.codes.slice(0, -1), quantity: countUp && !l.typed ? Math.max(0, l.quantity - 1) : l.quantity } : l));
  }
  function remove(key: string) { setLines(prev => prev.filter(l => l.key !== key)); }

  return (
    <div className="sc">
      <div className="sc-pad">
        <div className="sc-pad-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M16 8v8" /></svg>
        </div>
        <div className="sc-pad-text">
          <b>Scan each item</b>
          <span>Use the barcode scanner, or the phone camera. Every scan counts one.</span>
        </div>
        <button type="button" className="sc-cam" onClick={() => setCamera(true)} disabled={disabled}>Camera</button>
      </div>
      <div className={"sc-flash" + (flash ? (flash.ok ? " ok" : " bad") : "")} role="status" aria-live="polite">{flash?.text ?? ""}</div>

      {lines.length === 0 && <p className="sc-empty">{allowAdd ? "Scan the first item to start the list." : "Nothing to count."}</p>}
      <ul className="sc-lines">
        {lines.map(l => {
          const noCode = !l.barcodes.length && !l.trackItems;
          const done = l.quantity > 0 && (noCode || l.scanned === l.quantity);
          const pct = noCode ? 100 : l.quantity ? Math.min(100, Math.round((l.scanned / l.quantity) * 100)) : 0;
          return (
            <li key={l.key} className={done ? "done" : l.scanned < l.quantity ? "open" : ""}>
              <div className="sc-name">
                <b>{l.name}</b>
                <span>{l.sku}{l.trackItems ? " · label on each item" : ""}{l.limit !== undefined ? ` · up to ${l.limit}` : ""}</span>
              </div>
              <label className="sc-qty"><span>Number</span>
                <input type="number" inputMode="numeric" min={0} max={l.limit} value={l.quantity} onChange={e => setQty(l.key, e.target.value)} disabled={disabled} aria-label={`Number of ${l.name}`} />
              </label>
              <div className="sc-count" aria-label={`${l.scanned} of ${l.quantity} scanned`}>
                <div className="sc-bar"><i style={{ width: `${pct}%` }} /></div>
                <span>{noCode ? "No barcode: count by eye" : `${done ? "✓ " : ""}${l.scanned} of ${l.quantity} scanned`}</span>
              </div>
              <div className="sc-acts">
                <button type="button" className="sc-mini" onClick={() => undo(l.key)} disabled={disabled || !l.scanned} title="Take back the last scan">−1</button>
                {allowAdd && <button type="button" className="sc-mini" onClick={() => remove(l.key)} disabled={disabled} title="Remove this product" aria-label={`Remove ${l.name}`}>×</button>}
              </div>
              {l.codes.length > 0 && <details className="sc-codes"><summary>{l.codes.length} label{l.codes.length === 1 ? "" : "s"} scanned</summary><p>{l.codes.join(", ")}</p></details>}
            </li>
          );
        })}
      </ul>
      {unknown && <NewBarcodeDialog code={unknown} allowNew={allowAdd} choices={allowAdd ? undefined : lines.map(l => ({ id: l.productId, name: l.name, sku: l.sku, barcodes: l.barcodes, trackItems: l.trackItems }))}
        onDone={added} onClose={() => { setUnknown(null); setFlash(null); }} />}
      {camera && <CameraScanner keepOpen title="Scan each item" onScan={(c) => void onScan(c)} onClose={() => setCamera(false)} />}
    </div>
  );
}

/** Totals for the confirm bar: every line scanned in full, or how many were not. */
export function scanSummary(lines: ScanLine[]) {
  const counted = lines.reduce((s, l) => s + l.quantity, 0);
  // products with no barcode cannot be scanned: they are counted by eye and not held against anyone
  const missing = lines.reduce((s, l) => s + (!l.barcodes.length && !l.trackItems ? 0 : Math.max(0, l.quantity - l.scanned)), 0);
  const byEye = lines.reduce((s, l) => s + (!l.barcodes.length && !l.trackItems ? l.quantity : 0), 0);
  return { counted, missing, byEye, all: counted > 0 && missing === 0 };
}
