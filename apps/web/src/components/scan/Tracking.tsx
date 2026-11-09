'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "../AppShell";
import CameraScanner from "../CameraScanner";
import { useWorkBranch } from "./useWorkBranch";
import { api, ApiError } from "../../lib/api";
import { useScanner } from "../../lib/scanner";
import { getSessionUser, SessionUser } from "../../lib/session";
import { toast } from "../../lib/toast";
import dynamic from "next/dynamic";
import { TripView } from "../map/TripPanel";
import { ago } from "../../lib/geo";
import { usePolling } from "../../hooks/usePolling";
const LiveMap = dynamic(() => import("../map/LiveMap"), { ssr: false });
import "./scan.css";

interface Step { type: string; at: string; branch: string | null; by: string | null; note: string | null; lat?: number | null; lng?: number | null }
interface TripRef { id: string; status: string; driverName: string; vehicle: string | null; lastAt: string | null; live: boolean }
type Found =
  | { kind: "item"; code: string; status: string; where: string; product: { id: string; name: string; sku: string }; branch: string | null; history: Step[]; trip?: TripRef | null }
  | { kind: "product"; product: { id: string; name: string; sku: string; trackItems: boolean; ownCode?: string | null }; branches: { branch: string; quantity: number }[]; inTransit: { transferId: string; transferNumber: string; from: string; to: string; quantity: number; since: string | null; trip?: TripRef | null }[]; missingItems: number };
interface Issue {
  id: string; kind: string; status: "OPEN" | "EXPLAINED" | "CLOSED"; title: string; detail: string; branch: string; otherBranch: string | null; by: string | null; createdAt: string;
  explanation: string | null; explainedBy: string | null; outcome: string | null; resolution: string | null; resolvedBy: string | null; resolvedAt: string | null; userId: string | null; referenceNumber: string | null;
}
interface Unlabelled { productId: string; name: string; sku: string; onHand: number; labelled: number; missing: number }

