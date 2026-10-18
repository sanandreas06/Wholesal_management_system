'use client';
/** Things the assistant can do for someone: record a sale, order from a supplier, record an expense, add a customer.
 *  Each one is first shown as a card; it is saved only when the person presses Confirm, through the same API the
 *  normal screens use (so the same permissions, branch limits, stock checks and change log apply). */
import { api } from "../api";
import { iso, METHOD, money, View } from "./core";
import * as D from "./data";

export type SaleLine = { productId: string; name: string; quantity: number; price: number };
export type SaleDraft = { kind: "sale"; branchId?: string; customerId?: string | null; lines: SaleLine[]; pay?: { method: string; amount?: number } | "later" };
export type PoLine = { productId: string; name: string; quantity: number; cost: number };
export type PoDraft = { kind: "po"; supplierId?: string; branchId?: string; lines: PoLine[]; expectedDate?: string; notes?: string };
export type ExpenseDraft = { kind: "expense"; branchId?: string; categoryId?: string; amount?: number; description?: string; date: string };
export type CustomerDraft = { kind: "customer"; name?: string; phone?: string; email?: string; address?: string };
export type Draft = SaleDraft | PoDraft | ExpenseDraft | CustomerDraft;

export const NEED: Record<Draft["kind"], string> = { sale: "SALES:CREATE", po: "PURCHASING:CREATE", expense: "EXPENSES:CREATE", customer: "CUSTOMERS:CREATE" };
export const TITLE: Record<Draft["kind"], string> = { sale: "New sale", po: "New purchase order (draft)", expense: "New expense", customer: "New customer" };
export const FORM: Record<Draft["kind"], string> = { sale: "/sales?new=1", po: "/purchase-orders?new=1", expense: "/finance?tab=expenses&new=1", customer: "/customers?new=1" };

export type { View };

/** What the confirmation card shows, in words. */
export async function describe(d: Draft): Promise<View> {
  const cur = await D.currency();
  const [branches] = await Promise.all([D.branches()]);
  const bname = (id?: string) => branches.find((b) => b.id === id)?.name ?? "—";
  if (d.kind === "sale") {
    const cust = d.customerId ? (await D.customers()).find((c) => c.id === d.customerId)?.name ?? "—" : "Walk-in customer";
    const total = d.lines.reduce((s, l) => s + l.quantity * l.price, 0);
    const pay = !d.pay || d.pay === "later" ? "Not paid yet (owed)" : `${METHOD[d.pay.method] ?? d.pay.method}, ${money(d.pay.amount ?? total, cur)}`;
    return { title: TITLE.sale, rows: [["Branch", bname(d.branchId)], ["Customer", cust], ["Payment", pay]], lines: d.lines.map((l) => ({ name: l.name, qty: l.quantity, each: money(l.price, cur), total: money(l.quantity * l.price, cur) })), total: money(total, cur) };
  }
  if (d.kind === "po") {
    const sup = (await D.suppliers()).find((s) => s.id === d.supplierId)?.name ?? "—";
    const total = d.lines.reduce((s, l) => s + l.quantity * l.cost, 0);
    const rows: [string, string][] = [["Supplier", sup], ["Deliver to", bname(d.branchId)]];
    if (d.expectedDate) rows.push(["Expected", d.expectedDate]);
    if (d.notes) rows.push(["Note", d.notes]);
    return { title: TITLE.po, rows, lines: d.lines.map((l) => ({ name: l.name, qty: l.quantity, each: money(l.cost, cur), total: money(l.quantity * l.cost, cur) })), total: money(total, cur), note: "Saved as a draft. You can check it and send it to the supplier from Purchase Orders." };
  }
  if (d.kind === "expense") {
    const cat = (await D.categories()).find((c) => c.id === d.categoryId)?.name ?? "—";
    return { title: TITLE.expense, rows: [["Branch", bname(d.branchId)], ["Category", cat], ["What for", d.description ?? "—"], ["Date", d.date], ["Amount", money(d.amount ?? 0, cur)]], note: "It waits for approval if it is above your approval limit." };
  }
  const rows: [string, string][] = [["Name", d.name ?? "—"]];
  if (d.phone) rows.push(["Phone", d.phone]);
  if (d.email) rows.push(["Email", d.email]);
  if (d.address) rows.push(["Address", d.address]);
  return { title: TITLE.customer, rows };
}

/** What is still missing before the card can be shown (in the order the assistant asks). */
export function missing(d: Draft): string | null {
  if (d.kind === "sale") return !d.lines.length ? "items" : !d.branchId ? "branch" : d.customerId === undefined ? "customer" : d.pay === undefined ? "payment" : null;
  if (d.kind === "po") return !d.supplierId ? "supplier" : !d.lines.length ? "items" : !d.branchId ? "branch" : null;
  if (d.kind === "expense") return !d.amount ? "amount" : !d.categoryId ? "category" : !d.description ? "description" : !d.branchId ? "branch" : null;
  return !d.name ? "name" : d.phone === undefined ? "phone" : null;
}

/** Saves it. Returns a short sentence and where to see it. */
export async function execute(d: Draft): Promise<{ text: string; path: string }> {
  const cur = await D.currency();
  try {
    if (d.kind === "sale") {
      type Sale = { id: string; invoiceNumber: string; totalAmount: string | number };
      const sale = await api.post<Sale>("/sales", { branchId: d.branchId, customerId: d.customerId || undefined, items: d.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.price })) });
      const total = Number(sale.totalAmount);
      let extra = "";
      if (d.pay && d.pay !== "later" && d.pay.method !== "CREDIT" && D.can("PAYMENTS:CREATE")) {
        const amount = Math.min(d.pay.amount ?? total, total);
        try { await api.post(`/sales/${sale.id}/payments`, { method: d.pay.method, amount }); extra = ` Payment of ${money(amount, cur)} (${METHOD[d.pay.method]}) recorded.`; }
        catch (e) { extra = ` The sale is saved, but the payment was not: ${D.errorText(e)}`; }
      } else if (d.pay && d.pay !== "later" && d.pay.method !== "CREDIT") extra = " Your role cannot record payments, so ask someone who can to add it.";
      return { text: `Sale ${sale.invoiceNumber} saved: ${money(total, cur)}.${extra}`, path: "/sales" };
    }
    if (d.kind === "po") {
      const po = await api.post<{ orderNumber: string }>("/purchase-orders", { supplierId: d.supplierId, branchId: d.branchId, items: d.lines.map((l) => ({ productId: l.productId, quantityOrdered: l.quantity, unitCost: l.cost })), ...(d.expectedDate ? { expectedDate: d.expectedDate } : {}), ...(d.notes ? { notes: d.notes } : {}) });
      return { text: `Purchase order ${po.orderNumber} saved as a draft.`, path: "/purchase-orders" };
    }
    if (d.kind === "expense") {
      const ex = await api.post<{ status?: string }>("/expenses", { branchId: d.branchId, categoryId: d.categoryId, amount: d.amount, description: d.description, expenseDate: d.date });
      return { text: `Expense of ${money(d.amount ?? 0, cur)} recorded${ex?.status === "PENDING" ? " and waiting for approval" : ""}.`, path: "/finance?tab=expenses" };
    }
    const code = `C${Date.now().toString(36).slice(-6).toUpperCase()}`;
    await api.post("/customers", { name: d.name, code, ...(d.phone ? { phone: d.phone } : {}), ...(d.email ? { email: d.email } : {}), ...(d.address ? { address: d.address } : {}) });
    return { text: `Customer ${d.name} added (code ${code}).`, path: "/customers" };
  } finally { D.forget(); }
}

export const today = () => iso(new Date());
