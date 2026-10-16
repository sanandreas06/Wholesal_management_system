'use client';
import { Fragment, useEffect, useState } from "react";
import { api } from "../lib/api";
import { exportCsv } from "../lib/exportCsv";
import SealPanel, { Verification } from "./SealPanel";
import { describeRequest, signInAdvice } from "../lib/describe-request";

interface Entry {
  id: string; userName: string | null; action: string; entityType: string; entityId: string | null; summary: string;
  changes: { fields?: Record<string, { from: unknown; to: unknown }>; request?: Record<string, unknown> } | null; createdAt: string;
  seq: number | null; hash: string | null; prevHash: string | null; sealedAt: string | null;
}
const TYPES = ["Product", "Customer", "Supplier", "User", "Role", "Branch", "Region", "Category", "Brand", "Unit", "Organization", "Expense", "Expense category", "Variance case", "Sign-in"];
const show = (v: unknown) => v === null || v === undefined || v === "" ? "(empty)" : typeof v === "object" ? JSON.stringify(v) : String(v);
const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());

export default function ChangeLog() {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [type, setType] = useState("");
  const [days, setDays] = useState(30);
  const [open, setOpen] = useState<string | null>(null);
  const [verified, setVerified] = useState<Verification | null>(null);
  const badSeqs = new Set((verified?.problems ?? []).filter(p => p.seq !== null).map(p => p.seq as number));
  const afterwards = (r: Entry) => !!r.sealedAt && new Date(r.sealedAt).getTime() - new Date(r.createdAt).getTime() > 60_000;

  useEffect(() => {
    setRows(null); setError("");
    api.get<Entry[]>(`/audit/log?days=${days}${type ? `&entityType=${encodeURIComponent(type)}` : ""}`).then(setRows).catch(e => setError(e.message));
  }, [type, days]);

  return (
    <>
      <SealPanel onResult={setVerified} />
      <p className="muted" style={{ marginBottom: 14 }}>
        Every change to products, prices, customers, suppliers, users, roles, branches, settings and expense decisions: who did it, when, and what the values were before and after.
      </p>
      <div className="toolbar" style={{ gap: 8 }}>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Record type">
          <option value="">All record types</option>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option>
        </select>
        <button type="button" className="secondary" disabled={!rows?.length} onClick={() => exportCsv("change-log", [
          { header: "Entry #", value: (r: Entry) => r.seq }, { header: "When", value: r => new Date(r.createdAt).toISOString() }, { header: "Who", value: r => r.userName },
          { header: "Action", value: r => r.action }, { header: "Record type", value: r => r.entityType }, { header: "Summary", value: r => r.summary },
          { header: "Changes", value: r => (r.changes ? JSON.stringify(r.changes) : "") }, { header: "Seal", value: r => r.hash }, { header: "Previous seal", value: r => r.prevHash },
        ], rows ?? [])}>Export sealed CSV</button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="table-wrap">
        {!rows && !error && <div className="empty">Loading...</div>}
        {rows && rows.length === 0 && <div className="empty">No changes recorded in this period.</div>}
        {rows && rows.length > 0 && (
          <table>
            <thead><tr><th>Seal</th><th>When</th><th>Who</th><th>What happened</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => {
                const fields = r.changes?.fields ? Object.entries(r.changes.fields) : [];
                const expandable = fields.length > 0 || !!r.changes?.request;
                return (
                  <Fragment key={r.id}>
                    <tr className={r.seq !== null && badSeqs.has(r.seq) ? "row-bad" : ""}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {r.seq === null ? <span className="muted" title="Not sealed">—</span>
                          : badSeqs.has(r.seq) ? <span className="seal-chip bad" title="This entry no longer matches its seal">⚠ #{r.seq}</span>
                          : <span className="seal-chip" title={`${afterwards(r) ? "Sealed afterwards, when sealing was switched on. " : ""}Seal ${r.hash?.slice(0, 12).toUpperCase()}`}>🔒 #{r.seq}{afterwards(r) ? "*" : ""}</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleString()}</td>
                      <td>{r.userName ?? "—"}</td>
                      <td>{r.summary}{fields.length > 0 && <span className="muted"> · {fields.map(([k]) => label(k)).slice(0, 3).join(", ")}{fields.length > 3 ? "…" : ""}</span>}</td>
                      <td className="row-actions">{expandable && <button className="secondary" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide" : "Details"}</button>}</td>
                    </tr>
                    {open === r.id && (
                      <tr><td colSpan={5} style={{ background: "var(--bg)" }}>
                        {fields.length > 0 && (
                          <table className="dtable"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                            <tbody>{fields.map(([k, v]) => <tr key={k}><td>{label(k)}</td><td>{show(v.from)}</td><td><strong>{show(v.to)}</strong></td></tr>)}</tbody></table>
                        )}
                        {fields.length === 0 && r.changes?.request && (
                          <div className="detail-list">
                            {describeRequest(r.changes.request).map(l => (
                              <div className="detail-row" key={l.label}><span className="detail-label">{l.label}</span><span><strong>{l.value}</strong>{l.note && <small className="muted">{l.note}</small>}</span></div>
                            ))}
                            {signInAdvice(r.action) && <p className="muted detail-advice">{signInAdvice(r.action)}</p>}
                          </div>
                        )}
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
