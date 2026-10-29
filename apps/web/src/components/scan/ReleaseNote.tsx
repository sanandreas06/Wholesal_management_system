'use client';
import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { code128Svg, qrSvgString } from "../../lib/barcode";
import "./labels.css";

interface Note {
  id: string; number: string; createdAt: string; byScan: boolean; collectedBy: string | null; vehicle: string | null; confirmToken: string; invoiceNumber: string; soldAt: string;
  customer: { name: string; phone: string | null } | null; branch: { name: string; location: string | null } | null; releasedBy: string;
  company: { name: string; logo: string | null; phone: string | null } | null; items: { name: string; sku: string; quantity: number; itemCodes: string[] }[];
}

/** The paper that goes with goods leaving the store (collection or delivery): what went out, who released it, who took it,
 *  and a QR the customer scans to confirm they received it all. */
export default function ReleaseNote() {
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setError("No release was chosen."); return; }
    api.get<Note>(`/releases/${id}`).then(setNote).catch(e => setError(e instanceof ApiError ? e.message : "Could not load the release."));
  }, []);
  const total = note?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const url = note && typeof window !== "undefined" ? `${window.location.origin}/c/${note.confirmToken}` : "";
  const logo = note?.company?.logo && /^data:image\/(png|jpeg|webp);base64,/.test(note.company.logo) ? note.company.logo : null;
  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="lb rn-page">
      <style>{"@page { size: A5; margin: 10mm }"}</style>
      <div className="lb-bar no-print">
        <a href="/scan/release" className="lb-back">← Back</a>
        <div className="lb-title"><b>{note ? `Release note ${note.number}` : "Release note"}</b><span>Give this to the customer or driver with the goods.</span></div>
        <button className="lb-print" disabled={!note} onClick={() => window.print()}>Print</button>
      </div>
      {error && <div className="error no-print">{error}</div>}
      {note && (
        <article className="rn">
          <header className="rn-head">
            <div className="rn-co">{logo && <img src={logo} alt="" />}<div><b>{note.company?.name}</b><span>{note.branch?.name}{note.branch?.location ? `, ${note.branch.location}` : ""}{note.company?.phone ? ` · ${note.company.phone}` : ""}</span></div></div>
            <div className="rn-no"><b>RELEASE NOTE</b><span>{note.number}</span><div dangerouslySetInnerHTML={{ __html: code128Svg(note.invoiceNumber, 34) }} /></div>
          </header>
          <dl className="rn-meta">
            <div><dt>Invoice</dt><dd>{note.invoiceNumber} · paid {when(note.soldAt)}</dd></div>
            <div><dt>Released</dt><dd>{when(note.createdAt)} by {note.releasedBy}</dd></div>
            <div><dt>Customer</dt><dd>{note.customer?.name ?? "Walk-in customer"}{note.customer?.phone ? ` · ${note.customer.phone}` : ""}</dd></div>
            {(note.collectedBy || note.vehicle) && <div><dt>Collected by</dt><dd>{[note.collectedBy, note.vehicle].filter(Boolean).join(" · ")}</dd></div>}
          </dl>
          <table className="rn-items">
            <thead><tr><th>Product</th><th>Qty</th></tr></thead>
            <tbody>{note.items.map((i, k) => <tr key={k}><td>{i.name} <small>{i.sku}</small>{i.itemCodes.length > 0 && <small className="rn-codes">Labels: {i.itemCodes.join(", ")}</small>}</td><td>{i.quantity}</td></tr>)}</tbody>
            <tfoot><tr><td>Total items</td><td>{total}</td></tr></tfoot>
          </table>
          <div className="rn-confirm">
            <div dangerouslySetInnerHTML={{ __html: qrSvgString(url, 112) }} />
            <p><b>Customer: please check your goods.</b> Scan this code with your phone camera and confirm you received all {total} item{total === 1 ? "" : "s"}. If anything is missing, say so there: the manager is told at once.</p>
          </div>
          <div className="rn-sign"><div><span />Released by</div><div><span />Received by</div></div>
        </article>
      )}
    </div>
  );
}
