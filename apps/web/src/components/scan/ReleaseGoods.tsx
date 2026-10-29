'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "../AppShell";
import CameraScanner from "../CameraScanner";
import ScanSession, { ScanLine, scanSummary } from "./ScanSession";
import ConfirmBar from "./ConfirmBar";
import { useWorkBranch } from "./useWorkBranch";
import { api, ApiError } from "../../lib/api";
import { useScanner } from "../../lib/scanner";
import "./scan.css";

interface SaleItem { id: string; productId: string; product: { id: string; name: string; sku: string; barcodes: string[]; trackItems: boolean }; quantity: number; released: number; outstanding: number }
interface Sale { id: string; invoiceNumber: string; status: string; fulfilment: string; soldAt: string; branch: { id: string; name: string }; customer: { name: string; phone: string | null } | null; items: SaleItem[]; releases: { id: string; number: string; createdAt: string; units: number; confirmation: { status: string } | null }[] }
interface Owed { id: string; invoiceNumber: string; soldAt: string; customer: { name: string; phone: string | null } | null; owed: { name: string; quantity: number }[] }

const days = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };

/** Goods paid for earlier leave the store: find the sale (scan the receipt or type the invoice number), scan each item out, print the release note. */
export default function ReleaseGoods() {
  const { branchId, branchName } = useWorkBranch();
  const [owed, setOwed] = useState<Owed[] | null>(null);
  const [code, setCode] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [reason, setReason] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  const [done, setDone] = useState<{ id: string; number: string; fulfilment: string } | null>(null);

  useEffect(() => { if (branchId) api.get<Owed[]>(`/releases/owed?branchId=${branchId}`).then(setOwed).catch(() => setOwed([])); }, [branchId, done]);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("sale"); if (id) void open(`/releases/sale/${id}`); }, []);

  async function open(url: string) {
    setError(""); setBusy(true);
    try {
      const s = await api.get<Sale>(url);
      setSale(s); setDone(null); setReason("");
      setLines(s.items.filter(i => i.outstanding > 0).map(i => ({ key: i.id, productId: i.productId, name: i.product.name, sku: i.product.sku, barcodes: i.product.barcodes, trackItems: i.product.trackItems, limit: i.outstanding, quantity: i.outstanding, scanned: 0, codes: [] })));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not find that sale."); }
    finally { setBusy(false); }
  }
  function find(c: string) { const v = c.trim(); if (v) { setCode(v); void open(`/releases/find?code=${encodeURIComponent(v)}`); } }
  useScanner(c => find(c), !sale);
  function submit(e: FormEvent) { e.preventDefault(); find(code); }

  async function confirm() {
    if (!sale) return;
    setBusy(true); setError("");
    const all = scanSummary(lines).missing === 0;
    try {
      const r = await api.post<{ id: string; number: string; fulfilment: string }>("/releases", {
        saleId: sale.id, collectedBy: collectedBy.trim() || undefined, vehicle: vehicle.trim() || undefined, reason: all ? undefined : reason,
        lines: lines.map(l => ({ saleItemId: l.key, quantity: l.quantity, scanned: l.scanned, codes: l.codes.length ? l.codes : undefined })),
      });
      setDone(r); setSale(null); setLines([]); setCode("");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  if (done) return (
    <AppShell title="Release to customer">
      <div className="sc-done">
        <div className="sc-done-tick" aria-hidden="true">✓</div>
        <h2>Goods released</h2>
        <p>{done.number}{done.fulfilment === "PARTLY" ? " · some goods are still waiting for this customer" : " · everything on this sale has gone out"}</p>
        <p className="muted">Print the release note. The QR on it lets the customer confirm what they received.</p>
        <div className="sc-done-acts">
          <a className="sc-go" href={`/release-note?id=${done.id}`} target="_blank" rel="noreferrer">Print release note</a>
          <button type="button" className="secondary" onClick={() => setDone(null)}>Release more</button>
        </div>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="Release to customer">
      <div className="sc-page">
        {!sale && <>
          <p className="sc-intro">A customer has come for goods they paid for, or a delivery is going out. Scan the QR or barcode on their receipt, or type the invoice number.</p>
          <form className="tk-search" onSubmit={submit}>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Invoice number, e.g. INV-00042" aria-label="Invoice number" data-scan-passthrough="1" />
            <button disabled={busy}>{busy ? "…" : "Find"}</button>
            <button type="button" className="secondary" onClick={() => setCamera(true)}>Camera</button>
          </form>
          {error && <div className="error">{error}</div>}
          <h2 className="sc-h">Waiting for collection at {branchName}</h2>
          {owed === null ? <p className="muted">Loading…</p> : owed.length === 0 ? <p className="sc-none">No customer is waiting for goods.</p> :
            <ul className="sc-list">{owed.map(o => (
              <li key={o.id} className={Date.now() - new Date(o.soldAt).getTime() > 3 * 86400000 ? "late" : ""}><a href="#" onClick={e => { e.preventDefault(); void open(`/releases/sale/${o.id}`); }}>
                <b>{o.invoiceNumber}</b><span>{o.customer?.name ?? "Walk-in"} · {o.owed.map(x => `${x.quantity} × ${x.name}`).join(", ")} · paid {days(o.soldAt)}</span><em>Release →</em></a></li>
            ))}</ul>}
        </>}
        {sale && <>
          <div className="sc-route"><b>{sale.invoiceNumber}</b><span>{sale.customer?.name ?? "Walk-in customer"}{sale.customer?.phone ? ` · ${sale.customer.phone}` : ""}</span></div>
          {sale.status !== "COMPLETED" ? <div className="error">This sale was voided. Nothing can go out for it.</div>
            : lines.length === 0 ? <div className="error">Everything on this sale has already gone out{sale.releases.length ? ` (${sale.releases.map(r => r.number).join(", ")})` : ""}.</div>
            : <>
              <p className="sc-intro">Check the number for each product, then scan every item as it goes out. If the customer takes fewer now, lower the number: the rest stays reserved for them.</p>
              <ScanSession lines={lines} setLines={setLines} labelsRequired disabled={busy} branchId={sale.branch.id} />
              <div className="sc-setup" style={{ marginTop: 14 }}>
                <label>Collected by (optional)<input value={collectedBy} onChange={e => setCollectedBy(e.target.value)} maxLength={120} placeholder="Customer or driver's name" /></label>
                <label>Vehicle number (optional)<input value={vehicle} onChange={e => setVehicle(e.target.value)} maxLength={40} placeholder="e.g. GR 1234-22" /></label>
              </div>
              {error && <div className="error">{error}</div>}
              <ConfirmBar lines={lines} reason={reason} setReason={setReason} onConfirm={confirm} busy={busy} label="Release the goods" />
            </>}
          <button type="button" className="secondary" style={{ marginTop: 10 }} onClick={() => { setSale(null); setLines([]); setError(""); }}>← Another sale</button>
        </>}
      </div>
      {camera && <CameraScanner title="Scan the receipt" onScan={c => find(c)} onClose={() => setCamera(false)} />}
    </AppShell>
  );
}
