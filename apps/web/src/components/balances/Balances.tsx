'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "../AppShell";
import { api, ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import { getSessionUser, SessionUser } from "../../lib/session";
import "../scan/scan.css";
import "./balances.css";

interface CustRow {
  customer: { id: string; name: string; code: string; phone: string | null; creditLimit: number | null; creditDays: number | null };
  owed: number; invoices: number; oldest: string | null; oldestDays: number; buckets: { d0_30: number; d31_60: number; d61_90: number; d90plus: number };
  overdue: number; creditDays: number; lastPaid: string | null; overLimit: boolean;
}
interface SupRow { supplier: { id: string; name: string; code: string; phone: string | null; creditDays: number | null }; received: number; paid: number; owed: number; credit: number; oldestUnpaid: string | null; dueDate: string | null; overdue: boolean }
interface StLine { date: string; kind: string; ref: string; detail: string; debit: number; credit: number; balance: number }
interface Company { name: string; logo: string | null; phone: string | null; email: string | null; address: string | null; currency: string }

const money = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
/** 0244 123 456 -> 233244123456, for a WhatsApp link */
const waNumber = (p: string | null) => { if (!p) return null; let d = p.replace(/\D/g, ""); if (d.startsWith("0")) d = "233" + d.slice(1); return d.length >= 11 ? d : null; };

/** Money owed, both ways: what customers owe the business (oldest first, with reminders), and what the business owes suppliers. */
export default function Balances() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<"customers" | "suppliers">("customers");
  useEffect(() => {
    const u = getSessionUser(); setUser(u);
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "suppliers" || (!u?.permissions.includes("PAYMENTS:READ") && u?.permissions.includes("PURCHASING:READ"))) setTab("suppliers");
  }, []);
  const can = (p: string) => !!user?.permissions.includes(p);
  return (
    <AppShell title="Money owed">
      <div className="bl">
        <div className="tk-tabs" role="tablist">
          {can("PAYMENTS:READ") && <button role="tab" aria-selected={tab === "customers"} className={tab === "customers" ? "on" : ""} onClick={() => setTab("customers")}>Customers owe you</button>}
          {can("PURCHASING:READ") && <button role="tab" aria-selected={tab === "suppliers"} className={tab === "suppliers" ? "on" : ""} onClick={() => setTab("suppliers")}>You owe suppliers</button>}
        </div>
        {tab === "customers" && can("PAYMENTS:READ") && <Customers canPay={can("PAYMENTS:CREATE")} company={user?.organization ?? ""} />}
        {tab === "suppliers" && can("PURCHASING:READ") && <Suppliers canPay={can("EXPENSES:APPROVE")} />}
      </div>
    </AppShell>
  );
}

