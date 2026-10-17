'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { toast } from "../lib/toast";
import { exportCsv } from "../lib/exportCsv";
import { usePermissions } from "../hooks/usePermissions";

interface Ref { id: string; name: string }
interface Category { id: string; name: string }
interface Expense { id: string; amount: string; description: string; expenseDate: string; status: string; reviewNote: string | null; branch: Ref; category: Ref; createdBy: Ref; reviewedBy: Ref | null; canReview?: boolean; reviewBlock?: string | null }
interface Deposit { id: string; method: string; amount: string; reference: string | null; depositDate: string; branch: Ref; createdBy: Ref }
interface VarianceCase { id: string; method: string; periodStart: string; periodEnd: string; expectedAmount: string; actualAmount: string; difference: string; status: string; explanation: string | null; resolution: string | null; branch: Ref; resolvedBy: Ref | null }
interface Closing { id: string; periodStart: string; periodEnd: string; expectedAmount: string; depositedAmount: string; expensesAmount: string; differenceAmount: string; notes: string | null; closedAt: string; branch: Ref; closedBy: Ref; varianceCases: { id: string; status: string }[] }
interface ReconRow { method: string; expected: number; deposited: number; difference: number; material: boolean }
interface Recon { branch: Ref; rows: ReconRow[]; totals: { expected: number; deposited: number; difference: number }; expenses: { approved: number; pending: number; pendingCount: number } }

const money = (n: number | string) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: string) => new Date(d).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const weekStart = () => { const d = new Date(); const diff = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - diff); return d.toISOString().slice(0, 10); };
const METHOD = (m: string) => m.replace("_", " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
const STATUS_CLASS: Record<string, string> = { PENDING: "medium", APPROVED: "active", REJECTED: "inactive", OPEN: "high", INVESTIGATING: "medium", RESOLVED: "active" };
const err = (e: unknown, fb: string) => (e instanceof ApiError ? e.message : fb);

const TABS = [
  ["reconciliation", "Reconciliation", "RECONCILIATION:READ"], ["expenses", "Expenses", "EXPENSES:READ"], ["deposits", "Deposits", "DEPOSITS:READ"],
  ["cases", "Variance Cases", "VARIANCE_CASES:READ"], ["closings", "Closings", "BRANCH_CLOSING:READ"]
] as const;

export default function FinanceManager() {
  const flags = usePermissions(...TABS.map(t => t[2]), "EXPENSES:CREATE", "EXPENSES:APPROVE", "DEPOSITS:CREATE", "VARIANCE_CASES:UPDATE", "BRANCH_CLOSING:CREATE");
  const [rRead, eRead, dRead, cRead, clRead, eCreate, eApprove, dCreate, cUpdate, clCreate] = flags;
  const allowed = [rRead, eRead, dRead, cRead, clRead];
  const [tab, setTab] = useState<string>("");
  const [branches, setBranches] = useState<Ref[]>([]);
  useEffect(() => { api.get<Ref[]>("/branches?own=1").then(setBranches).catch(() => {}); }, []);
  // Links from the dashboard and the bell arrive with a tab and filters (?tab=expenses&status=PENDING&from=2026-10-01...)
  const [initial, setInitial] = useState<Record<string, string> | null>(null);
  useEffect(() => { setInitial(Object.fromEntries(new URLSearchParams(window.location.search))); }, []);
  useEffect(() => {
    if (tab || !initial) return;
    const want = TABS.findIndex(t => t[0] === initial.tab);
    if (want >= 0 && allowed[want]) { setTab(TABS[want][0]); return; }
    const i = allowed.findIndex(Boolean); if (i >= 0) setTab(TABS[i][0]);
  }, [flags.join(), initial]); // eslint-disable-line

  return (
    <AppShell title="Finance & Reconciliation">
      <div className="toolbar" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        {TABS.map((t, i) => allowed[i] && <button key={t[0]} className={tab === t[0] ? "" : "secondary"} onClick={() => setTab(t[0])}>{t[1]}</button>)}
      </div>
      {tab === "reconciliation" && <ReconTab branches={branches} canClose={clCreate} />}
      {tab === "expenses" && <ExpensesTab branches={branches} canCreate={eCreate} canApprove={eApprove} initial={initial ?? {}} />}
      {tab === "deposits" && <DepositsTab branches={branches} canCreate={dCreate} initial={initial ?? {}} />}
      {tab === "cases" && <CasesTab canUpdate={cUpdate} initial={initial ?? {}} />}
      {tab === "closings" && <ClosingsTab />}
    </AppShell>
  );
}

function ReconTab({ branches, canClose }: { branches: Ref[]; canClose: boolean }) {
  const [from, setFrom] = useState(weekStart());
  const [to, setTo] = useState(today());
  const [branchId, setBranchId] = useState("");
  const [data, setData] = useState<Recon[] | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function load() {
    setError("");
    api.get<Recon[]>(`/reconciliation?from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}`).then(setData).catch(e => { setData(null); setError(err(e, "Failed to load")); });
  }
  useEffect(load, [from, to, branchId]); // eslint-disable-line

  async function closePeriod(b: Ref) {
    const notes = prompt(`Close ${b.name} for ${from} to ${to}? This locks the period for new deposits and expenses.\n\nOptional note:`);
    if (notes === null) return;
    setMsg(""); setError("");
    try {
      const c = await api.post<Closing>("/branch-closings", { branchId: b.id, periodStart: from, periodEnd: to, notes: notes || undefined });
      setMsg(`${b.name} closed. ${c.varianceCases.length ? `${c.varianceCases.length} variance case(s) opened for review.` : "No material variances."}`);
      load();
    } catch (e) { setError(err(e, "Could not close the period")); }
  }

  return (<>
    <div className="toolbar" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
      <label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>To<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <label>Branch<select value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    </div>
    <p className="field-hint">Expected = payments recorded on sales (cash, bank, mobile money; sold-on-account and voided sales excluded). Difference = deposited − expected.</p>
    {error && <div className="error">{error}</div>}
    {msg && <div className="badge active" style={{ display: "block", padding: 12, marginBottom: 12 }}>{msg}</div>}
    {data && data.map(r => (
      <div key={r.branch.id} className="table-wrap" style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ padding: "12px 16px", marginBottom: 0 }}>
          <strong>{r.branch.name}</strong>
          {canClose && <button className="secondary" onClick={() => closePeriod(r.branch)}>Close period</button>}
        </div>
        <table>
          <thead><tr><th>Method</th><th>Expected</th><th>Deposited</th><th>Difference</th><th></th></tr></thead>
          <tbody>
            {r.rows.map(x => (
              <tr key={x.method}><td>{METHOD(x.method)}</td><td>{money(x.expected)}</td><td>{money(x.deposited)}</td>
                <td style={{ color: x.difference < 0 ? "var(--danger)" : undefined }}>{money(x.difference)}</td>
                <td>{x.material && <span className="badge high">Needs review</span>}</td></tr>
            ))}
            <tr><td><strong>Total</strong></td><td><strong>{money(r.totals.expected)}</strong></td><td><strong>{money(r.totals.deposited)}</strong></td><td><strong>{money(r.totals.difference)}</strong></td><td></td></tr>
          </tbody>
        </table>
        <p className="muted" style={{ padding: "8px 16px" }}>Approved expenses: {money(r.expenses.approved)} · Pending: {money(r.expenses.pending)} ({r.expenses.pendingCount})</p>
      </div>
    ))}
  </>);
}

