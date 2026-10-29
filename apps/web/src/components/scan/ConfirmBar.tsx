'use client';
import { ScanLine, scanSummary } from "./ScanSession";

/** The bottom of every scanning screen: says whether everything was scanned, asks why when not, and confirms. */
export default function ConfirmBar({ lines, reason, setReason, onConfirm, busy, label, warning }: {
  lines: ScanLine[]; reason: string; setReason: (v: string) => void; onConfirm: () => void; busy: boolean; label: string; warning?: string;
}) {
  const s = scanSummary(lines);
  return (
    <div className="sc-confirm">
      {s.counted === 0 ? <p className="sc-state">Scan or count at least one item.</p>
        : s.all ? <p className="sc-state ok">✓ {s.byEye ? `${s.counted - s.byEye} scanned, ${s.byEye} counted by eye (no barcode).` : `All ${s.counted} item${s.counted === 1 ? "" : "s"} scanned.`}</p>
        : <>
            <p className="sc-state warn">{s.missing} of {s.counted} not scanned. The manager will be asked to check this.</p>
            <label className="sc-reason">Why were they not scanned?
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: barcode torn, scanner not working" maxLength={300} />
            </label>
          </>}
      {warning && <p className="sc-state warn">{warning}</p>}
      <button type="button" className="sc-go" disabled={busy || s.counted === 0 || (!s.all && reason.trim().length < 5)} onClick={onConfirm}>{busy ? "Saving..." : label}</button>
    </div>
  );
}
