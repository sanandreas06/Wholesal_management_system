'use client';
import { useEffect, useRef, useState } from "react";
import AppShell from "../AppShell";
import CameraScanner from "../CameraScanner";
import { api, ApiError } from "../../lib/api";
import { scanFeedback, useScanner } from "../../lib/scanner";
import { useHere } from "../../lib/geo";
import "./scan.css";

interface RunLine { productId: string; name: string; sku: string; total: number; waiting: string[]; stuck: number; cancelled: number }
interface Run { reference: string; kind: "GOODS_IN" | "SHELF"; number: string; branch: string; branchId: string; lines: RunLine[]; waiting: number; open: boolean }
interface Result { stuck: number; cancelled: number; waiting: number }

const isItemLabel = (c: string) => /^W[2-9A-HJKMNP-Z]{9}$/i.test(c);
const keyOf = (ref: string) => `wms_stick_${ref}`;

/**
 * Stick and scan. A label only becomes stock once it is on an item and scanned, and each label counts once. So if one bag was
 * scanned twice when the goods were counted, one label is left over with nothing to go on: it is never scanned, never counts,
 * and is cancelled when the person presses Done, which lowers the stock to what was really labelled and asks the owner why.
 */
export default function StickScan() {
  const [ref, setRef] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [scanned, setScanned] = useState<string[]>([]);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const [camera, setCamera] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const latest = useRef(scanned); latest.current = scanned;
  const timer = useRef(0);
  const where = useHere();

  function load(r: string) {
    api.get<Run>(`/tracking/stick/${encodeURIComponent(r)}`).then(x => {
      setRun(x);
      // scans not yet sent are kept on this device, in case the page is closed half way
      const waiting = new Set(x.lines.flatMap(l => l.waiting));
      let kept: string[] = [];
      try { kept = (JSON.parse(localStorage.getItem(keyOf(r)) || "[]") as string[]).filter(c => waiting.has(c)); } catch { /* ignore */ }
      setScanned(kept);
    }).catch(e => setError(e instanceof ApiError ? e.message : "Could not open these labels. Check your connection."));
  }
  useEffect(() => { const r = new URLSearchParams(window.location.search).get("ref") ?? ""; setRef(r); if (r) load(r); else setError("Open this page from Goods in or Item Tracking."); }, []);
  // only once the list is loaded (and the kept scans read back), or an empty list would overwrite them
  useEffect(() => { if (run) try { localStorage.setItem(keyOf(run.reference), JSON.stringify(scanned)); } catch { /* ignore */ } }, [run, scanned]);

  function say(text: string, ok: boolean) {
    scanFeedback(ok); setFlash({ text, ok });
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setFlash(null), ok ? 2200 : 5000);
  }

  function onScan(raw: string) {
    if (!run || busy || result) return;
    const up = raw.trim().toUpperCase();
    if (!isItemLabel(up)) { say("Scan the WHOLESTRA label you stuck on (it starts with W), not the maker's barcode.", false); return; }
    if (latest.current.includes(up)) { say(`Label ${up} was already scanned. Each label counts once.`, false); return; }
    const line = run.lines.find(l => l.waiting.includes(up));
    if (!line) { say(`Label ${up} is not waiting in this list: it was scanned before, or it belongs to other goods. Put that item aside and tell the manager.`, false); return; }
    setScanned(prev => [...prev, up]);
    const n = latest.current.filter(c => line.waiting.includes(c)).length + 1;
    say(`${line.name}: ${line.stuck + n} of ${line.total - line.cancelled} labelled`, true);
  }
  useScanner(onScan, !!run && !result && !asking);

  async function send(finish: boolean) {
    if (!run) return;
    setBusy(true); setError("");
    try {
      const r = await api.post<Result>(`/tracking/stick/${encodeURIComponent(run.reference)}`, { codes: latest.current, finish, where: where.current });
      try { localStorage.removeItem(keyOf(run.reference)); } catch { /* ignore */ }
      setAsking(false); setScanned([]);
      if (finish || r.waiting === 0) setResult(r); else { say(`${r.stuck} saved. Carry on now or later from Item Tracking, then Labels.`, true); load(run.reference); }
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save. Check your connection and try again."); setAsking(false); }
    finally { setBusy(false); }
  }

  const left = run ? run.waiting - scanned.length : 0;
  const shelf = run?.kind === "SHELF";

  if (result && run) return (
    <AppShell title="Stick and scan">
      <div className="sc-done">
        <div className="sc-done-tick" aria-hidden="true">✓</div>
        <h2>{result.stuck} item{result.stuck === 1 ? "" : "s"} labelled and in stock at {run.branch}</h2>
        {result.cancelled > 0
          ? <p><b>{result.cancelled} label{result.cancelled === 1 ? " was" : "s were"} never stuck on an item and {result.cancelled === 1 ? "has" : "have"} been cancelled.</b> {shelf ? "Those items were not on the shelf, so the stock was lowered" : "Fewer items arrived than were counted, so the stock was lowered"} to what was really labelled, and the owner has been asked. Throw the left-over labels away: they no longer work.</p>
          : <p className="muted">Every label is on an item and scanned. Each one can now be scanned once at the counter, when sending, receiving and releasing.</p>}
        <div className="sc-done-acts"><a className="sc-go" href="/scan">Back to Scan</a><a className="secondary btn-link" href="/tracking?tab=labels">Labels</a></div>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="Stick and scan">
      <div className="sc-page">
        {run && <p className="sc-intro"><b>{run.number}</b> at {run.branch}. Stick one label on each item, then scan it. <b>Only scanned labels become stock, and each label counts once.</b> If a label is left over with no item to go on, do not stick it anywhere: press Done and it is cancelled.</p>}
        {error && <div className="error">{error}</div>}
        {run && (
          <div className="sc">
            <div className="sc-pad">
              <div className="sc-pad-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M16 8v8" /></svg>
              </div>
              <div className="sc-pad-text"><b>Scan each label once it is stuck on</b><span>Barcode scanner or phone camera. Every label counts one, once.</span></div>
              <button type="button" className="sc-cam" onClick={() => setCamera(true)}>Camera</button>
            </div>
            <div className={"sc-flash" + (flash ? (flash.ok ? " ok" : " bad") : "")} role="status" aria-live="polite">{flash?.text ?? ""}</div>
            <ul className="sc-lines">
              {run.lines.map(l => {
                const now = scanned.filter(c => l.waiting.includes(c)).length, have = l.stuck + now, of = l.total - l.cancelled, done = have === of;
                return (
                  <li key={l.productId} className={done ? "done" : "open"}>
                    <div className="sc-name"><b>{l.name}</b><span>{l.sku} · {of} label{of === 1 ? "" : "s"} printed</span></div>
                    <div className="sc-count" aria-label={`${have} of ${of} labelled`}>
                      <div className="sc-bar"><i style={{ width: `${of ? Math.round((have / of) * 100) : 100}%` }} /></div>
                      <span>{done ? "✓ " : ""}{have} of {of} stuck on and scanned</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="sc-confirm">
              <p className={`sc-state${left === 0 ? " ok" : " warn"}`}>{left === 0 ? "✓ Every label is stuck on and scanned." : `${left} label${left === 1 ? "" : "s"} not scanned yet. ${left === 1 ? "It is" : "They are"} not stock until scanned.`}</p>
              <div className="st-acts">
                {scanned.length > 0 && left > 0 && <button type="button" className="secondary" disabled={busy} onClick={() => send(false)}>Save, finish later</button>}
                <button type="button" className="sc-go" disabled={busy} onClick={() => left > 0 ? setAsking(true) : send(true)}>{busy ? "Saving…" : "Done"}</button>
              </div>
            </div>
          </div>
        )}
        {run && <p className="tk-hint"><a href={`/labels?ref=${run.reference}`}>Print these labels again</a> (for example if the printer jammed). Reprinted labels are the same codes, so each still counts once.</p>}
      </div>
      {asking && run && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Labels not scanned">
          <div className="modal tk-confirm">
            <h3>{left} label{left === 1 ? " is" : "s are"} not scanned</h3>
            <ul>
              <li>If every item already has a label, {left === 1 ? "this one is" : "these are"} left over: {shelf ? "those items are not on the shelf" : "fewer items arrived than were counted, for example one was scanned twice"}.</li>
              <li>{left === 1 ? "It" : "They"} will be <b>cancelled</b>, the stock lowered by {left}, and the owner asked what happened.</li>
              <li>Still labelling? Press <b>Not yet</b> and carry on.</li>
            </ul>
            <div className="tk-confirm-act"><button className="linkish" onClick={() => setAsking(false)} disabled={busy}>Not yet</button><button className="sc-go" onClick={() => send(true)} disabled={busy}>{busy ? "Saving…" : `Cancel ${left} and finish`}</button></div>
          </div>
        </div>
      )}
      {camera && <CameraScanner keepOpen title="Scan each label" onScan={onScan} onClose={() => setCamera(false)} />}
    </AppShell>
  );
}
