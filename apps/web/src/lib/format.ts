import { getSessionUser } from "./session";

/** Money in the company's own currency (set in Organization profile). Read at call time, so a change shows everywhere at once. */
const cache = new Map<string, Intl.NumberFormat>();
function nf(currency: string, short: boolean) {
  const key = `${currency}:${short}`;
  let f = cache.get(key);
  if (!f) {
    try { f = new Intl.NumberFormat("en-GH", { style: "currency", currency, ...(short ? { maximumFractionDigits: 0 } : {}) }); }
    catch { f = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", ...(short ? { maximumFractionDigits: 0 } : {}) }); }
    cache.set(key, f);
  }
  return f;
}
export const currencyCode = () => (typeof window === "undefined" ? "GHS" : getSessionUser()?.currency || "GHS");
export const money = { format: (n: number) => nf(currencyCode(), false).format(n) };
export const moneyShort = { format: (n: number) => nf(currencyCode(), true).format(n) };
/** The symbol on its own, for labels such as "Price (GH₵)". */
export function currencySymbol() {
  const parts = nf(currencyCode(), true).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? currencyCode();
}
