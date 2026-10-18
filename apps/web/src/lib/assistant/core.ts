/** Shared pieces of the WHOLESTRA assistant: what a chat line looks like, fuzzy name matching, dates and money. */

export type Chip = { label: string; say?: string; run?: ClientRun };
/** Things a chip or the assistant can do in the browser without asking the server. */
export type ClientRun =
  | { do: "go"; path: string }
  | { do: "tour" }
  | { do: "demo" }
  | { do: "install" }
  | { do: "reset" };

export type ReportData = {
  from: string; to: string; currency: string; branch: { id: string; name: string } | null;
  count: number; total: number; paid: number; owed: number;
  byBranch: { id: string; name: string; count: number; total: number }[];
  byMethod: { method: string; amount: number }[];
  topProducts: { id: string; name: string; quantity: number; total: number }[];
};

/** What a confirmation card shows. */
export type View = { title: string; rows: [string, string][]; lines?: { name: string; qty: number; each: string; total: string }[]; total?: string; note?: string };

export type Line = { label: string; detail?: string; value?: string; tone?: "warn" | "bad" | "ok" };

export type Card =
  | { kind: "report"; data: ReportData; title: string }
  | { kind: "list"; title: string; lines: Line[]; more?: number; empty?: string }
  | { kind: "confirm"; id: string; state: "waiting" | "saving" | "done" | "cancelled" | "failed" | "expired"; error?: string; view?: View; form?: string; demo?: boolean }
  | { kind: "contact" };

export type Item = { id: string; from: "bot" | "me"; text?: string; chips?: Chip[]; card?: Card; at: number };

let seq = 0;
export const newId = (p = "m") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;
export const botSay = (text: string, extra: Partial<Item> = {}): Item => ({ id: newId(), from: "bot", text, at: Date.now(), ...extra });

// ------------------------------------------------------------------------------------------------ words
export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.\s]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["the", "a", "an", "of", "to", "for", "and", "in", "at", "on", "my", "our", "me", "pls", "please", "some", "x", "pcs", "pc", "piece", "pieces", "unit", "units", "bag", "bags", "carton", "cartons", "box", "boxes", "pack", "packs", "tin", "tins", "crate", "crates", "dozen"]);
export const words = (s: string) => norm(s).split(" ").filter((w) => w && !STOP.has(w));

/** How well `query` fits `name` (0 = not at all, 1 = exact). Tolerates plurals and small typos. */
export function fit(query: string, name: string, extra: string[] = []): number {
  const q = words(query); if (!q.length) return 0;
  const hay = [name, ...extra].map(norm);
  if (hay.some((h) => h === norm(query))) return 1;
  const toks = hay.join(" ").split(" ");
  let hit = 0;
  const stems = (x: string) => [x, x.replace(/s$/, ""), x.replace(/es$/, "")];
  for (const w of q) {
    const stem = w.replace(/(es|s)$/, ""), sw = stems(w);
    if (toks.some((t) => stems(t).some((x) => sw.includes(x)))) hit += 1;
    else if (w.length >= 3 && toks.some((t) => t.startsWith(w) || (stem.length >= 4 && t.startsWith(stem)))) hit += 0.8;
    else if (w.length >= 5 && toks.some((t) => near(t, w))) hit += 0.6;
  }
  return hit / q.length * (hit ? Math.min(1, 0.6 + 0.4 * (q.length / Math.max(q.length, words(name).length))) : 0);
}
function near(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, miss = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; } else { miss++; if (miss > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } }
  return miss + (a.length - i) + (b.length - j) <= 1;
}
/** The best matches for `query` among `list`; several when it is a close call. */
export function best<T>(query: string, list: T[], name: (t: T) => string, extra: (t: T) => string[] = () => [], min = 0.5): T[] {
  const scored = list.map((t) => ({ t, s: fit(query, name(t), extra(t)) })).filter((x) => x.s >= min).sort((a, b) => b.s - a.s);
  if (!scored.length) return [];
  if (scored[0].s === 1) return [scored[0].t];
  return scored.filter((x) => x.s >= scored[0].s - 0.15).slice(0, 6).map((x) => x.t);
}
/** Finds which of `list`'s names appear inside a sentence (for "sales at Tema today"). */
export function mentioned<T>(text: string, list: T[], name: (t: T) => string): T | undefined {
  const t = ` ${norm(text)} `;
  return [...list].sort((a, b) => name(b).length - name(a).length).find((x) => { const n = norm(name(x)); return n.length >= 3 && t.includes(` ${n} `); })
    ?? list.find((x) => { const first = norm(name(x)).split(" ")[0]; return first.length >= 4 && t.includes(` ${first} `); });
}