/** What the owner can narrow the Expenses and Deposits lists by. Dashboard cards and the bell link here with these set. */
interface Range { from: string; to: string }
const RANGE_PRESETS: [string, () => Range][] = [
  ["Today", () => ({ from: today(), to: today() })],
  ["This week", () => ({ from: weekStart(), to: today() })],
  ["This month", () => ({ from: today().slice(0, 8) + "01", to: today() })],
  ["Last 30 days", () => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 29); return { from: d.toISOString().slice(0, 10), to: today() }; }],
];
function RangeBar({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return (<>
    <label className="inline-field">From <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label>
    <label className="inline-field">To <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label>
    <span className="chips">{RANGE_PRESETS.map(([name, get]) => <button key={name} type="button" className="chip" onClick={() => { const r = get(); setFrom(r.from); setTo(r.to); }}>{name}</button>)}</span>
  </>);
}
interface ExpenseSummary { count: number; total: number; byStatus: Record<string, { count: number; total: number }>; byCategory: { id: string; name: string; total: number; count: number }[] }
interface DepositSummary { count: number; total: number; byMethod: { method: string; total: number; count: number }[] }

function ExpensesTab({ branches, canCreate, canApprove, initial }: { branches: Ref[]; canCreate: boolean; canApprove: boolean; initial: Record<string, string> }) {
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [sum, setSum] = useState<ExpenseSummary | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [status, setStatus] = useState(initial.status ?? "");
  const [branchId, setBranchId] = useState(initial.branchId ?? "");
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [adding, setAdding] = useState(canCreate && initial.new === "1");
  const [error, setError] = useState("");

  const filtered = !!(status || branchId || categoryId || from || to);
  function load() {
    const q = new URLSearchParams();
    if (status) q.set("status", status); if (branchId) q.set("branchId", branchId); if (categoryId) q.set("categoryId", categoryId);
    if (from) q.set("from", from); if (to) q.set("to", to);
    const qs = q.toString() ? `?${q}` : "";
    api.get<Expense[]>(`/expenses${qs}`).then(r => { setRows(r); setError(""); }).catch(e => setError(err(e, "Failed to load")));
    api.get<ExpenseSummary>(`/expenses/summary${qs}`).then(setSum).catch(() => setSum(null));
  }
  useEffect(() => { api.get<Category[]>("/expense-categories").then(setCats).catch(() => {}); }, []);
  useEffect(load, [status, branchId, categoryId, from, to]); // eslint-disable-line

  async function review(id: string, action: "approve" | "reject") {
    const note = action === "reject" ? prompt("Reason for rejecting (optional):") : "";
    if (note === null) return;
    try { await api.patch(`/expenses/${id}/${action}`, { note: note || undefined }); load(); } catch (e) { toast.error(err(e, "Failed")); }
  }
  const clear = () => { setStatus(""); setBranchId(""); setCategoryId(""); setFrom(""); setTo(""); };
  const top = sum?.byCategory[0]?.total ?? 0;

  return (<>
    {error && <div className="error">{error}</div>}
    <div className="toolbar" style={{ flexWrap: "wrap", gap: 10, justifyContent: "flex-start" }}>
      <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
      <select value={branchId} onChange={e => setBranchId(e.target.value)} aria-label="Branch"><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <select value={categoryId} onChange={e => setCategoryId(e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {filtered && <button type="button" className="secondary" onClick={clear}>Clear</button>}
      <span style={{ flex: 1 }} />
      <button type="button" className="secondary" disabled={!rows?.length} onClick={() => exportCsv("expenses", [
        { header: "Date", value: (x: Expense) => day(x.expenseDate) }, { header: "Branch", value: x => x.branch.name }, { header: "Category", value: x => x.category.name }, { header: "Description", value: x => x.description },
        { header: "Amount", value: x => Number(x.amount) }, { header: "Status", value: x => x.status }, { header: "Entered by", value: x => x.createdBy.name }, { header: "Reviewed by", value: x => x.reviewedBy?.name }, { header: "Review note", value: x => x.reviewNote },
      ], rows ?? [])}>Export CSV</button>
      {canCreate && <button onClick={() => setAdding(true)}>+ New Expense</button>}
    </div>
    {sum && (
      <div className="fin-sum">
        <div className="fin-total"><span>{status ? `${status.charAt(0)}${status.slice(1).toLowerCase()} expenses` : "All expenses"}{filtered && !status ? " in this view" : ""}</span><strong>{money(sum.total)}</strong><small>{sum.count} item{sum.count === 1 ? "" : "s"}{rows && sum.count > rows.length ? ` (list shows the latest ${rows.length}; export or narrow the dates for the rest)` : ""}</small></div>
        <div className="fin-status">
          {(["APPROVED", "PENDING", "REJECTED"] as const).map(st => (
            <button type="button" key={st} className={"fin-pill " + (status === st ? "on" : "")} onClick={() => setStatus(status === st ? "" : st)}>
              <span className={`badge ${STATUS_CLASS[st]}`}>{st}</span><strong>{money(sum.byStatus[st]?.total ?? 0)}</strong><small>{sum.byStatus[st]?.count ?? 0}</small>
            </button>
          ))}
        </div>
        {sum.byCategory.length > 0 && (
          <div className="fin-cats" aria-label="Where it went">
            {sum.byCategory.slice(0, 8).map(c => (
              <button type="button" key={c.id} className={"fin-cat " + (categoryId === c.id ? "on" : "")} onClick={() => setCategoryId(categoryId === c.id ? "" : c.id)} title={`${c.count} expense${c.count === 1 ? "" : "s"}`}>
                <span>{c.name}</span><i style={{ width: `${Math.max(3, (c.total / (top || 1)) * 100)}%` }} /><strong>{money(c.total)}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    <div className="table-wrap">
      {rows && rows.length === 0 && <div className="empty">{filtered ? "No expenses match these filters." : "No expenses."}</div>}
      {rows && rows.length > 0 && <table>
        <thead><tr><th>Date</th><th>Branch</th><th>Category</th><th>Description</th><th>Amount</th><th>By</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map(x => (
          <tr key={x.id}><td>{day(x.expenseDate)}</td><td>{x.branch.name}</td><td>{x.category.name}</td><td>{x.description}</td><td>{money(x.amount)}</td><td>{x.createdBy.name}</td>
            <td><span className={`badge ${STATUS_CLASS[x.status]}`}>{x.status}</span>{x.reviewNote && <div className="muted">{x.reviewNote}</div>}</td>
            <td className="row-actions">{canApprove && x.status === "PENDING" && x.canReview !== false && <><button className="secondary" onClick={() => review(x.id, "approve")}>Approve</button><button className="secondary" onClick={() => review(x.id, "reject")}>Reject</button></>}{canApprove && x.status === "PENDING" && x.canReview === false && <div className="muted" style={{ maxWidth: 240 }}>{x.reviewBlock}{x.reviewBlock && <> </>}{x.reviewBlock?.startsWith("Above") && <button className="secondary" onClick={() => review(x.id, "reject")}>Reject</button>}</div>}</td></tr>
        ))}</tbody></table>}
    </div>
    {adding && <ExpenseModal branches={branches} cats={cats} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
  </>);
}

function ExpenseModal({ branches, cats, onClose, onSaved }: { branches: Ref[]; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ branchId: "", categoryId: "", amount: "", description: "", expenseDate: today() });
  const [newCat, setNewCat] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      let categoryId = f.categoryId;
      if (newCat.trim()) categoryId = (await api.post<Category>("/expense-categories", { name: newCat.trim() })).id;
      if (!categoryId) { setError("Choose or add a category"); setSaving(false); return; }
      await api.post("/expenses", { ...f, categoryId, amount: Number(f.amount) });
      onSaved();
    } catch (e) { setError(err(e, "Save failed")); } finally { setSaving(false); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
      <h2>New Expense</h2>
      <form onSubmit={submit}>
        <label>Branch<select value={f.branchId} onChange={e => set("branchId", e.target.value)} required><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label>Category<select value={f.categoryId} onChange={e => set("categoryId", e.target.value)} disabled={!!newCat.trim()}><option value="">Select category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>…or add a new category<input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="e.g. Transport, Rent, Utilities" maxLength={80} /></label>
        <label>Amount<input type="number" min="0.01" step="0.01" value={f.amount} onChange={e => set("amount", e.target.value)} required /></label>
        <label>Description<input value={f.description} onChange={e => set("description", e.target.value)} maxLength={300} required /></label>
        <label>Date<input type="date" max={today()} value={f.expenseDate} onChange={e => set("expenseDate", e.target.value)} required /></label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button disabled={saving}>{saving ? "Saving..." : "Submit for approval"}</button></div>
      </form></div></div>
  );
}

function DepositsTab({ branches, canCreate, initial }: { branches: Ref[]; canCreate: boolean; initial: Record<string, string> }) {
  const [rows, setRows] = useState<Deposit[] | null>(null);
  const [sum, setSum] = useState<DepositSummary | null>(null);
  const [branchId, setBranchId] = useState(initial.branchId ?? "");
  const [method, setMethod] = useState(initial.method ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const filtered = !!(branchId || method || from || to);
  function load() {
    const q = new URLSearchParams();
    if (branchId) q.set("branchId", branchId); if (method) q.set("method", method); if (from) q.set("from", from); if (to) q.set("to", to);
    const qs = q.toString() ? `?${q}` : "";
    api.get<Deposit[]>(`/deposits${qs}`).then(r => { setRows(r); setError(""); }).catch(e => setError(err(e, "Failed to load")));
    api.get<DepositSummary>(`/deposits/summary${qs}`).then(setSum).catch(() => setSum(null));
  }
  useEffect(load, [branchId, method, from, to]); // eslint-disable-line
  return (<>
    {error && <div className="error">{error}</div>}
    <div className="toolbar" style={{ flexWrap: "wrap", gap: 10, justifyContent: "flex-start" }}>
      <select value={branchId} onChange={e => setBranchId(e.target.value)} aria-label="Branch"><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <select value={method} onChange={e => setMethod(e.target.value)} aria-label="Method"><option value="">All methods</option><option value="CASH">Cash</option><option value="BANK">Bank</option><option value="MOBILE_MONEY">Mobile money</option></select>
      <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {filtered && <button type="button" className="secondary" onClick={() => { setBranchId(""); setMethod(""); setFrom(""); setTo(""); }}>Clear</button>}
      <span style={{ flex: 1 }} />
      <button type="button" className="secondary" disabled={!rows?.length} onClick={() => exportCsv("deposits", [
        { header: "Date", value: (d: Deposit) => day(d.depositDate) }, { header: "Branch", value: d => d.branch.name }, { header: "Method", value: d => METHOD(d.method) },
        { header: "Reference", value: d => d.reference }, { header: "Amount", value: d => Number(d.amount) }, { header: "Recorded by", value: d => d.createdBy.name },
      ], rows ?? [])}>Export CSV</button>
      {canCreate && <button onClick={() => setAdding(true)}>+ Record Deposit</button>}
    </div>
    {sum && (
      <div className="fin-sum">
        <div className="fin-total"><span>{filtered ? "Deposits in this view" : "All deposits"}</span><strong>{money(sum.total)}</strong><small>{sum.count} deposit{sum.count === 1 ? "" : "s"}{rows && sum.count > rows.length ? ` (list shows the latest ${rows.length}; export or narrow the dates for the rest)` : ""}</small></div>
        {sum.byMethod.length > 0 && (
          <div className="fin-status">
            {sum.byMethod.map(m => (
              <button type="button" key={m.method} className={"fin-pill " + (method === m.method ? "on" : "")} onClick={() => setMethod(method === m.method ? "" : m.method)}>
                <span className="badge">{METHOD(m.method)}</span><strong>{money(m.total)}</strong><small>{m.count}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    <div className="table-wrap">
      {rows && rows.length === 0 && <div className="empty">{filtered ? "No deposits match these filters." : "No deposits recorded."}</div>}
      {rows && rows.length > 0 && <table><thead><tr><th>Date</th><th>Branch</th><th>Method</th><th>Reference</th><th>Amount</th><th>By</th></tr></thead>
        <tbody>{rows.map(d => <tr key={d.id}><td>{day(d.depositDate)}</td><td>{d.branch.name}</td><td>{METHOD(d.method)}</td><td>{d.reference || "—"}</td><td>{money(d.amount)}</td><td>{d.createdBy.name}</td></tr>)}</tbody></table>}
    </div>
    {adding && <DepositModal branches={branches} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
  </>);
}

function DepositModal({ branches, onClose, onSaved }: { branches: Ref[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ branchId: "", method: "CASH", amount: "", reference: "", depositDate: today() });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { await api.post("/deposits", { ...f, amount: Number(f.amount), reference: f.reference || undefined }); onSaved(); }
    catch (e) { setError(err(e, "Save failed")); } finally { setSaving(false); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
      <h2>Record Deposit</h2>
      <form onSubmit={submit}>
        <label>Branch<select value={f.branchId} onChange={e => set("branchId", e.target.value)} required><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label>Method<select value={f.method} onChange={e => set("method", e.target.value)}><option value="CASH">Cash</option><option value="BANK">Bank</option><option value="MOBILE_MONEY">Mobile money</option></select></label>
        <label>Amount<input type="number" min="0.01" step="0.01" value={f.amount} onChange={e => set("amount", e.target.value)} required /></label>
        <label>Reference<input value={f.reference} onChange={e => set("reference", e.target.value)} maxLength={60} placeholder="Bank slip / transaction ID" /></label>
        <label>Date<input type="date" max={today()} value={f.depositDate} onChange={e => set("depositDate", e.target.value)} required /></label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button disabled={saving}>{saving ? "Saving..." : "Record Deposit"}</button></div>
      </form></div></div>
  );
}

function CasesTab({ canUpdate, initial }: { canUpdate: boolean; initial: Record<string, string> }) {
  const [rows, setRows] = useState<VarianceCase[] | null>(null);
  const [status, setStatus] = useState(initial.status ?? "");
  const [active, setActive] = useState<VarianceCase | null>(null);
  const [error, setError] = useState("");
  function load() { api.get<VarianceCase[]>(`/variance-cases${status ? `?status=${status}` : ""}`).then(setRows).catch(e => setError(err(e, "Failed to load"))); }
  useEffect(load, [status]); // eslint-disable-line
  return (<>
    {error && <div className="error">{error}</div>}
    <div className="toolbar"><select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="RESOLVED">Resolved</option></select></div>
    <div className="table-wrap">
      {rows && rows.length === 0 && <div className="empty">No variance cases. They open automatically when a period is closed with a material difference.</div>}
      {rows && rows.length > 0 && <table><thead><tr><th>Branch</th><th>Period</th><th>Method</th><th>Expected</th><th>Deposited</th><th>Difference</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map(c => <tr key={c.id}><td>{c.branch.name}</td><td>{day(c.periodStart)} → {day(c.periodEnd)}</td><td>{METHOD(c.method)}</td><td>{money(c.expectedAmount)}</td><td>{money(c.actualAmount)}</td>
          <td style={{ color: Number(c.difference) < 0 ? "var(--danger)" : undefined }}>{money(c.difference)}</td><td><span className={`badge ${STATUS_CLASS[c.status]}`}>{c.status}</span></td>
          <td className="row-actions"><button className="secondary" onClick={() => setActive(c)}>{canUpdate && c.status !== "RESOLVED" ? "Review" : "View"}</button></td></tr>)}</tbody></table>}
    </div>
    {active && <CaseModal c={active} canUpdate={canUpdate} onClose={() => setActive(null)} onSaved={() => { setActive(null); load(); }} />}
  </>);
}

function CaseModal({ c, canUpdate, onClose, onSaved }: { c: VarianceCase; canUpdate: boolean; onClose: () => void; onSaved: () => void }) {
  const [explanation, setExplanation] = useState(c.explanation || "");
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(status: "INVESTIGATING" | "RESOLVED") {
    setBusy(true); setError("");
    try { await api.patch(`/variance-cases/${c.id}`, { status, explanation: explanation || undefined, resolution: status === "RESOLVED" ? resolution : undefined }); onSaved(); }
    catch (e) { setError(err(e, "Update failed")); } finally { setBusy(false); }
  }
  const editable = canUpdate && c.status !== "RESOLVED";
  return (
    <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
      <h2>{c.branch.name} — {METHOD(c.method)} <span className={`badge ${STATUS_CLASS[c.status]}`}>{c.status}</span></h2>
      <p className="muted">{day(c.periodStart)} → {day(c.periodEnd)}</p>
      <p>Expected {money(c.expectedAmount)} · Deposited {money(c.actualAmount)} · <strong>Difference {money(c.difference)}</strong></p>
      {editable ? (<>
        <label>Explanation / findings<input value={explanation} onChange={e => setExplanation(e.target.value)} maxLength={500} placeholder="What was found out about this gap?" /></label>
        <label>Resolution (required to resolve)<input value={resolution} onChange={e => setResolution(e.target.value)} maxLength={500} placeholder="What was done / how it was settled" /></label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          {c.status === "OPEN" && <button className="secondary" disabled={busy} onClick={() => save("INVESTIGATING")}>Mark investigating</button>}
          <button disabled={busy || !resolution.trim()} onClick={() => save("RESOLVED")}>Resolve</button>
        </div></>) : (<>
        {c.explanation && <p><strong>Findings:</strong> {c.explanation}</p>}
        {c.resolution && <p><strong>Resolution:</strong> {c.resolution}{c.resolvedBy ? ` (${c.resolvedBy.name})` : ""}</p>}
      </>)}
    </div></div>
  );
}

function ClosingsTab() {
  const [rows, setRows] = useState<Closing[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get<Closing[]>("/branch-closings").then(setRows).catch(e => setError(err(e, "Failed to load"))); }, []);
  return (<>
    {error && <div className="error">{error}</div>}
    <div className="table-wrap">
      {rows && rows.length === 0 && <div className="empty">No closed periods yet. Close a period from the Reconciliation tab.</div>}
      {rows && rows.length > 0 && <table><thead><tr><th>Branch</th><th>Period</th><th>Expected</th><th>Deposited</th><th>Expenses</th><th>Difference</th><th>Cases</th><th>Closed by</th></tr></thead>
        <tbody>{rows.map(c => <tr key={c.id}><td>{c.branch.name}</td><td>{day(c.periodStart)} → {day(c.periodEnd)}</td><td>{money(c.expectedAmount)}</td><td>{money(c.depositedAmount)}</td><td>{money(c.expensesAmount)}</td>
          <td style={{ color: Number(c.differenceAmount) < 0 ? "var(--danger)" : undefined }}>{money(c.differenceAmount)}</td>
          <td>{c.varianceCases.length ? `${c.varianceCases.filter(v => v.status !== "RESOLVED").length} open / ${c.varianceCases.length}` : "—"}</td><td>{c.closedBy.name}<div className="muted">{new Date(c.closedAt).toLocaleDateString()}</div></td></tr>)}</tbody></table>}
    </div>
  </>);
}
