'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "../AppShell";
import CameraScanner from "../CameraScanner";
import { useWorkBranch } from "./useWorkBranch";
import { api, ApiError } from "../../lib/api";
import { useScanner } from "../../lib/scanner";
import { getSessionUser, SessionUser } from "../../lib/session";
import { toast } from "../../lib/toast";
import "./scan.css";

interface Step { type: string; at: string; branch: string | null; by: string | null; note: string | null }
type Found =
  | { kind: "item"; code: string; status: string; where: string; product: { id: string; name: string; sku: string }; branch: string | null; history: Step[] }
  | { kind: "product"; product: { id: string; name: string; sku: string; trackItems: boolean }; branches: { branch: string; quantity: number }[]; inTransit: { transferId: string; transferNumber: string; from: string; to: string; quantity: number; since: string | null }[]; missingItems: number };
interface Issue {
  id: string; kind: string; status: "OPEN" | "EXPLAINED" | "CLOSED"; title: string; detail: string; branch: string; otherBranch: string | null; by: string | null; createdAt: string;
  explanation: string | null; explainedBy: string | null; outcome: string | null; resolution: string | null; resolvedBy: string | null; resolvedAt: string | null; userId: string | null; referenceNumber: string | null;
}
interface Unlabelled { productId: string; name: string; sku: string; onHand: number; labelled: number; missing: number }

const STEP: Record<string, string> = { LABELLED: "Labelled", SENT: "Sent", ARRIVED: "Arrived", MISSING: "Went missing", FOUND: "Found", SOLD: "Sold", RETURNED: "Returned", RELEASED: "Handed to customer" };
const KIND: Record<string, string> = { NOT_SCANNED_SEND: "Sent without scanning", NOT_SCANNED_RECEIVE: "Received without scanning", NOT_SCANNED_RECEIPT: "Goods in without scanning", SHORT_TRANSFER: "Fewer arrived than were sent", ITEM_MISSING: "Item missing", NOT_SCANNED_RELEASE: "Goods out without scanning", CUSTOMER_SHORT: "Customer reports a problem" };
const OUTCOME: Record<string, string> = { CLEARED: "Cleared, no one at fault", AT_FAULT: "Found at fault", RECOVERED: "Goods recovered" };
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Item tracking: find any item or product by scanning it, answer handover questions, and print labels for stock that has none. */
export default function Tracking() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<"find" | "issues" | "labels">("find");
  useEffect(() => {
    setUser(getSessionUser());
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "issues" || t === "labels") setTab(t);
  }, []);
  const can = (p: string) => !!user?.permissions.includes(p);
  function go(t: typeof tab) { setTab(t); const u = new URL(window.location.href); u.searchParams.set("tab", t); window.history.replaceState(null, "", u.toString()); }

  return (
    <AppShell title="Item tracking">
      <div className="tk">
        <div className="tk-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "find"} className={tab === "find" ? "on" : ""} onClick={() => go("find")}>Find</button>
          <button role="tab" aria-selected={tab === "issues"} className={tab === "issues" ? "on" : ""} onClick={() => go("issues")}>Questions</button>
          {can("GOODS_RECEIVING:CREATE") && <button role="tab" aria-selected={tab === "labels"} className={tab === "labels" ? "on" : ""} onClick={() => go("labels")}>Labels</button>}
        </div>
        {tab === "find" && <FindTab canFound={can("GOODS_RECEIVING:CREATE") || can("STOCK_TRANSFERS:UPDATE")} />}
        {tab === "issues" && <IssuesTab user={user} />}
        {tab === "labels" && <LabelsTab />}
      </div>
    </AppShell>
  );
}