function Customers({ canPay, company }: { canPay: boolean; company: string }) {
  const [rows, setRows] = useState<CustRow[] | null>(null);
  const [paying, setPaying] = useState<CustRow | null>(null);
  const [q, setQ] = useState("");
  function load() { api.get<CustRow[]>("/balances/customers").then(setRows).catch(() => setRows([])); }
  useEffect(load, []);
  const shown = (rows ?? []).filter(r => !q.trim() || r.customer.name.toLowerCase().includes(q.trim().toLowerCase()) || (r.customer.phone ?? "").includes(q.trim()));
  const sum = (f: (r: CustRow) => number) => (rows ?? []).reduce((t, r) => t + f(r), 0);
  const reminder = (r: CustRow) => `Hello ${r.customer.name}, this is a friendly reminder from ${company || "us"}: your balance is GH₵ ${money(r.owed)}${r.overdue > 0 ? `, of which GH₵ ${money(r.overdue)} is past due` : ""}. Thank you for your business.`;

  async function statement(r: CustRow) {
    const w = window.open("", "_blank"); if (!w) { toast.error("Allow pop-ups for this site to print statements."); return; }
    w.document.write("<p style=\"font-family:sans-serif;padding:24px\">Preparing the statement...</p>");
    try {
      const s = await api.get<{ company: Company; customer: CustRow["customer"] & { email: string | null; address: string | null }; from: string; opening: number; closing: number; lines: StLine[] }>(`/balances/customers/${r.customer.id}/statement`);
      printStatement(w, s.company, `${s.customer.name}${s.customer.phone ? ` · ${s.customer.phone}` : ""}`, s.from, s.opening, s.closing, s.lines, "Customer statement", "Balance you owe");
    } catch (e) { w.close(); toast.error(e instanceof ApiError ? e.message : "Could not make the statement."); }
  }

  return (<>
    <div className="bl-tiles">
      <div><span>Owed to you</span><b>GH₵ {money(sum(r => r.owed))}</b></div>
      <div className="warn"><span>Past their credit days</span><b>GH₵ {money(sum(r => r.overdue))}</b></div>
      <div><span>Over 90 days</span><b>GH₵ {money(sum(r => r.buckets.d90plus))}</b></div>
      <div><span>Customers owing</span><b>{rows?.length ?? "…"}</b></div>
    </div>
    <div className="toolbar"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a customer or phone" aria-label="Search customers" style={{ maxWidth: 320 }} /></div>
    <div className="table-wrap">
      {rows === null ? <div className="empty">Loading…</div> : rows.length === 0 ? <div className="empty">No customer owes you anything. Sales on credit show here until they are paid.</div> : (
        <table className="bl-table">
          <thead><tr><th>Customer</th><th>Owes</th><th>0–30 days</th><th>31–60</th><th>61–90</th><th>90+</th><th>Oldest</th><th></th></tr></thead>
          <tbody>{shown.map(r => {
            const wa = waNumber(r.customer.phone);
            return (
              <tr key={r.customer.id} className={r.overdue > 0 ? "late" : ""}>
                <td><b>{r.customer.name}</b><small>{r.customer.phone ?? r.customer.code}{r.overLimit ? " · over credit limit" : ""}</small></td>
                <td><b>{money(r.owed)}</b>{r.overdue > 0 && <small className="neg">{money(r.overdue)} past {r.creditDays} days</small>}</td>
                <td>{r.buckets.d0_30 ? money(r.buckets.d0_30) : "—"}</td><td>{r.buckets.d31_60 ? money(r.buckets.d31_60) : "—"}</td><td>{r.buckets.d61_90 ? money(r.buckets.d61_90) : "—"}</td>
                <td className={r.buckets.d90plus ? "neg" : ""}>{r.buckets.d90plus ? money(r.buckets.d90plus) : "—"}</td>
                <td>{r.oldestDays} day{r.oldestDays === 1 ? "" : "s"}<small>{r.lastPaid ? `last paid ${day(r.lastPaid)}` : "nothing paid yet"}</small></td>
                <td className="row-actions">
                  {canPay && <button onClick={() => setPaying(r)}>Payment</button>}
                  <button className="secondary" onClick={() => statement(r)}>Statement</button>
                  {wa && <a className="button secondary" href={`https://wa.me/${wa}?text=${encodeURIComponent(reminder(r))}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </div>
    {paying && <PayModal title={`Payment from ${paying.customer.name}`} hint={`They owe GH₵ ${money(paying.owed)}. The payment settles their oldest invoices first.`} max={paying.owed}
      onClose={() => setPaying(null)} onSave={async b => {
        const r = await api.post<{ applied: { invoiceNumber: string; amount: number }[]; owedNow: number }>(`/balances/customers/${paying.customer.id}/payments`, b);
        toast.success(`Recorded. Paid ${r.applied.map(a => `${a.invoiceNumber} (${money(a.amount)})`).join(", ")}. Still owes ${money(r.owedNow)}.`); setPaying(null); load();
      }} />}
  </>);
}

function Suppliers({ canPay }: { canPay: boolean }) {
  const [rows, setRows] = useState<SupRow[] | null>(null);
  const [paying, setPaying] = useState<SupRow | null>(null);
  function load() { api.get<SupRow[]>("/balances/suppliers").then(setRows).catch(() => setRows([])); }
  useEffect(load, []);
  async function statement(r: SupRow) {
    const w = window.open("", "_blank"); if (!w) { toast.error("Allow pop-ups for this site to print statements."); return; }
    w.document.write("<p style=\"font-family:sans-serif;padding:24px\">Preparing the statement...</p>");
    try {
      const s = await api.get<{ company: Company; supplier: SupRow["supplier"]; lines: StLine[]; closing: number }>(`/balances/suppliers/${r.supplier.id}/statement`);
      printStatement(w, s.company, s.supplier.name, null, 0, s.closing, s.lines, "Supplier account", "Balance we owe");
    } catch (e) { w.close(); toast.error(e instanceof ApiError ? e.message : "Could not make the statement."); }
  }
  const total = (rows ?? []).reduce((t, r) => t + r.owed, 0), late = (rows ?? []).filter(r => r.overdue).reduce((t, r) => t + r.owed, 0);
  return (<>
    <div className="bl-tiles">
      <div><span>You owe suppliers</span><b>GH₵ {money(total)}</b></div>
      <div className="warn"><span>Past the due date</span><b>GH₵ {money(late)}</b></div>
      <div><span>Suppliers to pay</span><b>{rows?.filter(r => r.owed > 0).length ?? "…"}</b></div>
    </div>
    <p className="muted bl-note">Worked out from goods received (at the supplier&apos;s invoice amount when it was entered on receiving, otherwise at cost) minus payments recorded here.</p>
    <div className="table-wrap">
      {rows === null ? <div className="empty">Loading…</div> : rows.length === 0 ? <div className="empty">You owe no supplier anything.</div> : (
        <table className="bl-table">
          <thead><tr><th>Supplier</th><th>Goods received</th><th>Paid</th><th>You owe</th><th>Due</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.supplier.id} className={r.overdue ? "late" : ""}>
              <td><b>{r.supplier.name}</b><small>{r.supplier.phone ?? r.supplier.code}</small></td>
              <td>{money(r.received)}</td><td>{money(r.paid)}</td>
              <td><b>{money(r.owed)}</b>{r.credit > 0 && <small>they owe you {money(r.credit)}</small>}</td>
              <td className={r.overdue ? "neg" : ""}>{r.dueDate ? `${day(r.dueDate)}${r.overdue ? " · overdue" : ""}` : "—"}</td>
              <td className="row-actions">{canPay && <button onClick={() => setPaying(r)}>Record payment</button>}<button className="secondary" onClick={() => statement(r)}>Account</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
    {paying && <PayModal title={`Pay ${paying.supplier.name}`} hint={`You owe GH₵ ${money(paying.owed)}.`} supplier
      onClose={() => setPaying(null)} onSave={async b => { await api.post(`/balances/suppliers/${paying.supplier.id}/payments`, b); toast.success("Payment recorded."); setPaying(null); load(); }} />}
  </>);
}

function PayModal({ title, hint, max, supplier, onClose, onSave }: { title: string; hint: string; max?: number; supplier?: boolean; onClose: () => void; onSave: (b: { amount: number; method: string; reference?: string; note?: string }) => Promise<void> }) {
  const [amount, setAmount] = useState(max ? String(max) : "");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await onSave({ amount: Number(amount), method, reference: reference.trim() || undefined, note: note.trim() || undefined }); }
    catch (er) { setError(er instanceof ApiError ? er.message : "Could not save."); setBusy(false); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{title}</h2>
        <p className="muted">{hint}</p>
        <form onSubmit={submit}>
          <label>Amount (GH₵)<input type="number" step="0.01" min="0.01" max={max} value={amount} onChange={e => setAmount(e.target.value)} required autoFocus /></label>
          <label>How<select value={method} onChange={e => setMethod(e.target.value)}><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option><option value="BANK">Bank</option></select></label>
          <label>Reference (optional)<input value={reference} onChange={e => setReference(e.target.value)} maxLength={60} placeholder="Transaction ID, cheque number…" /></label>
          {supplier && <label>Note (optional)<input value={note} onChange={e => setNote(e.target.value)} maxLength={300} /></label>}
          {error && <div className="error">{error}</div>}
          <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button disabled={busy}>{busy ? "Saving…" : "Record payment"}</button></div>
        </form>
      </div>
    </div>
  );
}

function printStatement(w: Window, c: Company, who: string, from: string | null, opening: number, closing: number, lines: StLine[], title: string, closingLabel: string) {
  const logo = c.logo && /^data:image\/(png|jpeg|webp);base64,/.test(c.logo) ? `<img src="${c.logo}" alt="">` : "";
  const rows = lines.map(l => `<tr><td>${day(l.date)}</td><td>${esc(l.kind === "SALE" ? "Invoice" : l.kind === "GOODS" ? "Goods received" : "Payment")} ${esc(l.ref)}<small>${esc(l.detail)}</small></td><td class="r">${l.debit ? money(l.debit) : ""}</td><td class="r">${l.credit ? money(l.credit) : ""}</td><td class="r">${money(l.balance)}</td></tr>`).join("");
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} - ${esc(who)}</title><style>
    @page{margin:14mm}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a2332;font-size:13px;margin:0;padding:8px}
    .top{display:flex;justify-content:space-between;border-bottom:3px solid #0B1B3E;padding-bottom:12px}.top img{max-width:70px;max-height:70px;margin-right:12px}
    .co{display:flex}.co b{font-size:18px;display:block}.co small{display:block;color:#6b7280}h1{margin:0;font-size:22px;text-align:right}
    .who{margin:16px 0}.who b{font-size:15px}table{width:100%;border-collapse:collapse}th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;text-align:left;padding:7px;border-bottom:2px solid #e5e7eb}
    td{padding:7px;border-bottom:1px solid #eef0f3;vertical-align:top}td small{display:block;color:#9ca3af;font-size:11px}.r{text-align:right;white-space:nowrap}
    .tot{margin:14px 0 0 auto;width:280px;font-size:16px;font-weight:800;display:flex;justify-content:space-between;border-top:2px solid #1a2332;padding-top:8px}
  </style></head><body>
    <div class="top"><div class="co">${logo}<div><b>${esc(c.name)}</b>${[c.address, c.phone, c.email].filter(Boolean).map(x => `<small>${esc(String(x))}</small>`).join("")}</div></div><div><h1>${esc(title)}</h1><div style="text-align:right;color:#6b7280">${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div></div></div>
    <div class="who"><b>${esc(who)}</b>${from ? `<div style="color:#6b7280">From ${day(from)} · opening balance ${money(opening)}</div>` : ""}</div>
    <table><thead><tr><th>Date</th><th>Item</th><th class="r">Charged</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>${rows || `<tr><td colspan="5">Nothing in this period.</td></tr>`}</tbody></table>
    <div class="tot"><span>${esc(closingLabel)}</span><span>GH₵ ${money(closing)}</span></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`);
  w.document.close();
}