const STEP: Record<string, string> = { LABELLED: "Label printed", STUCK: "Label stuck on and scanned", CANCELLED: "Label cancelled (no item for it)", SENT: "Sent", ARRIVED: "Arrived", MISSING: "Went missing", FOUND: "Found", SOLD: "Sold", RETURNED: "Returned", RELEASED: "Handed to customer" };
const KIND: Record<string, string> = { NOT_SCANNED_SEND: "Sent without scanning", NOT_SCANNED_RECEIVE: "Received without scanning", NOT_SCANNED_RECEIPT: "Goods in without scanning", SHORT_TRANSFER: "Fewer arrived than were sent", ITEM_MISSING: "Item missing", NOT_SCANNED_RELEASE: "Goods out without scanning", CUSTOMER_SHORT: "Customer reports a problem", LABELS_LEFT_OVER: "Fewer items than were counted", NOT_ON_SHELF: "Items not on the shelf" };
const OUTCOME: Record<string, string> = { CLEARED: "Cleared, no one at fault", AT_FAULT: "Found at fault", RECOVERED: "Goods recovered" };
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Item tracking: find any item or product by scanning it, answer handover questions, and print labels for stock that has none. */
export default function Tracking() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<"find" | "road" | "issues" | "labels">("find");
  useEffect(() => {
    setUser(getSessionUser());
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "issues" || t === "labels" || t === "road") setTab(t);
  }, []);
  const can = (p: string) => !!user?.permissions.includes(p);
  function go(t: typeof tab) { setTab(t); const u = new URL(window.location.href); u.searchParams.set("tab", t); window.history.replaceState(null, "", u.toString()); }

  return (
    <AppShell title="Item tracking">
      <div className="tk">
        <div className="tk-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "find"} className={tab === "find" ? "on" : ""} onClick={() => go("find")}>Find</button>
          <button role="tab" aria-selected={tab === "road"} className={tab === "road" ? "on" : ""} onClick={() => go("road")}>On the road</button>
          <button role="tab" aria-selected={tab === "issues"} className={tab === "issues" ? "on" : ""} onClick={() => go("issues")}>Questions</button>
          {can("GOODS_RECEIVING:CREATE") && <button role="tab" aria-selected={tab === "labels"} className={tab === "labels" ? "on" : ""} onClick={() => go("labels")}>Labels</button>}
        </div>
        {tab === "find" && <FindTab canFound={can("GOODS_RECEIVING:CREATE") || can("STOCK_TRANSFERS:UPDATE")} />}
        {tab === "road" && <RoadTab />}
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
  const [showTrip, setShowTrip] = useState("");

  async function look(c: string) {
    const v = c.trim(); if (!v) return;
    setCode(v); setBusy(true); setError(""); setRes(null);
    try { setRes(await api.get<Found>(`/tracking/find?code=${encodeURIComponent(v)}`)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not look this up."); }
    finally { setBusy(false); }
  }
  useScanner((c) => void look(c));
  // opened from a phone camera reading a WHOLESTRA QR (…/f/<code> leads here with ?code=)
  useEffect(() => { const c = new URLSearchParams(window.location.search).get("code"); if (c) void look(c); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
          {res.trip && <div className="tk-live"><h3>{res.trip.live ? "Where it is now" : "On the road"}</h3><TripView tripId={res.trip.id} height={300} /></div>}
          {!res.trip && res.history.some(h => h.lat != null) && <div className="tk-live"><h3>Where it was scanned</h3>
            <LiveMap height={240} pins={res.history.filter(h => h.lat != null && h.lng != null).map(h => ({ kind: "scan" as const, lat: h.lat!, lng: h.lng!, label: STEP[h.type] ?? h.type, sub: `${when(h.at)}${h.branch ? ` · ${h.branch}` : ""}` }))} /></div>}
          <ol className="tk-story">
            {res.history.map((h, i) => <li key={i}><b>{STEP[h.type] ?? h.type}</b><span>{when(h.at)}{h.branch ? ` · ${h.branch}` : ""}{h.by ? ` · ${h.by}` : ""}</span>{h.note && <small>{h.note}</small>}</li>)}
          </ol>
        </div>
      )}
      {res?.kind === "product" && (
        <div className="tk-card">
          <div className="tk-head"><div><b>{res.product.name}</b><span>{res.product.sku}{res.product.ownCode ? ` · code ${res.product.ownCode}` : ""}{res.product.trackItems ? " · label on each item" : ""}</span></div></div>
          <h3>In stock</h3>
          {res.branches.length ? <ul className="tk-rows">{res.branches.map(b => <li key={b.branch}><span>{b.branch}</span><b>{b.quantity}</b></li>)}</ul> : <p className="muted">None in stock.</p>}
          {res.inTransit.length > 0 && <><h3>On the way</h3><ul className="tk-rows">{res.inTransit.map(t => <li key={t.transferId}><span>{t.transferNumber}: {t.from} → {t.to}{t.since ? ` · since ${when(t.since)}` : ""}{t.trip?.live ? <> · <button type="button" className="linkish" onClick={() => setShowTrip(showTrip === t.trip!.id ? "" : t.trip!.id)}>{showTrip === t.trip.id ? "hide map" : `live, seen ${ago(t.trip.lastAt)}`}</button></> : ""}</span><b>{t.quantity}</b></li>)}</ul>
            {showTrip && <div className="tk-live"><TripView tripId={showTrip} height={300} /></div>}</>}
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

interface TrackAll { on: boolean; products: number; tracked: number }
interface OpenRun { reference: string; kind: string; number: string; createdAt: string; waiting: number }
const may = (p: string) => !!getSessionUser()?.permissions.includes(p);

/**
 * The company switch: every single item of every product gets its own label. A product barcode is the same on every bag, so
 * scanning one bag twice counts as two; a label on each item can only be counted once, anywhere.
 */
function EveryItemSwitch({ onChanged }: { onChanged: () => void }) {
  const [s, setS] = useState<TrackAll | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const mayChange = may("ORGANIZATION:UPDATE");
  useEffect(() => { api.get<TrackAll>("/tracking/track-all").then(setS).catch(() => setS(null)); }, []);
  async function set(on: boolean) {
    setBusy(true);
    try { const r = await api.put<TrackAll & { changed: number }>("/tracking/track-all", { on }); setS(r); setAsking(false); toast.success(on ? `Every item now gets its own label${r.changed ? ` (${r.changed} product${r.changed === 1 ? "" : "s"} switched on)` : ""}.` : "New products will no longer be tracked one by one."); onChanged(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not change it."); }
    finally { setBusy(false); }
  }
  if (!s) return null;
  const left = s.products - s.tracked;
  return (<>
    <div className={`tk-switch${s.on ? " on" : ""}`}>
      <div>
        <b>{s.on ? "Every item has its own label" : "Give every item its own label"}</b>
        <p>{s.on
          ? <>Every product is tracked one by one, new products too. Each label can be scanned once, so nobody can scan one bag twice to cover for one that went missing.{left > 0 && <> {left} product{left === 1 ? " was" : "s were"} switched off by hand since.</>}</>
          : left === 0
            ? <>All {s.products} products have a label on each item, but new products will not unless someone ticks &quot;Track each item&quot;. Turn this on so new products are tracked too.</>
            : <>Now {s.tracked} of {s.products} products have a label on each item. The other {left} are counted by a barcode that is the same on every bag, so scanning one bag twice counts as two.</>}</p>
      </div>
      {mayChange && (s.on
        ? <>{left > 0 && <button className="sc-mini" disabled={busy} onClick={() => set(true)}>Switch all on again</button>}<button className="linkish" disabled={busy} onClick={() => set(false)}>Turn off for new products</button></>
        : <button className="sc-go" disabled={busy} onClick={() => left === 0 ? set(true) : setAsking(true)}>{left === 0 ? "Turn on for new products too" : "Turn on for every product"}</button>)}
    </div>
      {asking && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Give every item its own label">
          <div className="modal tk-confirm">
            <h3>Give every item its own label?</h3>
            <ul>
              <li>All {s.products} products get <b>Track each item</b>, and every new product will too.</li>
              <li>Goods coming in get one label per item, printed at Goods in. Each label is stuck on and scanned, and only scanned labels become stock, so a bag scanned twice while counting leaves a label with nothing to go on, which never counts.</li>
              <li><b>Stock already on your shelves needs labels first.</b> After this, press <b>Print all missing labels</b> below for each branch, then stick them on and scan them. A label with no item to go on means that item is not there.</li>
              <li>From then on the counter, sending, receiving and releasing only accept the item&apos;s own label, and each label counts once.</li>
            </ul>
            <div className="tk-confirm-act"><button className="linkish" onClick={() => setAsking(false)} disabled={busy}>Not now</button><button className="sc-go" onClick={() => set(true)} disabled={busy}>{busy ? "Switching on…" : "Yes, turn it on"}</button></div>
          </div>
        </div>
      )}
  </>);
}

function LabelsTab() {
  const { branches, branchId, setBranchId, branchName } = useWorkBranch();
  const [rows, setRows] = useState<Unlabelled[] | null>(null);
  const [busy, setBusy] = useState("");
  function load() { if (branchId) api.get<Unlabelled[]>(`/tracking/unlabelled?branchId=${branchId}`).then(setRows).catch(() => setRows([])); }
  useEffect(load, [branchId]);
  async function makeAll() {
    setBusy("all");
    try { const res = await api.post<{ reference: string; made: number; remaining: number }>("/tracking/labels/all", { branchId }); if (res.remaining > 0) toast.success(`${res.made} labels made. Print and stick these, then press again for the other ${res.remaining}.`); window.location.href = `/labels?ref=${res.reference}`; }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not make the labels."); setBusy(""); }
  }
  const missingAll = (rows ?? []).reduce((t, r) => t + r.missing, 0);
  const [runs, setRuns] = useState<OpenRun[]>([]);
  useEffect(() => { if (branchId) api.get<OpenRun[]>(`/tracking/stick?branchId=${branchId}`).then(setRuns).catch(() => setRuns([])); }, [branchId]);
  async function make(r: Unlabelled) {
    setBusy(r.productId);
    try { const res = await api.post<{ reference: string }>("/tracking/labels", { productId: r.productId, branchId, quantity: r.missing }); window.location.href = `/labels?ref=${res.reference}`; }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not make the labels."); setBusy(""); }
  }
  return (
    <div className="tk-labels">
      {branches.length > 1 && <label className="sc-branch">Branch<select value={branchId} onChange={e => setBranchId(e.target.value)}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <EveryItemSwitch onChanged={load} />
      {runs.length > 0 && <>
        <p className="tk-hint"><b>Labels printed but not stuck on and scanned yet.</b> They are not stock until each one is scanned on its item.</p>
        <ul className="st-runs">{runs.map(r => <li key={r.reference}><a href={`/scan/stick?ref=${r.reference}`}><b>{r.number}</b><span>{r.waiting} label{r.waiting === 1 ? "" : "s"} waiting · {when(r.createdAt)}</span><em>Stick and scan →</em></a></li>)}</ul>
      </>}
      <p className="tk-hint">Products set to &quot;Track each item&quot; need a WHOLESTRA label on every item. New goods get labels when they are scanned in. Stock that was already on the shelf is listed here.</p>
      {rows === null ? <p className="muted">Loading…</p> : rows.length === 0 ? <p className="tk-hint">Every tracked item at {branchName} has a label.</p> : <>
        {may("GOODS_RECEIVING:CREATE") && <button className="sc-go tk-all" disabled={!!busy} onClick={makeAll}>{busy === "all" ? "Making labels…" : `Print all missing labels (${missingAll}${missingAll > 1000 ? ", 1000 at a time" : ""})`}</button>}
        <ul className="tk-rows big">{rows.map(r => (
          <li key={r.productId}><span><b>{r.name}</b><small>{r.sku} · {r.onHand} on the shelf, {r.labelled} labelled</small></span>
            <button disabled={!!busy} onClick={() => make(r)}>{busy === r.productId ? "Making…" : `Print ${r.missing} label${r.missing === 1 ? "" : "s"}`}</button></li>
        ))}</ul></>}
    </div>
  );
}

interface RoadTrip { id: string; kind: string; status: string; driverName: string; vehicle: string | null; from: { label: string; lat: number | null; lng: number | null }; to: { label: string; lat: number | null; lng: number | null }; last: { lat: number; lng: number; at: string } | null; kmLeft: number | null; transferId: string | null; releaseId: string | null }

/** Every vehicle carrying goods right now, on one map, like a dispatcher's screen. */
function RoadTab() {
  const [trips, setTrips] = useState<RoadTrip[] | null>(null);
  const [open, setOpen] = useState("");
  function load() { api.get<RoadTrip[]>("/trips?active=1").then(setTrips).catch(() => setTrips([])); }
  useEffect(load, []);
  usePolling(load, 20000);
  if (trips === null) return <p className="muted">Loading…</p>;
  if (!trips.length) return <p className="tk-hint">No goods are on the road with a driver sharing their location. After goods are sent (Scan, then Send) or released for delivery, make the driver&apos;s link and send it on WhatsApp.</p>;
  const pins = trips.flatMap(t => t.last ? [{ kind: "vehicle" as const, lat: t.last.lat, lng: t.last.lng, label: `${t.driverName}${t.vehicle ? ` · ${t.vehicle}` : ""}`, sub: `${t.from.label} → ${t.to.label} · ${ago(t.last.at)}` }] : []);
  return (
    <div className="tk-road">
      {pins.length > 0 && <LiveMap pins={pins} height={360} />}
      <ul className="tk-ilist">{trips.map(t => (
        <li key={t.id}>
          <button className="tk-ihead" onClick={() => setOpen(open === t.id ? "" : t.id)} aria-expanded={open === t.id}>
            <span className="tk-kind">{t.kind === "TRANSFER" ? "Transfer" : "Delivery"}</span>
            <b>{t.from.label} → {t.to.label}</b>
            <span className="tk-meta">{t.driverName}{t.vehicle ? ` · ${t.vehicle}` : ""}{t.last ? ` · seen ${ago(t.last.at)}` : " · not started yet"}{t.kmLeft !== null ? ` · ${t.kmLeft} km to go` : ""}</span>
            <em className={`tk-st ${t.status === "LIVE" ? "explained" : "open"}`}>{t.status === "LIVE" ? "On the road" : "Waiting for driver"}</em>
          </button>
          {open === t.id && <div className="tk-ibody"><TripView tripId={t.id} height={300} /></div>}
        </li>
      ))}</ul>
    </div>
  );
}
