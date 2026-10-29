'use client';
import { useEffect, useState } from "react";
import AppShell from "../AppShell";
import ScanSession, { ScanLine, scanSummary } from "./ScanSession";
import ConfirmBar from "./ConfirmBar";
import { api, ApiError } from "../../lib/api";

interface Item { id: string; productId: string; quantity: number; sentQuantity: number | null; sentScanned: number | null; product: { id: string; name: string; sku: string; barcodes?: string[]; trackItems?: boolean } }
interface Transfer { id: string; transferNumber: string; status: string; fromBranch: { id: string; name: string }; toBranch: { id: string; name: string }; items: Item[] }

/**
 * Sending: the sender states how many of each product are going and scans every one onto the truck.
 * Receiving: the receiving branch scans every item off the truck; anything that does not arrive is reported.
 */
export default function TransferScan() {
  const [mode, setMode] = useState<"send" | "receive">("send");
  const [t, setT] = useState<Transfer | null>(null);
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search), id = q.get("id") ?? "", m = q.get("mode") === "receive" ? "receive" : "send";
    setMode(m);
    if (!id) { setError("Open a transfer from the Scan page."); return; }
    api.get<Transfer>(`/stock-transfers/${id}`).then(tr => {
      setT(tr);
      setLines(tr.items.map(i => {
        const cap = m === "send" ? i.quantity : (i.sentQuantity ?? i.quantity);
        return { key: i.id, productId: i.productId, name: i.product.name, sku: i.product.sku, barcodes: i.product.barcodes ?? [], trackItems: !!i.product.trackItems, limit: cap, quantity: m === "send" ? cap : 0, scanned: 0, codes: [] };
      }));
    }).catch(e => setError(e instanceof ApiError ? e.message : "Could not open the transfer."));
  }, []);

  const expectStatus = mode === "send" ? "APPROVED" : "DISPATCHED";
  const short = mode === "receive" ? lines.reduce((s, l) => s + Math.max(0, (l.limit ?? 0) - l.quantity), 0) : 0;

  async function confirm() {
    if (!t) return;
    setBusy(true); setError("");
    const all = scanSummary(lines).missing === 0;
    try {
      await api.patch(`/stock-transfers/${t.id}/${mode === "send" ? "dispatch" : "receive"}`, {
        reason: all ? undefined : reason,
        lines: lines.map(l => ({ itemId: l.key, quantity: l.quantity, scanned: l.scanned, codes: l.codes.length ? l.codes : undefined })),
      });
      setDone(mode === "send" ? `${t.transferNumber} is on its way to ${t.toBranch.name}. They will scan it in when it arrives.` : `${t.transferNumber} is in stock at ${t.toBranch.name}.${short ? ` ${short} item${short === 1 ? " was" : "s were"} not received: this has been reported to the managers.` : ""}`);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  const title = mode === "send" ? "Send to a branch" : "Receive from a branch";
  if (done) return (
    <AppShell title={title}>
      <div className="sc-done">
        <div className="sc-done-tick" aria-hidden="true">✓</div>
        <h2>{mode === "send" ? "Sent" : "Received"}</h2>
        <p>{done}</p>
        <div className="sc-done-acts"><a className="sc-go" href="/scan">Back to Scan</a></div>
      </div>
    </AppShell>
  );

  return (
    <AppShell title={title}>
      <div className="sc-page">
        {error && <div className="error">{error}</div>}
        {t && <>
          <div className="sc-route">
            <b>{t.transferNumber}</b>
            <span>{t.fromBranch.name} <i aria-hidden="true">→</i> {t.toBranch.name}</span>
          </div>
          {t.status !== expectStatus
            ? <div className="error">This transfer is {t.status.toLowerCase()}, so it cannot be {mode === "send" ? "sent" : "received"} now.</div>
            : <>
                <p className="sc-intro">{mode === "send"
                  ? "Check the number for each product, then scan every item as it is loaded. If fewer are going, change the number first."
                  : "Scan every item as it comes off the truck. The number goes up with each scan. Anything not scanned in counts as not received."}</p>
                <ScanSession lines={lines} setLines={setLines} labelsRequired countUp={mode === "receive"} disabled={busy} branchId={mode === "send" ? t.fromBranch.id : undefined} />
                {error && <div className="error">{error}</div>}
                <ConfirmBar lines={lines} reason={reason} setReason={setReason} onConfirm={confirm} busy={busy}
                  label={mode === "send" ? `Send to ${t.toBranch.name}` : `Receive into ${t.toBranch.name}`}
                  warning={short ? `${short} fewer than ${t.fromBranch.name} sent. The shortage will be reported to both branches and the owner.` : undefined} />
              </>}
        </>}
      </div>
    </AppShell>
  );
}
