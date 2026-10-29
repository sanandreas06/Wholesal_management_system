'use client';
import { useEffect, useState } from "react";
import AppShell from "../AppShell";
import { useWorkBranch } from "./useWorkBranch";
import { api } from "../../lib/api";
import { getSessionUser, SessionUser } from "../../lib/session";
import { usePolling } from "../../hooks/usePolling";
import "./scan.css";

interface Transfer { id: string; transferNumber: string; status: string; dispatchedAt?: string | null; createdAt: string; fromBranch: { id: string; name: string }; toBranch: { id: string; name: string }; items: { quantity: number; sentQuantity: number | null }[] }
interface Unlabelled { productId: string; name: string; missing: number }

const units = (t: Transfer) => t.items.reduce((s, i) => s + (i.sentQuantity ?? i.quantity), 0);
const ago = (iso?: string | null) => { if (!iso) return ""; const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000); return h < 1 ? "just now" : h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`; };

/** The store person's home: what is waiting to be scanned at this branch, and the four jobs (goods in, send, receive, find). */
export default function ScanHub() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const { branches, branchId, setBranchId, branchName } = useWorkBranch();
  const [transfers, setTransfers] = useState<Transfer[] | null>(null);
  const [unlabelled, setUnlabelled] = useState<Unlabelled[]>([]);
  const [issues, setIssues] = useState(0);
  const [owed, setOwed] = useState(0);
  const [noCode, setNoCode] = useState<string[]>([]);
  useEffect(() => setUser(getSessionUser()), []);
  const can = (p: string) => !!user?.permissions.includes(p);

  function load() {
    if (!branchId) return;
    api.get<Transfer[]>("/stock-transfers").then(setTransfers).catch(() => setTransfers([]));
    api.get<Unlabelled[]>(`/tracking/unlabelled?branchId=${branchId}`).then(setUnlabelled).catch(() => setUnlabelled([]));
    api.get<{ status: string }[]>("/tracking/issues?status=OPEN").then(l => setIssues(l.length)).catch(() => setIssues(0));
    api.get<unknown[]>(`/releases/owed?branchId=${branchId}`).then(l => setOwed(l.length)).catch(() => setOwed(0));
    api.get<{ name: string; barcodes?: string[]; trackItems?: boolean }[]>(`/products?branchId=${branchId}`).then(ps => setNoCode(ps.filter(p => !p.barcodes?.length && !p.trackItems).map(p => p.name))).catch(() => setNoCode([]));
  }
  useEffect(load, [branchId]);
  usePolling(load, 15000);

  const toSend = (transfers ?? []).filter(t => t.status === "APPROVED" && t.fromBranch.id === branchId);
  const toReceive = (transfers ?? []).filter(t => t.status === "DISPATCHED" && t.toBranch.id === branchId);
  const missingLabels = unlabelled.reduce((s, u) => s + u.missing, 0);

  return (
    <AppShell title="Scan">
      <div className="sc-hub">
        {branches.length > 1 && <label className="sc-branch">Working at<select value={branchId} onChange={e => setBranchId(e.target.value)}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}

        <div className="sc-tiles">
          {can("GOODS_RECEIVING:CREATE") && <a className="sc-tile" href="/scan/goods-in"><span className="sc-ti" aria-hidden="true">📦</span><b>Goods in</b><small>Scan goods arriving from a supplier</small></a>}
          {can("STOCK_TRANSFERS:UPDATE") && <a className="sc-tile" href="#send"><span className="sc-ti" aria-hidden="true">🚚</span><b>Send</b><small>{toSend.length ? `${toSend.length} transfer${toSend.length === 1 ? "" : "s"} ready to load` : "Nothing to send"}</small></a>}
          {can("STOCK_TRANSFERS:UPDATE") && <a className="sc-tile" href="#receive"><span className="sc-ti" aria-hidden="true">📥</span><b>Receive</b><small>{toReceive.length ? `${toReceive.length} on the way to ${branchName}` : "Nothing on the way"}</small></a>}
          {(can("SALES:CREATE") || can("SALES:UPDATE") || can("STOCK_TRANSFERS:UPDATE")) && <a className="sc-tile" href="/scan/release"><span className="sc-ti" aria-hidden="true">🤝</span><b>Release to customer</b><small>{owed ? `${owed} customer${owed === 1 ? "" : "s"} waiting for paid goods` : "Goods paid for, collected or delivered"}</small></a>}
          <a className="sc-tile" href="/tracking"><span className="sc-ti" aria-hidden="true">🔎</span><b>Find an item</b><small>Scan any label to see where it is and where it has been</small></a>
        </div>

        {issues > 0 && <a className="sc-alert" href="/tracking?tab=issues"><b>{issues} handover{issues === 1 ? "" : "s"} to explain</b><span>Goods not scanned, or fewer arrived than were sent. Open to explain.</span></a>}
        {noCode.length > 0 && can("PRODUCTS:UPDATE") && <a className="sc-alert soft" href="/products"><b>{noCode.length} product{noCode.length === 1 ? " has" : "s have"} no barcode, so {noCode.length === 1 ? "it" : "they"} cannot be checked by scanning</b><span>{noCode.slice(0, 3).join(", ")}{noCode.length > 3 ? ` and ${noCode.length - 3} more` : ""}. Open the product, press &quot;No barcode? Make one&quot;, then print labels.</span></a>}
        {missingLabels > 0 && can("GOODS_RECEIVING:CREATE") && <a className="sc-alert soft" href="/tracking?tab=labels"><b>{missingLabels} item{missingLabels === 1 ? "" : "s"} at {branchName} still need a label</b><span>{unlabelled.slice(0, 3).map(u => `${u.missing} × ${u.name}`).join(", ")}{unlabelled.length > 3 ? "…" : ""}</span></a>}

        {can("STOCK_TRANSFERS:UPDATE") && <>
          <h2 id="send" className="sc-h">Ready to send from {branchName}</h2>
          {transfers === null ? <p className="muted">Loading…</p> : toSend.length === 0 ? <p className="sc-none">No approved transfers waiting to go out.</p> :
            <ul className="sc-list">{toSend.map(t => (
              <li key={t.id}><a href={`/scan/transfer?id=${t.id}&mode=send`}><b>{t.transferNumber}</b><span>To {t.toBranch.name} · {units(t)} item{units(t) === 1 ? "" : "s"}</span><em>Scan to send →</em></a></li>
            ))}</ul>}
          <h2 id="receive" className="sc-h">On the way to {branchName}</h2>
          {transfers === null ? <p className="muted">Loading…</p> : toReceive.length === 0 ? <p className="sc-none">Nothing is on the way here.</p> :
            <ul className="sc-list">{toReceive.map(t => (
              <li key={t.id} className={t.dispatchedAt && Date.now() - new Date(t.dispatchedAt).getTime() > 48 * 3600000 ? "late" : ""}><a href={`/scan/transfer?id=${t.id}&mode=receive`}><b>{t.transferNumber}</b><span>From {t.fromBranch.name} · {units(t)} item{units(t) === 1 ? "" : "s"} · sent {ago(t.dispatchedAt)}</span><em>Scan to receive →</em></a></li>
            ))}</ul>}
        </>}
      </div>
    </AppShell>
  );
}