// ------------------------------------------------------------------------------------------------ dates
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** "today", "yesterday", "this week", "last month", "last 7 days", "monday", "12 october", "2026-10-12", "12/10" → a range of days. */
export function dateRange(text: string, now = new Date()): { from: string; to: string; label: string } | null {
  const t = norm(text);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (d: Date, label: string) => ({ from: iso(d), to: iso(d), label });
  if (/\btoday\b|\btoday s\b|\btonight\b|\bdaily\b/.test(t)) return day(today, "today");
  if (/\byesterday\b/.test(t)) return day(addDays(today, -1), "yesterday");
  let m = t.match(/\b(?:last|past) (\d{1,3}) days?\b/);
  if (m) { const n = Math.max(1, Math.min(366, Number(m[1]))); return { from: iso(addDays(today, -(n - 1))), to: iso(today), label: `the last ${n} days` }; }
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  if (/\bthis week\b|\bweekly\b/.test(t)) return { from: iso(monday), to: iso(today), label: "this week" };
  if (/\blast week\b/.test(t)) return { from: iso(addDays(monday, -7)), to: iso(addDays(monday, -1)), label: "last week" };
  if (/\bthis month\b|\bmonthly\b/.test(t)) return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today), label: "this month" };
  if (/\blast month\b/.test(t)) { const s = new Date(today.getFullYear(), today.getMonth() - 1, 1); return { from: iso(s), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)), label: "last month" }; }
  if (/\bthis year\b/.test(t)) return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today), label: "this year" };
  const raw = text.toLowerCase();
  m = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/) || null;
  if (m) { const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); if (!isNaN(+d)) return day(d, fmtDay(d)); }
  m = raw.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : today.getFullYear(); const d = new Date(y, Number(m[2]) - 1, Number(m[1])); if (!isNaN(+d) && d.getMonth() === Number(m[2]) - 1) return day(d, fmtDay(d)); }
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/) || t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?\b/);
  if (m) {
    const [dd, mm] = /\d/.test(m[1]) ? [Number(m[1]), m[2]] : [Number(m[2]), m[1]];
    let d = new Date(today.getFullYear(), MONTHS.indexOf(mm), dd); if (d > today) d = new Date(today.getFullYear() - 1, MONTHS.indexOf(mm), dd);
    return day(d, fmtDay(d));
  }
  const wd = DAYS.findIndex((n) => new RegExp(`\\b${n}\\b`).test(t));
  if (wd >= 0) { let back = (today.getDay() - wd + 7) % 7; if (back === 0 && !/\btoday\b/.test(t)) back = 0; return day(addDays(today, -back), back === 0 ? "today" : DAYS[wd][0].toUpperCase() + DAYS[wd].slice(1)); }
  return null;
}
export const fmtDay = (d: Date | string) => (typeof d === "string" ? new Date(`${d}T12:00:00`) : d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

// ------------------------------------------------------------------------------------------------ money
const SYMBOL: Record<string, string> = { GHS: "GH₵", NGN: "₦", USD: "US$", EUR: "€", GBP: "£", KES: "KSh", ZAR: "R", XOF: "CFA", XAF: "FCFA", UGX: "USh", TZS: "TSh" };
export const money = (n: number, cur = "GHS") => `${SYMBOL[cur] ?? cur} ${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const METHOD: Record<string, string> = { CASH: "Cash", BANK: "Bank", MOBILE_MONEY: "Mobile money", CREDIT: "On credit" };

/** Reads a number like "1,250", "1.5k", "2 thousand". */
export function amountIn(text: string): number | null {
  const m = text.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2").match(/(\d+(?:\.\d+)?)\s*(k|thousand)?\b/);
  if (!m) return null;
  return Number(m[1]) * (m[2] ? 1000 : 1);
}
