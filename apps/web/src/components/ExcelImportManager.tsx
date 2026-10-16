'use client';
import { FormEvent, useEffect, useRef, useState } from "react";
import AppShell from "./AppShell";
import { api } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface Ref { id: string; name: string }
interface RowError { id: string; rowNumber: number; message: string; rawData: string | null; unmatchedText?: string | null }
interface Batch {
  id: string; fileName: string; periodStart: string; periodEnd: string; status: string; totalRows: number; importedRows: number; duplicateRows: number; errorRows: number;
  createdAt: string; branch: Ref; uploadedBy: Ref; errors?: RowError[];
}
interface Summary { branchId: string; branch: string; units: number; revenue: number }

const STATUS: Record<string, [string, string]> = { COMPLETED: ["Completed", "active"], COMPLETED_WITH_ERRORS: ["Completed with errors", "medium"], FAILED: ["Nothing imported", "high"] };
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: string) => new Date(d).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

async function authFetch(path: string, init: RequestInit = {}) {
  const t = typeof window !== "undefined" ? localStorage.getItem("wms_access_token") : null;
  return fetch(`${API}${path}`, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.headers || {}) } });
}

export default function ExcelImportManager() {
  const [canCreate] = usePermissions("EXCEL_IMPORT:CREATE");
  const [branches, setBranches] = useState<Ref[]>([]);
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [branchId, setBranchId] = useState("");
  const [periodStart, setPeriodStart] = useState(daysAgo(6));
  const [periodEnd, setPeriodEnd] = useState(today());
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Batch | null>(null);
  const [viewing, setViewing] = useState<Batch | null>(null);
  const [reviewing, setReviewing] = useState<Batch | null>(null);

  function load() {
    api.get<Batch[]>("/imports").then(setBatches).catch(e => setError(e.message));
    api.get<Summary[]>(`/imports/summary?from=${daysAgo(30)}&to=${today()}`).then(setSummary).catch(() => {});
  }
  useEffect(() => { load(); api.get<Ref[]>("/branches?own=1").then(setBranches).catch(() => {}); }, []);

  async function downloadTemplate() {
    const res = await authFetch("/imports/template");
    if (!res.ok) { setError("Could not download the template"); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = "weekly-sales-template.xlsx"; a.click(); URL.revokeObjectURL(url);
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setResult(null);
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Choose a .xlsx or .csv file first"); return; }
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("branchId", branchId); fd.append("periodStart", periodStart); fd.append("periodEnd", periodEnd);
      const res = await authFetch("/imports", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) { const m = data?.message; setError(Array.isArray(m) ? m.join(", ") : m || "Upload failed"); return; }
      setResult(data); if (fileRef.current) fileRef.current.value = ""; setFileName(""); load();
    } catch { setError("Upload failed. Is the API running?"); }
    finally { setBusy(false); }
  }

  async function open(b: Batch) { try { setViewing(await api.get<Batch>(`/imports/${b.id}`)); } catch { setViewing(b); } }

  return (
    <AppShell title="Excel Import">
      {error && <div className="error">{error}</div>}
      {canCreate && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>Upload weekly sales</h3>
          <p className="field-hint">One row per product sold per day. Rows already imported are skipped, so re-uploading a file is safe. Imported sales are kept for reporting and do not change stock levels.</p>
          <form onSubmit={submit} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label>Branch<select value={branchId} onChange={e => setBranchId(e.target.value)} required><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label>Period start<input type="date" max={today()} value={periodStart} onChange={e => setPeriodStart(e.target.value)} required /></label>
            <label>Period end<input type="date" max={today()} value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} required /></label>
            <label>File<input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={e => setFileName(e.target.files?.[0]?.name || "")} /></label>
            <button disabled={busy || !fileName}>{busy ? "Importing..." : "Upload & Import"}</button>
            <button type="button" className="secondary" onClick={downloadTemplate}>Download template</button>
          </form>
        </div>
      )}

      {result && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>{result.fileName} <span className={`badge ${STATUS[result.status]?.[1]}`}>{STATUS[result.status]?.[0]}</span></h3>
          <p>{result.totalRows} rows read · <strong>{result.importedRows} imported</strong> · {result.duplicateRows} already imported (skipped) · <strong style={{ color: result.errorRows ? "var(--danger)" : undefined }}>{result.errorRows} rejected</strong></p>
          {(result.errors || []).some(e => e.unmatchedText) && canCreate && <p><button type="button" onClick={() => setReviewing(result)}>Review unmatched products</button></p>}
          <ErrorTable errors={result.errors || []} />
        </div>
      )}

      {summary.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: 18 }}>
          <div style={{ padding: "12px 16px" }}><strong>Imported weekly sales — last 30 days</strong></div>
          <table><thead><tr><th>Branch</th><th>Units</th><th>Revenue</th></tr></thead>
            <tbody>{summary.map(s => <tr key={s.branchId}><td>{s.branch}</td><td>{s.units}</td><td>{money(s.revenue)}</td></tr>)}</tbody></table>
        </div>
      )}

      <div className="table-wrap">
        <div style={{ padding: "12px 16px" }}><strong>Import history</strong></div>
        {batches && batches.length === 0 && <div className="empty">No imports yet.</div>}
        {batches && batches.length > 0 && (
          <table>
            <thead><tr><th>Date</th><th>Branch</th><th>Period</th><th>File</th><th>Rows</th><th>Imported</th><th>Duplicates</th><th>Rejected</th><th>Status</th><th></th></tr></thead>
            <tbody>{batches.map(b => (
              <tr key={b.id}><td>{new Date(b.createdAt).toLocaleString()}</td><td>{b.branch.name}</td><td>{day(b.periodStart)} → {day(b.periodEnd)}</td><td>{b.fileName}<div className="muted">{b.uploadedBy.name}</div></td>
                <td>{b.totalRows}</td><td>{b.importedRows}</td><td>{b.duplicateRows}</td><td>{b.errorRows}</td>
                <td><span className={`badge ${STATUS[b.status]?.[1]}`}>{STATUS[b.status]?.[0]}</span></td>
                <td className="row-actions"><button className="secondary" onClick={() => open(b)}>Details</button></td></tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {viewing && (
        <div className="modal-backdrop" onClick={() => setViewing(null)}><div className="modal modal-wide" onClick={e => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={() => setViewing(null)} aria-label="Close">&times;</button>
          <h2>{viewing.fileName}</h2>
          <p className="muted">{viewing.branch.name} · {day(viewing.periodStart)} → {day(viewing.periodEnd)} · uploaded by {viewing.uploadedBy.name}</p>
          <p>{viewing.totalRows} rows · {viewing.importedRows} imported · {viewing.duplicateRows} duplicates · {viewing.errorRows} rejected</p>
          {(viewing.errors || []).some(e => e.unmatchedText) && canCreate && <p><button type="button" onClick={() => { setReviewing(viewing); setViewing(null); }}>Review unmatched products</button></p>}
          <ErrorTable errors={viewing.errors || []} />
        </div></div>
      )}
      {reviewing && <ReviewModal batch={reviewing} onClose={() => setReviewing(null)}
        onDone={b => { setReviewing(null); setResult(b); setViewing(null); load(); }} />}
    </AppShell>
  );
}

function ErrorTable({ errors }: { errors: RowError[] }) {
  if (errors.length === 0) return <p className="muted">No rejected rows.</p>;
  return (
    <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
      <table><thead><tr><th>Row</th><th>Problem</th><th>Row data</th></tr></thead>
        <tbody>{errors.map(e => <tr key={e.id}><td>{e.rowNumber}</td><td>{e.message}</td><td className="muted">{e.rawData}</td></tr>)}</tbody></table>
    </div>
  );
}

interface Group { text: string; rowCount: number; suggestions: { productId: string; sku: string; name: string; score: number }[] }
interface ProductRef { id: string; sku: string; name: string }

function ReviewModal({ batch, onClose, onDone }: { batch: Batch; onClose: () => void; onDone: (b: Batch) => void }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Group[]>(`/imports/${batch.id}/unmatched`).then(g => {
      setGroups(g);
      const c: Record<string, string> = {};
      g.forEach(x => { const [top, next] = x.suggestions; if (top && top.score >= 0.8 && (!next || top.score - next.score >= 0.1)) c[x.text] = top.productId; });
      setChoice(c);
    }).catch(e => setError(e.message));
    api.get<ProductRef[]>("/products").then(setProducts).catch(() => {});
  }, [batch.id]);

  const picked = Object.entries(choice).filter(([, id]) => id);
  async function apply() {
    setBusy(true); setError("");
    try {
      const b = await api.post<Batch>(`/imports/${batch.id}/resolve`, { mappings: picked.map(([text, productId]) => ({ text, productId })) });
      onDone(b);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not apply matches"); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}><div className="modal modal-wide" onClick={e => e.stopPropagation()}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
      <h2>Review unmatched products</h2>
      <p className="muted">These names in {batch.fileName} are not in your product list. Pick the product each one means. Your choice is remembered as an alias, so future imports match it automatically. Matches are only pre-selected when one product is clearly the closest; please check them.</p>
      {error && <div className="error">{error}</div>}
      {!groups && !error && <p className="muted">Loading...</p>}
      {groups && groups.length === 0 && <p className="muted">Nothing left to match.</p>}
      {groups && groups.length > 0 && (
        <div className="table-wrap" style={{ maxHeight: 380, overflowY: "auto" }}>
          <table><thead><tr><th>Name in file</th><th>Rows</th><th>This is…</th></tr></thead>
            <tbody>{groups.map(g => (
              <tr key={g.text}>
                <td><strong>{g.text}</strong></td><td>{g.rowCount}</td>
                <td>
                  <select value={choice[g.text] ?? ""} onChange={e => setChoice(c => ({ ...c, [g.text]: e.target.value }))}>
                    <option value="">Skip for now</option>
                    {g.suggestions.length > 0 && <optgroup label="Closest matches">{g.suggestions.map(s => <option key={s.productId} value={s.productId}>{s.name} ({s.sku}), {Math.round(s.score * 100)}% alike</option>)}</optgroup>}
                    <optgroup label="All products">{products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</optgroup>
                  </select>
                </td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
      <div className="modal-actions" style={{ marginTop: 14 }}>
        <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        <button disabled={busy || picked.length === 0} onClick={apply}>{busy ? "Importing..." : `Match ${picked.length} and import rows`}</button>
      </div>
    </div></div>
  );
}
