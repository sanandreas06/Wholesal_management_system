'use client';
/** The assistant's view of the company's records. Everything goes through the normal API with the person's own sign-in,
 *  so it only ever sees what that person may see. Lists are kept for a minute so a conversation stays quick. */
import { api, ApiError } from "../api";
import { getSessionUser } from "../session";
import { best, ReportData } from "./core";

export type Ref = { id: string; name: string };
export type Product = Ref & { sku: string; unitPrice: number; costPrice: number | null; stockQuantity: number; reorderLevel: number };
export type Customer = Ref & { code: string; phone?: string | null };
export type Supplier = Ref & { code: string };
export type StockRow = { productId: string; quantity: number; product: { id: string; name: string; sku: string; reorderLevel: number }; branch: Ref };
export type Me = { smart: boolean; branches: Ref[]; homeBranchId: string | null; currency: string };

const cache = new Map<string, { at: number; val: Promise<unknown> }>();
function get<T>(path: string, ttl = 60_000): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.val as Promise<T>;
  const val = api.get<T>(path);
  cache.set(path, { at: Date.now(), val });
  val.catch(() => cache.delete(path));
  return val;
}
/** After the assistant saves something, lists are read again. */
export const forget = () => cache.clear();

export const can = (p: string) => !!getSessionUser()?.permissions.includes(p);
export const isDemo = () => !!getSessionUser()?.demo;

export const me = () => get<Me>("/assistant/me", 5 * 60_000);
export async function branches(): Promise<Ref[]> { try { return (await me()).branches; } catch { return []; } }
export async function currency(): Promise<string> { try { return (await me()).currency; } catch { return getSessionUser()?.currency || "GHS"; } }
/** The branch to use when the person did not say: only when there is just one they may work with (otherwise the assistant asks). */
export async function defaultBranch(): Promise<Ref | null> {
  const list = await branches();
  return list.length === 1 ? list[0] : null;
}

export async function products(): Promise<Product[]> {
  if (!can("PRODUCTS:READ")) return [];
  const raw = await get<Record<string, unknown>[]>("/products");
  return raw.map((p) => ({ id: String(p.id), name: String(p.name), sku: String(p.sku ?? ""), unitPrice: Number(p.unitPrice ?? 0), costPrice: p.costPrice == null ? null : Number(p.costPrice), stockQuantity: Number(p.stockQuantity ?? 0), reorderLevel: Number(p.reorderLevel ?? 0) }));
}
export const customers = async (): Promise<Customer[]> => (can("CUSTOMERS:READ") ? get<Customer[]>("/customers") : []);
export const suppliers = async (): Promise<Supplier[]> => (can("SUPPLIERS:READ") ? get<Supplier[]>("/suppliers") : []);
export const categories = async (): Promise<Ref[]> => (can("EXPENSES:READ") ? get<Ref[]>("/expense-categories") : []);
export const stock = (branchId?: string) => get<StockRow[]>(`/inventory${branchId ? `?branchId=${branchId}` : ""}`, 30_000);
export const lowStock = (branchId?: string) => get<StockRow[]>(`/inventory/low-stock${branchId ? `?branchId=${branchId}` : ""}`, 30_000);
export const salesReport = (from: string, to: string, branchId?: string) =>
  api.get<ReportData>(`/assistant/sales-report?from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}`);

export const findProducts = async (q: string) => { const all = await products(); return q.trim() ? best(q, all, (p) => p.name, (p) => [p.sku]) : all; };
export const findCustomers = async (q: string) => { const all = await customers(); return q.trim() ? best(q, all, (c) => c.name, (c) => [c.code, c.phone ?? ""]) : all; };
export const findSuppliers = async (q: string) => { const all = await suppliers(); return q.trim() ? best(q, all, (s) => s.name, (s) => [s.code]) : all; };

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
