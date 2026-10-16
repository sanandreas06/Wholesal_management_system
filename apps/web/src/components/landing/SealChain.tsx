'use client';
import { useState } from "react";

const ENTRIES = [
  { id: 126, who: "Owner", text: "Signed in from Chrome on Windows", edited: "Signed in from an unknown device" },
  { id: 127, who: "Kofi", text: "Stock adjustment, Tema: 40 → 36 (damaged)", edited: "Stock adjustment, Tema: 40 → 39 (damaged)" },
  { id: 128, who: "Ama", text: "Cement 50kg price: GH₵ 92 → GH₵ 95", edited: "Cement 50kg price: GH₵ 92 → GH₵ 59" },
  { id: 129, who: "Ama", text: "Approved expense: fuel, GH₵ 320", edited: "Approved expense: fuel, GH₵ 32" },
  { id: 130, who: "Owner", text: "Approved expense: generator repair, GH₵ 1,800", edited: "Approved expense: generator repair, GH₵ 180" },
];

/** A simple stand-in for a hash, only to draw the idea. The real change log uses HMAC-SHA256 with a secret key. */
function seal(prev: string, text: string) {
  let h = 0x811c9dc5;
  for (const c of prev + "|" + text) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
function chain(texts: string[]) { const out: string[] = []; texts.reduce((prev, t) => { const s = seal(prev, t); out.push(s); return s; }, "start"); return out; }

/** Edit one log entry and see how every seal after it stops matching. */
export default function SealChain() {
  const [edit, setEdit] = useState<number | null>(null);
  const stored = chain(ENTRIES.map((e) => e.text));
  const now = chain(ENTRIES.map((e, i) => (i === edit ? e.edited : e.text)));
  const first = now.findIndex((s, i) => s !== stored[i]);
  return (
    <div className="sc">
      <ol className="sc-chain">
        {ENTRIES.map((e, i) => {
          const bad = first !== -1 && i >= first, source = i === edit;
          return (
            <li key={e.id} className={(bad ? "bad " : "ok ") + (source ? "src" : "")}>
              <div className="sc-head"><b>#{e.id}</b><span>{e.who}</span><code>{now[i]}</code></div>
              <p>{source ? e.edited : e.text}</p>
              <div className="sc-foot">
                <span>{bad ? (source ? "Edited. Seal no longer matches." : "Seal no longer matches.") : "Seal matches."}</span>
                {source ? <button type="button" onClick={() => setEdit(null)}>Undo edit</button> : edit === null && <button type="button" onClick={() => setEdit(i)}>Edit this entry</button>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className={"sc-verdict " + (first === -1 ? "ok" : "bad")} role="status">
        {first === -1 ? "The log is intact. Try editing an entry." : `Tampering found at entry #${ENTRIES[first].id}. Every entry after it is flagged too, so the change cannot be hidden.`}
      </p>
      <small className="sc-note">Illustration with sample data. The real log seals each entry with a secret key, so it cannot be recalculated by someone editing the database.</small>
    </div>
  );
}
