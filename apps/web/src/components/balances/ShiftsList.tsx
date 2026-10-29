'use client';
import { useEffect, useState } from "react";
import AppShell from "../AppShell";
import { api, ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import { getSessionUser } from "../../lib/session";
import "./balances.css";

export interface Shift {
  id: string; status: string; branch: string; cashier: string; userId: string; openedAt: string; closedAt: string | null; openingFloat: number; note: string | null;
  totals: { cash: number; momo: number; bank: number; credit: number; sales: number; voided: number; salesTotal: number };
  expectedCash: number; countedCash: number | null; difference: number | null;
}
const m = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const t = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Every cashier's shifts: float, takings by method, expected and counted cash, and the gap. */
export default function ShiftsList() {
  const [rows, setRows] = useState<Shift[] | null>(null);
  const [days, setDays] = useState(14);
  const [closing, setClosing] = useState<Shift | null>(null);
  const [counted, setCounted] = useState("");
  const [canClose, setCanClose] = useState(false);
  function load() { api.get<Shift[]>(`/shifts?days=${days}`).then(setRows).catch(() => setRows([])); }
  useEffect(load, [days]);
  useEffect(() => setCanClose(!!getSessionUser()?.permissions.includes("BRANCH_CLOSING:CREATE")), []);
  async function close() {
    if (!closing) return;
    try { const r = await api.post<Shift & { caseOpened: boolean }>(`/shifts/${closing.id}/close`, { countedCash: Number(counted), note: "Ended by a manager" }); toast.success(r.caseOpened ? `Ended. A cash case was opened for a gap of ${m(r.difference ?? 0)}.` : "Ended. The cash matched."); setClosing(null); setCounted(""); load(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not end the shift."); }
  }
  return (
    <AppShell title="Cashier shifts">
      <div className="sh">
        <div className="toolbar"><p className="muted">Each cashier counts the drawer at the start and at the end of their shift. A gap of GH₵ 1 or more opens a case in Finance with the cashier&apos;s name.</p>
          <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Period"><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={31}>Last 31 days</option><option value={92}>Last 3 months</option></select></div>
        <div className="table-wrap">
          {rows === null ? <div className="empty">Loading…</div> : rows.length === 0 ? <div className="empty">No shifts yet. Cashiers start a shift at the Counter.</div> : (
            <table>
              <thead><tr><th>Cashier</th><th>Branch</th><th>Started</th><th>Ended</th><th>Float</th><th>Cash taken</th><th>MoMo</th><th>Expected</th><th>Counted</th><th>Gap</th><th></th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.id}>
                  <td>{r.cashier}</td><td>{r.branch}</td><td>{t(r.openedAt)}</td><td>{r.closedAt ? t(r.closedAt) : <span className="badge high">Open</span>}</td>
                  <td>{m(r.openingFloat)}</td><td>{m(r.totals.cash)}</td><td>{m(r.totals.momo)}</td><td>{m(r.expectedCash)}</td><td>{r.countedCash === null ? "—" : m(r.countedCash)}</td>
                  <td className={"sh-diff" + (r.difference === null ? "" : r.difference < 0 ? " neg" : r.difference > 0 ? " pos" : "")}>{r.difference === null ? "—" : r.difference === 0 ? "✓" : m(r.difference)}</td>
                  <td className="row-actions">{r.status === "OPEN" && canClose && <button className="secondary" onClick={() => { setClosing(r); setCounted(""); }}>End shift</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        {closing && <div className="modal-backdrop" onClick={() => setClosing(null)}><div className="modal" onClick={e => e.stopPropagation()}>
          <h2>End {closing.cashier}&apos;s shift</h2>
          <p className="muted">Count the cash in the drawer. There should be GH₵ {m(closing.expectedCash)} (float {m(closing.openingFloat)} + cash taken {m(closing.totals.cash)}).</p>
          <label>Cash counted (GH₵)<input type="number" step="0.01" min="0" value={counted} onChange={e => setCounted(e.target.value)} autoFocus /></label>
          <div className="modal-actions"><button className="secondary" onClick={() => setClosing(null)}>Cancel</button><button disabled={counted === ""} onClick={close}>End shift</button></div>
        </div></div>}
      </div>
    </AppShell>
  );
}
