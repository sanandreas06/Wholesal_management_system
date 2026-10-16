'use client';
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "../lib/toast";

export interface Verification {
  status: "ok" | "broken" | "empty";
  checked: number; unsealed: number; problemCount: number;
  problems: { seq: number | null; id: string | null; kind: string; message: string }[];
  head: { seq: number; code: string; at: string } | null;
  since: string | null; verifiedAt: string;
  codeResult?: { found: boolean; seq?: number; at?: string; summary?: string };
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Checks the whole log and says, in plain words, whether anything has been changed, removed or added behind the application's back. */
export default function SealPanel({ onResult }: { onResult?: (v: Verification | null) => void }) {
  const [v, setV] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [codeV, setCodeV] = useState<Verification["codeResult"]>();
  const [how, setHow] = useState(false);

  const check = useCallback((c?: string) => {
    setBusy(true); setError("");
    api.get<Verification>(`/audit/log/verify${c ? `?code=${encodeURIComponent(c)}` : ""}`)
      .then(r => { setV(r); onResult?.(r); if (c) setCodeV(r.codeResult ?? { found: false }); })
      .catch(e => setError(e.message))
      .finally(() => setBusy(false));
  }, [onResult]);
  useEffect(() => { check(); }, [check]);

  const state = busy && !v ? "checking" : v?.status ?? "checking";
  return (
    <section className={"seal seal-" + state} aria-live="polite">
      <div className="seal-main">
        <div className="seal-icon" aria-hidden="true">
          {state === "broken" ? (
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M12 8v5M12 16.5v.01" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />{state === "ok" && <path d="M8.5 12l2.5 2.5 4.5-5" />}</svg>
          )}
        </div>
        <div className="seal-text">
          {state === "checking" && <><h3>Checking the log...</h3><p>Re-calculating every seal from the start.</p></>}
          {state === "empty" && <><h3>Nothing to protect yet</h3><p>Entries are sealed the moment they are recorded.</p></>}
          {state === "ok" && v && <>
            <h3>The log is intact</h3>
            <p>All <strong>{v.checked.toLocaleString()}</strong> sealed entries were checked. None has been changed, removed, added or put out of order.</p>
          </>}
          {state === "broken" && v && <>
            <h3>The log has been tampered with</h3>
            <p><strong>{v.problemCount}</strong> problem{v.problemCount === 1 ? "" : "s"} found. Entries marked with a warning below can no longer be trusted. Tell your administrator.</p>
          </>}
          {error && <p className="seal-err">Could not check: {error}</p>}
        </div>
        <div className="seal-actions">
          <button type="button" className="secondary" onClick={() => check()} disabled={busy}>{busy ? "Checking..." : "Check again"}</button>
        </div>
      </div>

      {v?.head && (
        <div className="seal-code">
          <span>Latest seal code</span>
          <code>{v.head.code}</code>
          <small>entry #{v.head.seq} · {when(v.head.at)}</small>
          <button type="button" className="link-btn" onClick={() => { navigator.clipboard?.writeText(v.head!.code).then(() => toast.success("Seal code copied"), () => toast.error("Could not copy")); }}>Copy</button>
        </div>
      )}

      {state === "broken" && v && (
        <ul className="seal-problems">
          {v.problems.map((p, i) => <li key={i}><span className="seal-warn">!</span>{p.message}</li>)}
          {v.problemCount > v.problems.length && <li className="muted">...and {v.problemCount - v.problems.length} more.</li>}
        </ul>
      )}

      <div className="seal-tools">
        <form className="seal-check" onSubmit={e => { e.preventDefault(); if (code.trim()) check(code.trim()); }}>
          <label htmlFor="seal-code-in">Check a code you wrote down earlier</label>
          <div><input id="seal-code-in" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7F3A-92CC-18D0" maxLength={20} /><button type="submit" className="secondary" disabled={busy || code.replace(/[^0-9A-F]/gi, "").length < 8}>Check</button></div>
          {codeV && (codeV.found
            ? <p className="seal-ok">Found: entry #{codeV.seq}{codeV.at ? ` from ${when(codeV.at)}` : ""}{codeV.summary ? `, “${codeV.summary}”` : ""}. It is still in the log.</p>
            : <p className="seal-bad">Not found. If you copied this code from here earlier, that entry may have been removed.</p>)}
        </form>
        <button type="button" className="link-btn" onClick={() => setHow(h => !h)} aria-expanded={how}>{how ? "Hide" : "How does this work?"}</button>
      </div>

      {how && (
        <div className="seal-how">
          <h4>In plain words</h4>
          <ul>
            <li><strong>Every entry gets a seal.</strong> Think of a ledger with numbered pages, each page signed in ink that also depends on the page before it.</li>
            <li><strong>Changing, removing, adding or reordering</strong> any entry breaks its seal and every seal after it, so the check above catches it.</li>
            <li><strong>The seals use a secret key that lives on the server, not in the database.</strong> Someone who edits the database directly cannot create a matching set of seals. The database also refuses to edit or delete sealed entries.</li>
            <li><strong>Write down the latest seal code now and then</strong> (a photo or a message to yourself is enough). If an old code can no longer be found here, something was removed.</li>
          </ul>
          <h4>What it cannot do</h4>
          <ul>
            <li>It cannot stop someone who has both the database <em>and</em> the server&apos;s secret key. Keep the key private.</li>
            <li>Entries recorded before sealing was switched on were sealed when it started, so they are only protected from that moment.</li>
            <li>It proves the log was not altered; it does not prove the original entry was honest.</li>
          </ul>
        </div>
      )}
    </section>
  );
}
