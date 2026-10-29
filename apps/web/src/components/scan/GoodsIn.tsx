'use client';
import { useEffect, useState } from "react";
import AppShell from "../AppShell";
import ScanSession, { ScanLine, scanSummary } from "./ScanSession";
import ConfirmBar from "./ConfirmBar";
import { useWorkBranch } from "./useWorkBranch";
import { api, ApiError } from "../../lib/api";

interface Product { id: string; name: string; sku: string; barcodes?: string[]; ownCode?: string | null; trackItems?: boolean }
interface POItem { id: string; productId: string; product: { id: string; name: string; sku: string }; quantityOrdered: number; quantityReceived: number }
interface PO { id: string; orderNumber: string; status: string; branch: { id: string; name: string }; supplier?: { name: string } | null; items: POItem[] }
interface Done { stock: number; labels: number; reference: string | null; number: string; byScan: boolean; /** what came in, to print product labels for */ items: { id: string; n: number }[] }

/** Goods arriving at the warehouse or shop: scan every item in, against a purchase order or without one. */
export default function GoodsIn() {
  const { branches, branchId, setBranchId, branchName, error: branchError } = useWorkBranch();
  const [orders, setOrders] = useState<PO[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [poId, setPoId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => { const p = new URLSearchParams(window.location.search).get("po"); if (p) setPoId(p); }, []);
  useEffect(() => {
    if (!branchId) return;
    api.get<PO[]>("/purchase-orders").then(list => setOrders(list.filter(o => (o.status === "SENT" || o.status === "PARTIALLY_RECEIVED") && o.branch.id === branchId))).catch(() => setOrders([]));
    api.get<Product[]>(`/products?branchId=${branchId}`).then(setProducts).catch(() => setProducts([]));
  }, [branchId]);

  const po = orders.find(o => o.id === poId);
  // a purchase order fills the list with what is still to come; without one the list starts empty and grows as items are scanned
  useEffect(() => {
    if (!po) { setLines([]); return; }
    const byId = new Map(products.map(p => [p.id, p]));
    setLines(po.items.filter(i => i.quantityReceived < i.quantityOrdered).map(i => {
      const p = byId.get(i.productId);
      return { key: i.id, productId: i.productId, name: i.product.name, sku: i.product.sku, barcodes: (p?.barcodes ?? []).filter(b => b !== p?.ownCode), trackItems: !!p?.trackItems, limit: i.quantityOrdered - i.quantityReceived, quantity: 0, scanned: 0, codes: [] };
    }));
  }, [po, products]);

  async function confirm() {
    setBusy(true); setError("");
    const counted = lines.filter(l => l.quantity > 0);
    const allScanned = scanSummary(counted).missing === 0;
    try {
      if (po) {
        const r = await api.post<{ labels: Record<string, string[]>; labelReference: string | null }>(`/purchase-orders/${po.id}/receipts`, {
          byScan: true, reason: allScanned ? undefined : reason,
          items: counted.map(l => ({ purchaseOrderItemId: l.key, quantityReceived: l.quantity, scannedCount: l.scanned })),
        });
        setDone({ stock: counted.reduce((s, l) => s + l.quantity, 0), labels: Object.values(r.labels ?? {}).reduce((s, c) => s + c.length, 0), reference: r.labelReference, number: po.orderNumber, byScan: allScanned, items: counted.filter(l => !l.trackItems).map(l => ({ id: l.productId, n: l.quantity })) });
      } else {
        const r = await api.post<{ reference: string; number: string; byScan: boolean; labels: Record<string, string[]> }>("/tracking/goods-in", {
          branchId, supplierName: supplier.trim() || undefined, reason: allScanned ? undefined : reason,
          lines: counted.map(l => ({ productId: l.productId, quantity: l.quantity, scanned: l.scanned })),
        });
        const n = Object.values(r.labels).reduce((s, c) => s + c.length, 0);
        setDone({ stock: counted.reduce((s, l) => s + l.quantity, 0), labels: n, reference: n ? r.reference : null, number: r.number, byScan: r.byScan, items: counted.filter(l => !l.trackItems).map(l => ({ id: l.productId, n: l.quantity })) });
      }
      setLines([]); setReason("");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  if (done) return (
    <AppShell title="Goods in">
      <div className="sc-done">
        <div className="sc-done-tick" aria-hidden="true">✓</div>
        <h2>{done.stock} item{done.stock === 1 ? "" : "s"} added to {branchName}</h2>
        <p className="muted">{done.number}{done.byScan ? " · every item scanned" : " · some typed by hand, the manager will check"}</p>
        {done.labels > 0 && <p><b>{done.labels} item{done.labels === 1 ? " needs" : "s need"} its own WHOLESTRA label.</b> Print them now and stick one on each item before it goes on the shelf.</p>}
        {done.items.length > 0 && <p className="muted">Goods that do not carry their WHOLESTRA code yet: print their product labels and stick one on each.</p>}
        <div className="sc-done-acts">
          {done.labels > 0 && done.reference && <a className="sc-go" href={`/labels?ref=${done.reference}`}>Print {done.labels} item label{done.labels === 1 ? "" : "s"}</a>}
          {done.items.length > 0 && <a className={done.labels > 0 ? "secondary btn-link" : "sc-go"} href={`/labels?products=${done.items.map(i => `${i.id}:${i.n}`).join(",")}`}>Print product labels ({done.items.reduce((t, i) => t + i.n, 0)})</a>}
          <button type="button" className="secondary" onClick={() => { setDone(null); setPoId(""); }}>Receive more goods</button>
          <a className="secondary btn-link" href="/scan">Back to Scan</a>
        </div>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="Goods in">
      <div className="sc-page">
        <p className="sc-intro">Scan every item as it comes off the truck. Each scan counts one. When you finish, the stock is added to the branch{po ? " and the purchase order is updated" : ""}.</p>
        {branchError && <div className="error">{branchError}</div>}
        <div className="sc-setup">
          {branches.length > 1 && <label>Branch<select value={branchId} onChange={e => { setBranchId(e.target.value); setPoId(""); }}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
          <label>Purchase order
            <select value={poId} onChange={e => setPoId(e.target.value)}>
              <option value="">No order (scan whatever arrived)</option>
              {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber}{o.supplier?.name ? ` · ${o.supplier.name}` : ""}</option>)}
            </select>
          </label>
          {!po && <label>Supplier (optional)<input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Who brought it" maxLength={120} /></label>}
        </div>
        <ScanSession lines={lines} setLines={setLines} allowAdd={!po} countUp branchId={branchId} disabled={busy || !branchId} />
        {error && <div className="error">{error}</div>}
        <ConfirmBar lines={lines} reason={reason} setReason={setReason} onConfirm={confirm} busy={busy} label={`Add to ${branchName || "stock"}`} />
      </div>
    </AppShell>
  );
}