function FindTab({ canFound }: { canFound: boolean }) {
  const { branchId, branchName } = useWorkBranch();
  const [code, setCode] = useState("");
  const [res, setRes] = useState<Found | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);

  async function look(c: string) {
    const v = c.trim(); if (!v) return;
    setCode(v); setBusy(true); setError(""); setRes(null);
    try { setRes(await api.get<Found>(`/tracking/find?code=${encodeURIComponent(v)}`)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not look this up."); }
    finally { setBusy(false); }
  }
  useScanner((c) => void look(c));
  function submit(e: FormEvent) { e.preventDefault(); void look(code); }

  async function markFound() {
    if (res?.kind !== "item") return;
    try { const r = await api.post<{ message: string }>(`/tracking/items/${res.code}/found`, { branchId }); toast.success(r.message); void look(res.code); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not save."); }
  }

  return (
    <div className="tk-find">
      <form className="tk-search" onSubmit={submit}>
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="Scan, or type a label, barcode or SKU" aria-label="Code to find" data-scan-passthrough="1" />
        <button disabled={busy}>{busy ? "…" : "Find"}</button>
        <button type="button" className="secondary" onClick={() => setCamera(true)}>Camera</button>
      </form>
      {error && <div className="error">{error}</div>}
      {res?.kind === "item" && (
        <div className={`tk-card st-${res.status.toLowerCase()}`}>
          <div className="tk-head"><div><b>{res.product.name}</b><span>{res.product.sku} · label {res.code}</span></div><em>{res.status.replace("_", " ")}</em></div>
          <p className="tk-where">{res.where}</p>
          {res.status === "MISSING" && canFound && <button onClick={markFound}>It is here: put it back in stock at {branchName}</button>}
          <ol className="tk-story">
            {res.history.map((h, i) => <li key={i}><b>{STEP[h.type] ?? h.type}</b><span>{when(h.at)}{h.branch ? ` · ${h.branch}` : ""}{h.by ? ` · ${h.by}` : ""}</span>{h.note && <small>{h.note}</small>}</li>)}
          </ol>
        </div>
      )}
      {res?.kind === "product" && (
        <div className="tk-card">
          <div className="tk-head"><div><b>{res.product.name}</b><span>{res.product.sku}{res.product.trackItems ? " · label on each item" : ""}</span></div></div>
          <h3>In stock</h3>
          {res.branches.length ? <ul className="tk-rows">{res.branches.map(b => <li key={b.branch}><span>{b.branch}</span><b>{b.quantity}</b></li>)}</ul> : <p className="muted">None in stock.</p>}
          {res.inTransit.length > 0 && <><h3>On the way</h3><ul className="tk-rows">{res.inTransit.map(t => <li key={t.transferId}><span>{t.transferNumber}: {t.from} → {t.to}{t.since ? ` · since ${when(t.since)}` : ""}</span><b>{t.quantity}</b></li>)}</ul></>}
          {res.missingItems > 0 && <p className="tk-miss">{res.missingItems} labelled item{res.missingItems === 1 ? " is" : "s are"} missing. Scan a label to see where each was last seen.</p>}
          {!res.product.trackItems && <p className="muted tk-note">This product is counted by its barcode, so WHOLESTRA knows how many are where, and at which handover any went missing. To follow each single item, turn on "Track each item" on the product.</p>}
        </div>
      )}
      {!res && !error && <p className="tk-hint">Scan a WHOLESTRA item label to see that item&apos;s whole journey, or a product barcode to see where that product is right now.</p>}
      {camera && <CameraScanner title="Scan a label" onScan={(c) => void look(c)} onClose={() => setCamera(false)} />}
    </div>
  );
}

function IssuesTab({ user }: { user: SessionUser | null }) {
  const [status, setStatus] = useState<"OPEN" | "CLOSED">("OPEN");
  const [list, setList] = useState<Issue[] | null>(null);
  const [open, setOpen] = useState<string>("");
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState("CLEARED");
  const [busy, setBusy] = useState(false);
  const canDecide = !!user?.permissions.includes("AUDIT:READ");
  function load() { api.get<Issue[]>(`/tracking/issues?status=${status}`).then(setList).catch(() => setList([])); }
  useEffect(load, [status]);

  async function act(i: Issue, what: "explain" | "close") {
    setBusy(true);
    try {
      await api.patch(`/tracking/issues/${i.id}/${what}`, what === "explain" ? { explanation: text } : { outcome, resolution: text });
      toast.success(what === "explain" ? "Your explanation was sent to the owner." : "Closed."); setText(""); setOpen(""); load();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  return (
    <div className="tk-issues">
      <div className="tk-filter">
        <button className={status === "OPEN" ? "on" : ""} onClick={() => setStatus("OPEN")}>To deal with</button>
        <button className={status === "CLOSED" ? "on" : ""} onClick={() => setStatus("CLOSED")}>Closed</button>
      </div>
      {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="tk-hint">{status === "OPEN" ? "Nothing to explain. Every handover was scanned and matched." : "No closed questions yet."}</p> :
        <ul className="tk-ilist">{list.map(i => (
          <li key={i.id} className={`k-${i.kind.toLowerCase()} s-${i.status.toLowerCase()}`}>
            <button className="tk-ihead" onClick={() => { setOpen(open === i.id ? "" : i.id); setText(""); }} aria-expanded={open === i.id}>
              <span className="tk-kind">{KIND[i.kind] ?? i.kind}</span>
              <b>{i.title}</b>
              <span className="tk-meta">{i.branch}{i.otherBranch ? ` ↔ ${i.otherBranch}` : ""} · {when(i.createdAt)}{i.by ? ` · by ${i.by}` : ""}</span>
              <em className={`tk-st ${i.status.toLowerCase()}`}>{i.status === "OPEN" ? "Needs an answer" : i.status === "EXPLAINED" ? "Waiting for decision" : OUTCOME[i.outcome ?? ""] ?? "Closed"}</em>
            </button>
            {open === i.id && (
              <div className="tk-ibody">
                <p className="tk-detail">{i.detail}</p>
                {i.explanation && <div className="tk-said"><b>What the branch said{i.explainedBy ? ` (${i.explainedBy})` : ""}</b><p>{i.explanation}</p></div>}
                {i.status === "CLOSED" && <div className="tk-said"><b>Decision{i.resolvedBy ? ` by ${i.resolvedBy}` : ""}: {OUTCOME[i.outcome ?? ""]}</b><p>{i.resolution}</p></div>}
                {i.status !== "CLOSED" && <>
                  <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={1000} placeholder={canDecide ? "Your decision, or a question for the branch" : "Explain what happened"} />
                  <div className="tk-iacts">
                    <button className="secondary" disabled={busy || text.trim().length < 5} onClick={() => act(i, "explain")}>{canDecide ? "Add a note" : "Send explanation"}</button>
                    {canDecide && i.userId !== user?.id && <>
                      <select value={outcome} onChange={e => setOutcome(e.target.value)} aria-label="Outcome">{Object.entries(OUTCOME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      <button disabled={busy || text.trim().length < 3} onClick={() => act(i, "close")}>Close with this decision</button>
                    </>}
                  </div>
                </>}
              </div>
            )}
          </li>
        ))}</ul>}
    </div>
  );
}

function LabelsTab() {
  const { branches, branchId, setBranchId, branchName } = useWorkBranch();
  const [rows, setRows] = useState<Unlabelled[] | null>(null);
  const [busy, setBusy] = useState("");
  function load() { if (branchId) api.get<Unlabelled[]>(`/tracking/unlabelled?branchId=${branchId}`).then(setRows).catch(() => setRows([])); }
  useEffect(load, [branchId]);
  async function make(r: Unlabelled) {
    setBusy(r.productId);
    try { const res = await api.post<{ reference: string }>("/tracking/labels", { productId: r.productId, branchId, quantity: r.missing }); window.location.href = `/labels?ref=${res.reference}`; }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not make the labels."); setBusy(""); }
  }
  return (
    <div className="tk-labels">
      {branches.length > 1 && <label className="sc-branch">Branch<select value={branchId} onChange={e => setBranchId(e.target.value)}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <p className="tk-hint">Products set to &quot;Track each item&quot; need a WHOLESTRA label on every item. New goods get labels when they are scanned in. Stock that was already on the shelf is listed here.</p>
      {rows === null ? <p className="muted">Loading…</p> : rows.length === 0 ? <p className="tk-hint">Every tracked item at {branchName} has a label.</p> :
        <ul className="tk-rows big">{rows.map(r => (
          <li key={r.productId}><span><b>{r.name}</b><small>{r.sku} · {r.onHand} on the shelf, {r.labelled} labelled</small></span>
            <button disabled={!!busy} onClick={() => make(r)}>{busy === r.productId ? "Making…" : `Print ${r.missing} label${r.missing === 1 ? "" : "s"}`}</button></li>
        ))}</ul>}
    </div>
  );
}
