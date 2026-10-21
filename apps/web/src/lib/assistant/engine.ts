'use client';
/**
 * The WHOLESTRA assistant's brain.
 * - Built in: understands common requests ("sales today", "sell 10 cement to Kofi", "what is running low", "how do I…")
 *   and asks for anything missing, step by step. Works with no extra set-up.
 * - Smart: when the server has an Anthropic key, free-form messages go to Claude, which uses the same tools.
 *   If the smart service is off or fails, the built-in brain answers instead.
 * Nothing is ever saved without the person pressing Confirm on a card.
 */
import { api, ApiError } from "../api";
import { getSessionUser } from "../session";
import { amountIn, best, botSay, Card, Chip, dateRange, fmtDay, Item, Line, mentioned, METHOD, money, newId, norm, ReportData } from "./core";
import { APP, lookup, SITE } from "./knowledge";
import * as A from "./actions";
import * as D from "./data";

export type Mode = "site" | "app";
export type Host = {
  push(items: Item[]): void;
  patch(id: string, card: Card): void;
  go(path: string): void;
  tour(): void;
  demo(): void;
  install(): void;
};
type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
type Msg = { role: "user" | "assistant"; content: string | Block[] };
export type Saved = { items: Item[]; messages: Msg[]; draft?: { d: A.Draft; asking?: string; choices?: string } | null };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const firstName = () => (getSessionUser()?.name ?? "").split(" ")[0];
const go = (label: string, path: string): Chip => ({ label, run: { do: "go", path } });
const say = (label: string, text = label): Chip => ({ label, say: text });

// ------------------------------------------------------------------------------------------------ pages people may ask for by name
const APP_PAGES: { keys: string[]; path: string; label: string; need?: string }[] = [
  { keys: ["home", "dashboard", "main page", "start page"], path: "/dashboard", label: "Home" },
  { keys: ["products", "product list", "items", "catalogue", "catalog"], path: "/products", label: "Products", need: "PRODUCTS:READ" },
  { keys: ["categories", "category"], path: "/categories", label: "Categories", need: "CATEGORIES:READ" },
  { keys: ["brands", "brand"], path: "/brands", label: "Brands", need: "BRANDS:READ" },
  { keys: ["units", "unit"], path: "/units", label: "Units", need: "UNITS:READ" },
  { keys: ["stock levels", "inventory", "stock", "warehouse"], path: "/inventory", label: "Stock Levels", need: "INVENTORY:READ" },
  { keys: ["stock adjustments", "adjustments", "adjustment"], path: "/stock-adjustments", label: "Stock Adjustments", need: "STOCK_ADJUSTMENTS:READ" },
  { keys: ["stock transfers", "transfers", "transfer"], path: "/stock-transfers", label: "Stock Transfers", need: "STOCK_TRANSFERS:READ" },
  { keys: ["stock counts", "stock count", "counts"], path: "/stock-counts", label: "Stock Counts", need: "STOCK_COUNTS:READ" },
  { keys: ["sales", "invoices", "invoice", "sales and invoices"], path: "/sales", label: "Sales & Invoices", need: "SALES:READ" },
  { keys: ["customers", "customer list", "clients"], path: "/customers", label: "Customers", need: "CUSTOMERS:READ" },
  { keys: ["purchase orders", "purchase order", "purchases", "orders", "po"], path: "/purchase-orders", label: "Purchase Orders", need: "PURCHASING:READ" },
  { keys: ["reorder", "reorder suggestions"], path: "/reorder", label: "Reorder Suggestions", need: "PURCHASING:READ" },
  { keys: ["suppliers", "supplier list", "vendors"], path: "/suppliers", label: "Suppliers", need: "SUPPLIERS:READ" },
  { keys: ["finance", "expenses", "deposits", "reconciliation", "closings"], path: "/finance", label: "Finance" },
  { keys: ["insights", "investment insights", "profit"], path: "/insights", label: "Investment Insights", need: "PROFIT:READ" },
  { keys: ["excel import", "import", "imports", "excel"], path: "/imports", label: "Excel Import", need: "EXCEL_IMPORT:READ" },
  { keys: ["audit", "change log", "fraud signals", "audit log"], path: "/audit", label: "Audit", need: "AUDIT:READ" },
  { keys: ["settings", "all settings"], path: "/settings", label: "Settings" },
  { keys: ["security", "sign in and security", "authenticator"], path: "/settings/security", label: "Sign-in & security" },
  { keys: ["branches", "branch list"], path: "/branches", label: "Branches", need: "BRANCHES:READ" },
  { keys: ["users", "staff", "employees", "team"], path: "/users", label: "Users", need: "USERS:READ" },
  { keys: ["roles", "permissions"], path: "/roles", label: "Roles", need: "ROLES:READ" },
  { keys: ["refer", "refer and earn", "referrals", "referral"], path: "/referrals", label: "Refer & earn" },
];
const SITE_PAGES: { keys: string[]; path: string; label: string }[] = [
  { keys: ["home", "home page", "start"], path: "/", label: "Home" },
  { keys: ["features", "feature"], path: "/features", label: "Features" },
  { keys: ["security", "safety"], path: "/security", label: "Security" },
  { keys: ["refer", "refer and earn", "referral"], path: "/refer", label: "Refer & earn" },
  { keys: ["about", "about us"], path: "/about", label: "About" },
  { keys: ["contact", "contact us", "contact page"], path: "/contact", label: "Contact" },
  { keys: ["sign up", "signup", "get started", "register", "create account"], path: "/get-started", label: "Get started" },
  { keys: ["sign in", "login", "log in", "signin"], path: "/login", label: "Sign in" },
  { keys: ["privacy", "privacy notice", "privacy policy"], path: "/privacy", label: "Privacy notice" },
  { keys: ["terms", "terms of use", "terms and conditions"], path: "/terms", label: "Terms of use" },
];
function pageFor(text: string, list: { keys: string[]; path: string; label: string; need?: string }[]) {
  const t = ` ${norm(text)} `;
  let top: { p: (typeof list)[number]; n: number } | null = null;
  for (const p of list) for (const k of p.keys) if (t.includes(` ${k} `) && (!top || k.length > top.n)) top = { p, n: k.length };
  return top?.p ?? null;
}

// ------------------------------------------------------------------------------------------------ words that signal what someone wants
const has = (t: string, re: RegExp) => re.test(` ${t} `);
const GREET = /^(hi|hello|hey|hiya|yo|good (morning|afternoon|evening)|morning|afternoon|evening|akwaaba|howdy|greetings)( there| wholestra| assistant)?$/;
const THANKS = /^(thanks|thank you|thank u|ok thanks|great thanks|cool|nice|perfect|ok|okay|alright|great|awesome|good)( very much| a lot| so much)?$/;
const CANCEL = /^(cancel|stop|never ?mind|forget it|no|nope|abort|quit|exit|leave it)$/;
const TOUR = / (tour|show me around|walk me through|guide me|give me a tour|how does (this|it|the app|wholestra) work|show me how|introduce|onboard|where do i start|how do i start|get started with the app) /;
const HELP = / (help|menu|options|what can you do|what do you do|commands|how can you help|what can i ask) /;
const QUESTION = /^(how|where|what is|what are|what s|whats|why|can i|could i|is it|is there|does|do i|explain|tell me how|show me how)\b/;
const REPORT = / (sales report|daily sales|sales today|today s sales|todays sales|sales for|sales on|sales this|sales last|sales yesterday|yesterday s sales|takings|revenue|turnover|how much (did|have) (we|i) (sell|sold|make|made)|how (did|were) (we|sales|the sales)|how many sales|total sales|report (the )?sales|report (on )?(today|yesterday|this|last)|sales summary|sales figures|end of day report|day s sales|weekly sales|monthly sales) /;
const LOW = / (low stock|running low|run out|running out|out of stock|reorder|what (should|do) (i|we) (buy|order|restock)|needs restocking|restock list|finished stock) /;
const SALE = / ((record|add|make|create|enter|log|new|raise|capture|book)( a| an| the| new| my| our| today s)? (sale|sales|invoice|receipt)|(i|we|just) (sold|sell)|^ ?(sell|sold) |sell \d|sold \d) /;
const PO = / ((create|make|place|raise|new|add|start|prepare|draft)( a| an| the| new)? (purchase order|po|order to|supplier order|restock order)|order \d+|order from|buy from|purchase from|restock from|order (some|more) ) /;
const ORDER_AMBIG = / ((create|make|place|new|add|take|record)( a| an| the| new)? order) /;
const EXPENSE = / ((record|add|log|enter|new|create|capture)( an| a| the| new)? (expense|expenditure|cost)|(i|we) (spent|paid for|bought fuel)|expense of|expense for|spent \d) /;
const CUSTOMER = / ((add|create|new|register|save|record)( a| an| the| new)? (customer|client|buyer)) /;
const STOCKQ = / (how many|how much stock|stock of|stock for|in stock|do we have|do i have|have we got|is there any|are there any|quantity of|qty of|available|left in|how much .* left|check stock|stock level|stock check) /;
const NAV = /^(go to|goto|open|take me to|show me the|show|navigate to|bring up|where is|where s|where are|where can i find|find the|i want to see|let me see|switch to|jump to) /;

const PHONE = /(\+?\d[\d\s-]{7,15}\d)/;
const EMAIL = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;

/** "10 cement 50kg, 5 rice at 300" → lines of { qty, name, price }. */
function pieces(text: string): { qty: number; name: string; price?: number }[] {
  let t = text.toLowerCase()
    .replace(/^(please |pls |can you |could you |kindly |i want to |i d like to |help me )+/, "")
    .replace(/^(record|add|make|create|enter|log|new|raise|capture|book|place|prepare|draft|start)( a| an| the| new| my| our| today s)?( sale| sales| invoice| receipt| purchase order| po| order| supplier order| restock order)?( of| for)?:?\s*/, "")
    .replace(/^(i |we |just )*(sold|sell|order|buy|purchase|restock)( of)?\s*/, "");
  t = t.replace(/(\d),(\d{3})/g, "$1$2");
  const out: { qty: number; name: string; price?: number }[] = [];
  for (let seg of t.split(/,|;|\n|\+|\band\b|&/)) {
    seg = seg.trim(); if (!seg) continue;
    let price: number | undefined;
    const pm = seg.match(/(?:\bat\b|@|\bfor\b)\s*(?:gh₵|ghc|ghs|gh¢|cedis?|₦|\$)?\s*(\d+(?:\.\d+)?)\s*(?:cedis?|ghs|each|per|a piece|apiece)?/);
    if (pm) { price = Number(pm[1]); seg = seg.replace(pm[0], " "); }
    seg = seg.replace(/\b(to|from|at|for|by|in|paid|pay|on|with|via|using|deliver|delivered|expected)\b.*$/, "").trim();
    let qty = 1; let name = seg;
    let m = seg.match(/^(\d+)\s*(?:x|×)?\s*(.*)$/);
    if (m && m[2]) { qty = Number(m[1]); name = m[2]; }
    else if ((m = seg.match(/^(.*?)\s*(?:x|×|qty|quantity)\s*(\d+)$/)) && m[1]) { qty = Number(m[2]); name = m[1]; }
    else if ((m = seg.match(/^(.*?)\s+(\d+)\s*(?:pcs|pieces|bags?|cartons?|boxes?|units?|packs?)$/)) && m[1]) { qty = Number(m[2]); name = m[1]; }
    name = name.replace(/^(of|the)\s+/, "").replace(/^(bags?|cartons?|boxes?|packs?|pieces|pcs|units?|tins?|crates?|dozens?|rolls?|sacks?)\s+(of\s+)?/, "").trim();
    if (name.length >= 2 && qty > 0 && qty < 1e6) out.push({ qty, name, ...(price != null ? { price } : {}) });
  }
  return out;
}

function payIn(t: string): { method: string; amount?: number } | "later" | undefined {
  const s = ` ${norm(t)} `;
  if (/ (on credit|credit|not paid|unpaid|pay later|will pay|owing|owes|later|no payment|not yet|nothing paid) /.test(s)) return "later";
  const method = / (momo|mobile money|mtn|vodafone|telecel|airteltigo|at money) /.test(s) ? "MOBILE_MONEY" : / (bank|transfer|cheque|check|card|pos) /.test(s) ? "BANK" : / (cash|paid|full) /.test(s) ? "CASH" : null;
  if (!method) return undefined;
  const m = s.match(/ paid (\d+(?:\.\d+)?) /);
  return { method, ...(m ? { amount: Number(m[1]) } : {}) };
}

// ------------------------------------------------------------------------------------------------ the brain
export class Brain {
  messages: Msg[] = [];
  draft: Saved["draft"] = null;
  private smartOn: boolean | null = null;
  private waiting: { toolUseId: string; draftId: string; results: Block[] } | null = null;
  private drafts = new Map<string, { d: A.Draft; view: A.View; toolUseId?: string }>();

  constructor(readonly mode: Mode, readonly host: Host) {}

  restore(s: Partial<Saved>) { this.messages = s.messages ?? []; this.draft = s.draft ?? null; }
  snapshot(): Pick<Saved, "messages" | "draft"> { return { messages: this.messages, draft: this.draft }; }
  reset() { this.messages = []; this.draft = null; this.waiting = null; this.drafts.clear(); }
  view(id: string) { return this.drafts.get(id)?.view ?? null; }
  kindOf(id: string) { return this.drafts.get(id)?.d.kind ?? null; }

  greeting(): Item[] {
    if (this.mode === "site") return [botSay("Hi! I'm the WHOLESTRA assistant. I can show you around, answer questions, or open the demo for you.", { chips: [say("Show me around"), say("What is WHOLESTRA?"), { label: "Try the demo", run: { do: "demo" } }, say("Pricing"), say("Talk to a person")] })];
    const u = getSessionUser();
    if (u?.demo) return [botSay(`Welcome to the demo${u.organization ? ` of ${u.organization}` : ""}! I can show you around, explain any screen, and show how I record sales or orders for you (the demo does not save changes).`, { chips: this.menu() })];
    return [botSay(`Hi ${firstName() || "there"}! I can show you around, answer questions about your business, and do tasks for you: record a sale, order from a supplier, log an expense or add a customer. Just tell me.`, { chips: this.menu() })];
  }
  menu(): Chip[] {
    if (this.mode === "site") return [say("Show me around"), say("Features"), { label: "Try the demo", run: { do: "demo" } }, say("Talk to a person")];
    const c: Chip[] = [say("Show me around")];
    if (D.can("SALES:READ")) c.push(say("Today's sales", "sales today"));
    if (D.can("SALES:CREATE")) c.push(say("Record a sale"));
    if (D.can("PURCHASING:CREATE")) c.push(say("Order from a supplier", "create a purchase order"));
    if (D.can("INVENTORY:READ")) c.push(say("What's running low?", "show low stock"));
    if (D.can("EXPENSES:CREATE")) c.push(say("Log an expense", "record an expense"));
    return c;
  }

  /** Someone typed something (or pressed a chip that says something). */
  async send(text: string): Promise<void> {
    text = text.trim().slice(0, 1500); if (!text) return;
    this.host.push([{ id: newId(), from: "me", text, at: Date.now() }]);
    const t = norm(text);
    // a few things are always answered here, instantly
    if (CANCEL.test(t) && (this.draft || this.waiting)) return this.cancelAll();
    if (has(t, TOUR) && !this.draft) { this.host.push([botSay("Here's a quick tour. Use Next to move on, or press Esc to stop.")]); this.host.tour(); return; }
    if (await this.useSmart()) {
      try { return await this.smart(text); }
      catch (e) { console.warn("WHOLESTRA assistant: smart reply failed, using the built-in one", e); }
    }
    try { this.host.push(await this.builtIn(text)); }
    catch (e) { this.host.push([botSay(`Sorry, that did not work: ${D.errorText(e)}`)]); }
  }

  private async useSmart() {
    if (this.smartOn === null) {
      try {
        if (this.mode === "app") this.smartOn = (await D.me()).smart;
        else { const r = await fetch(`${API_URL}/assistant/options`); this.smartOn = r.ok ? !!(await r.json()).smart : false; }
      } catch { this.smartOn = false; }
    }
    return this.smartOn;
  }

  private cancelAll() {
    if (this.waiting) { const id = this.waiting.draftId; this.finishProposal(id, "cancelled"); return; }
    this.draft = null;
    this.host.push([botSay("Okay, cancelled. Nothing was saved.", { chips: this.menu() })]);
  }

  // ============================================================================================== built-in understanding
  async builtIn(text: string): Promise<Item[]> {
    const t = norm(text);
    if (this.draft) return this.continueDraft(text);
    if (GREET.test(t)) return this.greeting();
    if (THANKS.test(t)) return [botSay("You're welcome! Anything else?", { chips: this.menu() })];
    if (this.mode === "site") return this.siteReply(text);

    if (has(t, HELP)) return [botSay("Here is what I can do. Pick one or just type what you need, for example \"sell 10 cement to Kofi\" or \"sales this week\".", { chips: this.menu() })];
    const question = QUESTION.test(t);
    if (question && !has(t, REPORT) && !has(t, LOW) && !has(t, STOCKQ)) {
      const k = lookup(text, APP, (n) => !n || D.can(n)); if (k) return [botSay(k.a, { chips: k.chips })];
    }
    if (has(t, REPORT) || (/ (sales|sold|takings|revenue) /.test(` ${t} `) && dateRange(t) && !has(t, SALE))) return this.report(text);
    if (has(t, LOW)) return this.low(text);
    if (has(t, SALE)) return this.start({ kind: "sale", lines: [] }, text);
    if (has(t, PO)) return this.start({ kind: "po", lines: [] }, text);
    if (has(t, EXPENSE)) return this.start({ kind: "expense", date: A.today() }, text);
    if (has(t, CUSTOMER)) return this.start({ kind: "customer" }, text);
    if (has(t, ORDER_AMBIG)) return [botSay("Which kind of order?", { chips: [say("Order from a supplier (purchase order)", "create a purchase order"), say("A sale to a customer", "record a sale")] })];
    if (has(t, STOCKQ)) return this.stockOf(text);
    const page = pageFor(t, APP_PAGES);
    if (page && (NAV.test(t) || norm(page.keys[0]) === t || page.keys.includes(t))) {
      if (page.need && !D.can(page.need)) return [botSay(`Your role cannot open ${page.label}. Ask the owner or an administrator if you need it.`)];
      this.host.go(page.path); return [botSay(`Opening ${page.label}.`)];
    }
    const k = lookup(text, APP, (n) => !n || D.can(n));
    if (k) return [botSay(k.a, { chips: k.chips })];
    if (page) { this.host.go(page.path); return [botSay(`Opening ${page.label}.`)]; }
    // a product name on its own: show its stock
    if (D.can("PRODUCTS:READ") && t.split(" ").length <= 4) { const p = await D.findProducts(text); if (p.length === 1) return this.stockOf(text); }
    return [botSay("I'm not sure I understood. You can ask me things like:\n• \"sales today\" or \"sales last week at Tema\"\n• \"sell 10 cement 50kg to Kofi, paid cash\"\n• \"order 50 bags of rice from Olam\"\n• \"what is running low?\"\n• \"how do I transfer stock?\"", { chips: this.menu() })];
  }

  private siteReply(text: string): Item[] {
    const t = norm(text);
    if (/ (demo|try it|test it|see the app|look inside) /.test(` ${t} `) && !QUESTION.test(t)) { this.host.demo(); return [botSay("Opening the demo. Type your shop's name and it will look like yours.")]; }
    if (/ (install|download) /.test(` ${t} `) && !QUESTION.test(t)) { this.host.install(); return [botSay("Here's how to install WHOLESTRA on this device.")]; }
    const page = pageFor(t, SITE_PAGES);
    if (page && (NAV.test(t) || page.keys.includes(t))) { this.host.go(page.path); return [botSay(`Opening ${page.label}.`)]; }
    const k = lookup(text, SITE);
    if (k?.id === "contact") return [botSay(k.a, { card: { kind: "contact" }, chips: k.chips })];
    if (k) return [botSay(k.a, { chips: k.chips })];
    if (page) { this.host.go(page.path); return [botSay(`Opening ${page.label}.`)]; }
    return [botSay("I'm not sure about that one. I can tell you what WHOLESTRA does, show you around, open the demo, or put you in touch with our team.", { chips: this.menu() })];
  }

  // ---------------------------------------------------------------------------------------------- reports and lookups
  private async report(text: string): Promise<Item[]> {
    if (!D.can("SALES:READ")) return [botSay("Your role cannot see sales. Ask the owner or an administrator.")];
    const range = dateRange(text) ?? dateRange("today")!;
    const branch = mentioned(text, await D.branches(), (b) => b.name);
    const data = await D.salesReport(range.from, range.to, branch?.id);
    return [this.reportItem(data, range.label)];
  }
  reportItem(data: ReportData, label?: string): Item {
    const when = label ?? (data.from === data.to ? fmtDay(data.from) : `${fmtDay(data.from)} to ${fmtDay(data.to)}`);
    const where = data.branch ? ` at ${data.branch.name}` : "";
    const title = `Sales ${when === "today" || when === "yesterday" ? when : `for ${when}`}${where}`;
    const text = data.count
      ? `${title[0].toUpperCase()}${title.slice(1)}: ${data.count} sale${data.count === 1 ? "" : "s"} worth ${money(data.total, data.currency)}. ${money(data.paid, data.currency)} paid${data.owed > 0 ? `, ${money(data.owed, data.currency)} still owed` : ""}.`
      : `No sales recorded ${when === "today" || when === "yesterday" ? when : `for ${when}`}${where} yet.`;
    const chips: Chip[] = [say("Yesterday", "sales yesterday"), say("This week", "sales this week"), say("This month", "sales this month"), go("Open Sales", "/sales")];
    if (D.can("SALES:CREATE")) chips.splice(3, 0, say("Record a sale"));
    return botSay(text, { card: data.count ? { kind: "report", data, title } : undefined, chips });
  }

  private async low(text: string): Promise<Item[]> {
    if (!D.can("INVENTORY:READ")) return [botSay("Your role cannot see stock levels.")];
    const branch = mentioned(text, await D.branches(), (b) => b.name);
    const rows = (await D.lowStock(branch?.id)).sort((a, b) => a.quantity - b.quantity);
    const chips: Chip[] = [];
    if (D.can("PURCHASING:READ")) chips.push(go("Reorder suggestions", "/reorder"));
    if (D.can("PURCHASING:CREATE")) chips.push(say("Order from a supplier", "create a purchase order"));
    if (!rows.length) return [botSay(`Nothing is running low${branch ? ` at ${branch.name}` : ""}. Every product is above its reorder level.`, { chips })];
    return [botSay(`${rows.length} item${rows.length === 1 ? " is" : "s are"} at or below the reorder level${branch ? ` at ${branch.name}` : ""}.`, { card: this.lowCard(rows, branch?.name), chips })];
  }
  lowCard(rows: D.StockRow[], branch?: string): Card {
    return { kind: "list", title: `Running low${branch ? ` · ${branch}` : ""}`, more: Math.max(0, rows.length - 12), lines: rows.slice(0, 12).map((r) => ({ label: r.product.name, detail: `${r.branch.name} · reorder at ${r.product.reorderLevel}`, value: String(r.quantity), tone: r.quantity <= 0 ? "bad" : "warn" })) };
  }

  private async stockOf(text: string): Promise<Item[]> {
    if (!D.can("INVENTORY:READ") && !D.can("PRODUCTS:READ")) return [botSay("Your role cannot see stock levels.")];
    const branches = await D.branches();
    const branch = mentioned(text, branches, (b) => b.name);
    let q = norm(text).replace(/\b(how many|how much stock|how much|stock of|stock for|in stock|do we have|do i have|have we got|is there any|are there any|quantity of|qty of|available|left in|left|check stock|stock level|stock check|stock|remaining|of|do|we|have|there|any|the|is|are|at|in|branch)\b/g, " ");
    if (branch) q = q.replace(norm(branch.name), " ");
    q = q.trim();
    if (!q) return this.low(text);
    const found = await D.findProducts(q);
    if (!found.length) return [botSay(`I couldn't find a product like "${q}". Check the name or open Products.`, { chips: [go("Open Products", "/products")] })];
    if (found.length > 1) return [botSay("Which product do you mean?", { chips: found.slice(0, 6).map((p) => say(p.name, `stock of ${p.name}`)) })];
    const p = found[0];
    if (!D.can("INVENTORY:READ")) return [botSay(`${p.name}: ${p.stockQuantity} in stock in total (reorder at ${p.reorderLevel}).`)];
    const rows = (await D.stock(branch?.id)).filter((r) => r.productId === p.id || r.product.id === p.id);
    const cur = await D.currency();
    const total = rows.reduce((s, r) => s + r.quantity, 0);
    const lines: Line[] = rows.map((r) => ({ label: r.branch.name, value: String(r.quantity), tone: r.quantity <= 0 ? "bad" : r.quantity <= p.reorderLevel ? "warn" : "ok" }));
    return [botSay(`${p.name}: ${total} in stock${branch ? ` at ${branch.name}` : rows.length > 1 ? ` across ${rows.length} branches` : ""}. Sells at ${money(p.unitPrice, cur)}.`, { card: { kind: "list", title: `${p.name} · stock`, lines, empty: "No stock recorded in any branch yet." }, chips: D.can("SALES:CREATE") ? [say(`Sell ${p.name}`, `record a sale of 1 ${p.name}`)] : [] })];
  }

  // ---------------------------------------------------------------------------------------------- doing things, step by step
  private async start(d: A.Draft, text: string): Promise<Item[]> {
    if (!D.can(A.NEED[d.kind]) && !D.isDemo()) return [botSay(`Your role cannot ${d.kind === "sale" ? "record sales" : d.kind === "po" ? "create purchase orders" : d.kind === "expense" ? "record expenses" : "add customers"}. Ask the owner or an administrator to give your role that permission.`)];
    this.draft = { d };
    const notes = await this.fill(d, text, true);
    return this.next(notes);
  }

  private async continueDraft(text: string): Promise<Item[]> {
    const t = norm(text);
    if (CANCEL.test(t)) { this.draft = null; return [botSay("Okay, cancelled. Nothing was saved.", { chips: this.menu() })]; }
    const notes = await this.fill(this.draft!.d, text, false, this.draft!.asking);
    return this.next(notes);
  }

  /** Reads whatever it can from the message into the draft. Returns remarks (things it could not match). */
  private async fill(d: A.Draft, text: string, first: boolean, asking?: string): Promise<string[]> {
    const notes: string[] = [];
    const t = norm(text);
    const branches = await D.branches();
    const b = mentioned(text, branches, (x) => x.name) ?? (asking === "branch" ? best(text, branches, (x) => x.name)[0] : undefined);
    if (b && d.kind !== "customer") d.branchId = b.id;

    if (d.kind === "sale" || d.kind === "po") {
      if (first || asking === "items" || asking?.startsWith("pick:")) {
        if (asking?.startsWith("pick:")) {
          // they chose one of several similar products
          const [, idx] = asking.split(":"); const all = await D.products();
          const p = all.find((x) => norm(x.name) === t) ?? best(text, all, (x) => x.name)[0];
          const want = this.draft?.choices ? JSON.parse(this.draft.choices) as { qty: number; price?: number } : { qty: 1 };
          if (p) this.addLine(d, p, want.qty, want.price); else notes.push(`I couldn't find "${text}".`);
          void idx;
        } else {
          const all = await D.products();
          let picking = false;
          for (const pc of pieces(text)) {
            const hits = best(pc.name, all, (x) => x.name, (x) => [x.sku]);
            if (hits.length === 1) this.addLine(d, hits[0], pc.qty, pc.price);
            else if (hits.length > 1 && !picking) { picking = true; this.draft!.choices = JSON.stringify({ qty: pc.qty, price: pc.price, options: hits.slice(0, 6).map((h) => h.name) }); notes.push(`__pick__${pc.name}`); }
            else if (hits.length > 1) notes.push(`I also need to know which "${pc.name}" you mean; add it after this one.`);
            else if (!first || pc.qty > 1 || /\d/.test(text)) notes.push(`I couldn't find a product like "${pc.name}".`);
          }
        }
      }
    }
    if (d.kind === "sale") {
      const custs = await D.customers();
      if (asking === "customer") {
        if (/ (walk in|walkin|walk-in|none|no|skip|cash customer|anonymous|nobody|no one|no customer) /.test(` ${t} `)) d.customerId = null;
        else { const c = best(text, custs, (x) => x.name, (x) => [x.code, x.phone ?? ""]); if (c.length === 1) d.customerId = c[0].id; else if (c.length > 1) notes.push(`__cust__${JSON.stringify(c.slice(0, 6).map((x) => x.name))}`); else notes.push(`I couldn't find a customer called "${text}". Pick one, choose Walk-in, or add them first.`); }
      } else { const c = mentioned(text, custs, (x) => x.name); if (c) d.customerId = c.id; else if (/ (walk in|walkin|walk-in) /.test(` ${t} `)) d.customerId = null; }
      if (asking === "payment") { const p = payIn(`${text} paid`); if (p) d.pay = p; }
      else if (/ (paid|cash|momo|mobile money|bank|on credit|unpaid|pay later|owing|not paid) /.test(` ${t} `)) { const p = payIn(text); if (p) d.pay = p; }
    }
    if (d.kind === "po") {
      const sups = await D.suppliers();
      if (asking === "supplier") { const s = best(text, sups, (x) => x.name, (x) => [x.code]); if (s.length === 1) d.supplierId = s[0].id; else if (s.length > 1) notes.push(`__sup__${JSON.stringify(s.slice(0, 6).map((x) => x.name))}`); else notes.push(`I couldn't find a supplier called "${text}".`); }
      else { const s = mentioned(text, sups, (x) => x.name) ?? (/ from ([a-z0-9 &.-]+)/.exec(` ${t} `)?.[1] ? best(/ from ([a-z0-9 &.-]+)/.exec(` ${t} `)![1], sups, (x) => x.name)[0] : undefined); if (s) d.supplierId = s.id; }
      const r = dateRange(text); if (r && / (by|expected|deliver|delivery|arrive) /.test(` ${t} `)) d.expectedDate = r.from;
    }
    if (d.kind === "expense") {
      const cats = await D.categories();
      if (asking === "amount" || (first && !d.amount)) { const a = amountIn(text.replace(/\b\d{4}-\d{2}-\d{2}\b/, "")); if (a && a > 0) d.amount = a; else if (asking === "amount") notes.push("Please type the amount as a number, for example 250."); }
      if (asking === "category") { const c = best(text, cats, (x) => x.name); if (c.length >= 1) d.categoryId = c[0].id; else notes.push(`"${text}" is not one of the categories. Pick one below.`); }
      else if (!d.categoryId) { const c = mentioned(text, cats, (x) => x.name) ?? words4(text).map((w) => best(w, cats, (x) => x.name, () => [], 0.8)[0]).find(Boolean); if (c) d.categoryId = c.id; }
      if (asking === "description") d.description = text.slice(0, 300);
      else if (first) {
        const desc = text.replace(/^(please |kindly )?(record|add|log|enter|new|create|capture)( an| a| the| new)? (expense|expenditure|cost)( of| for)?/i, "").replace(/(gh₵|ghc|ghs|cedis?)?\s*\d[\d,]*(\.\d+)?\s*(k|cedis?|ghs)?/i, "").replace(/\b(today|yesterday|at [a-z]+ branch)\b/gi, "").replace(/^\s*(on|for|of)\s+/i, "").trim();
        if (desc.length >= 3) d.description = desc.slice(0, 300);
      }
      const r = dateRange(text); if (r) d.date = r.from;
    }
    if (d.kind === "customer") {
      const ph = text.match(PHONE)?.[1]; const em = text.match(EMAIL)?.[1];
      if (em) d.email = em; if (ph) d.phone = ph.replace(/\s+/g, " ").trim();
      if (asking === "phone" && !ph) { if (/ (skip|no|none|later|don t have|dont have|not now) /.test(` ${t} `)) d.phone = ""; else notes.push("That doesn't look like a phone number. Type it, or press Skip."); }
      if (asking === "name" || first) {
        const name = text.replace(EMAIL, "").replace(PHONE, "").replace(/^(please |kindly )?(add|create|new|register|save|record)( a| an| the| new)? (customer|client|buyer)( called| named| name)?:?/i, "").replace(/\b(phone|tel|number|email|mobile)\b.*$/i, "").replace(/[,;]+$/, "").trim();
        if (name.length >= 2) d.name = name.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 160);
      }
    }
    return notes;
  }

  private addLine(d: A.Draft, p: D.Product, qty: number, price?: number) {
    if (d.kind === "sale") { const ex = d.lines.find((l) => l.productId === p.id); if (ex) ex.quantity += qty; else d.lines.push({ productId: p.id, name: p.name, quantity: qty, price: price ?? p.unitPrice }); }
    if (d.kind === "po") { const ex = d.lines.find((l) => l.productId === p.id); if (ex) ex.quantity += qty; else d.lines.push({ productId: p.id, name: p.name, quantity: qty, cost: price ?? p.costPrice ?? p.unitPrice }); }
  }

  /** Asks for the next missing detail, or shows the card to confirm. */
  private async next(notes: string[]): Promise<Item[]> {
    const st = this.draft!; const d = st.d; const out: Item[] = [];
    const remarks = notes.filter((n) => !n.startsWith("__"));
    const pick = notes.find((n) => n.startsWith("__pick__"));
    const custPick = notes.find((n) => n.startsWith("__cust__"));
    const supPick = notes.find((n) => n.startsWith("__sup__"));
    if (remarks.length) out.push(botSay(remarks.join(" ")));
    if (pick) {
      st.asking = "pick:0";
      const opts = (JSON.parse(st.choices ?? "{}").options ?? []) as string[];
      out.push(botSay(`Which "${pick.slice(8)}" do you mean?`, { chips: opts.map((o) => say(o)) }));
      return out;
    }
    if (custPick) { st.asking = "customer"; out.push(botSay("Which customer?", { chips: [...(JSON.parse(custPick.slice(8)) as string[]).map((n) => say(n)), say("Walk-in customer", "walk-in")] })); return out; }
    if (supPick) { st.asking = "supplier"; out.push(botSay("Which supplier?", { chips: (JSON.parse(supPick.slice(7)) as string[]).map((n) => say(n)) })); return out; }

    // fill sensible defaults before asking
    if (d.kind !== "customer" && !d.branchId) { const b = await A_default(); if (b) d.branchId = b.id; }
    const gap = A.missing(d);
    st.asking = gap ?? undefined; st.choices = undefined;
    if (!gap) return [...out, ...(await this.propose(d))];
    const cur = await D.currency();
    const lines = "lines" in d && d.lines.length ? `So far: ${d.lines.map((l) => `${l.quantity} × ${l.name}`).join(", ")}. ` : "";
    switch (gap) {
      case "items": {
        const top = (await D.products()).slice(0, 4);
        out.push(botSay(`${lines}What ${d.kind === "sale" ? "did you sell" : "do you want to order"}? Type the quantity and product, for example "10 ${top[0]?.name ?? "Cement 50kg"}${top[1] ? `, 5 ${top[1].name}` : ""}".`, { chips: top.map((p) => say(`1 × ${p.name}`, `1 ${p.name}`)) }));
        break;
      }
      case "branch": {
        const [list, m] = await Promise.all([D.branches(), D.me().catch(() => null)]);
        const sorted = [...list].sort((a, b) => Number(b.id === m?.homeBranchId) - Number(a.id === m?.homeBranchId));
        out.push(botSay(`${lines}Which branch ${d.kind === "sale" ? "was it sold from" : d.kind === "po" ? "should receive the goods" : "is it for"}?`, { chips: sorted.slice(0, 8).map((b) => say(b.name)) })); break;
      }
      case "customer": {
        const custs = (await D.customers()).slice(0, 5);
        out.push(botSay(`${lines}Who bought it?`, { chips: [say("Walk-in customer", "walk-in"), ...custs.map((c) => say(c.name))] })); break;
      }
      case "payment": {
        const total = d.kind === "sale" ? d.lines.reduce((s, l) => s + l.quantity * l.price, 0) : 0;
        out.push(botSay(`Total ${money(total, cur)}. Was it paid?`, { chips: [say("Paid in cash", "cash"), say("Mobile money", "momo"), say("Bank", "bank"), say("Not yet (owed)", "not paid")] })); break;
      }
      case "supplier": {
        const sups = (await D.suppliers()).slice(0, 6);
        if (!sups.length) { this.draft = null; out.push(botSay("You have no suppliers yet. Add one first, then I can create the order.", { chips: [go("Add a supplier", "/suppliers?new=1")] })); break; }
        out.push(botSay("Which supplier is it from?", { chips: sups.map((s) => say(s.name)) })); break;
      }
      case "amount": out.push(botSay("How much was it?")); break;
      case "category": {
        const cats = await D.categories();
        out.push(botSay("Which category?", { chips: cats.slice(0, 8).map((c) => say(c.name)) })); break;
      }
      case "description": out.push(botSay("What was it for? (a few words)")); break;
      case "name": out.push(botSay("What is the customer's name?")); break;
      case "phone": out.push(botSay(`Phone number for ${(d as A.CustomerDraft).name}?`, { chips: [say("Skip", "skip")] })); break;
    }
    return out;
  }

  /** Shows the card to confirm. */
  private async propose(d: A.Draft, toolUseId?: string): Promise<Item[]> {
    this.draft = null;
    const id = newId("d");
    const view = await A.describe(d);
    this.drafts.set(id, { d, view, toolUseId });
    const demo = D.isDemo();
    return [botSay(demo ? "Here's how it would look. The demo can't save changes, but in your own account pressing Confirm saves it." : "Please check and confirm.", { card: { kind: "confirm", id, state: "waiting", view, form: A.FORM[d.kind], demo } })];
  }

  /** The person pressed Confirm (or Cancel) on a card. */
  async decide(id: string, ok: boolean) {
    const entry = this.drafts.get(id); if (!entry) return;
    if (!ok) return this.finishProposal(id, "cancelled");
    if (D.isDemo()) { this.host.patch(id, { kind: "confirm", id, state: "cancelled" }); return; }
    this.host.patch(id, { kind: "confirm", id, state: "saving" });
    try {
      const r = await A.execute(entry.d);
      this.host.patch(id, { kind: "confirm", id, state: "done" });
      const chips: Chip[] = [{ label: "Show it", run: { do: "go", path: r.path } }];
      if (entry.d.kind === "sale") chips.push(say("Record another sale", "record a sale"), say("Today's sales", "sales today"));
      if (entry.d.kind === "po") chips.push(say("Another order", "create a purchase order"));
      if (entry.toolUseId && this.waiting?.draftId === id) await this.resume(id, `Saved. ${r.text}`, false);
      else this.host.push([botSay(`Done ✓ ${r.text}`, { chips })]);
    } catch (e) {
      const msg = D.errorText(e);
      this.host.patch(id, { kind: "confirm", id, state: "failed", error: msg });
      if (entry.toolUseId && this.waiting?.draftId === id) await this.resume(id, `Not saved. The server said: ${msg}`, true);
      else this.host.push([botSay(`It was not saved: ${msg}`, { chips: [{ label: "Open the full form", run: { do: "go", path: A.FORM[entry.d.kind] } }] })]);
    }
  }

  private finishProposal(id: string, state: "cancelled") {
    this.host.patch(id, { kind: "confirm", id, state });
    if (this.waiting?.draftId === id) { void this.resume(id, "The person pressed Cancel. Nothing was saved.", false); return; }
    this.host.push([botSay("Okay, I didn't save it.", { chips: this.menu() })]);
  }

  // ============================================================================================== smart replies (Claude)
  private async call(): Promise<{ content: Block[]; stop_reason: string }> {
    const body = { messages: this.messages, page: typeof window !== "undefined" ? window.location.pathname : "/" };
    if (this.mode === "app") return api.post("/assistant/app", body);
    const r = await fetch(`${API_URL}/assistant/site`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(data?.message ?? "unavailable", r.status);
    return data;
  }

  private trim() {
    // keep the conversation small: drop the oldest exchanges (always starting at a plain question)
    while (JSON.stringify(this.messages).length > 60_000) {
      const next = this.messages.findIndex((m, i) => i > 0 && m.role === "user" && typeof m.content === "string");
      if (next <= 0) { this.messages = this.messages.slice(-1); break; }
      this.messages = this.messages.slice(next);
    }
  }

  private async smart(text: string) {
    if (this.waiting) {
      // they wrote instead of pressing Confirm: the card no longer counts
      const w = this.waiting; this.waiting = null;
      this.host.patch(w.draftId, { kind: "confirm", id: w.draftId, state: "cancelled" });
      this.messages.push({ role: "user", content: [...w.results, { type: "tool_result", tool_use_id: w.toolUseId, content: "Not confirmed: the person wrote a new message instead. Nothing was saved." }, { type: "text", text }] });
    } else this.messages.push({ role: "user", content: text });
    this.trim();
    const before = this.messages.length;
    try { await this.loop(); }
    catch (e) {
      // fall back to the built-in brain for this message, and forget the half-finished turn
      this.messages = this.messages.slice(0, before - 1);
      // switched off on the server: stop asking for the rest of this visit (a passing failure only affects this message)
      if (e instanceof ApiError && (e.status === 404 || (e.status === 503 && /not switched on/.test(e.message)))) this.smartOn = false;
      if (e instanceof ApiError && e.status === 429) { this.host.push([botSay(e.message)]); return; }
      throw e;
    }
  }

  private async loop(rounds = 0): Promise<void> {
    if (rounds > 6) { this.host.push([botSay("That took too many steps. Could you say it another way?")]); return; }
    const res = await this.call();
    this.messages.push({ role: "assistant", content: res.content });
    const texts = res.content.filter((b): b is Extract<Block, { type: "text" }> => b.type === "text").map((b) => b.text.trim()).filter(Boolean);
    if (texts.length) this.host.push([botSay(texts.join("\n\n"))]);
    const uses = res.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
    if (!uses.length) return;
    const results: Block[] = [];
    // read tools first, then at most one card to confirm
    const proposals = uses.filter((u) => u.name.startsWith("propose_"));
    for (const u of uses.filter((x) => !x.name.startsWith("propose_"))) results.push(await this.runTool(u));
    for (const extra of proposals.slice(1)) results.push({ type: "tool_result", tool_use_id: extra.id, content: "Only one change can be confirmed at a time. Propose this again after the first is done.", is_error: true });
    if (proposals[0]) {
      const p = proposals[0];
      try {
        const d = await this.buildDraft(p.name, p.input);
        const items = await this.propose(d, p.id);
        const draftId = (items[0].card as { id: string }).id;
        this.host.push(items);
        if (D.isDemo()) results.push({ type: "tool_result", tool_use_id: p.id, content: "Shown to the person as a preview card. This is the read-only demo, so it cannot be saved; invite them to create their own account to do it for real." });
        else { this.waiting = { toolUseId: p.id, draftId, results }; return; } // wait for Confirm / Cancel
      } catch (e) { results.push({ type: "tool_result", tool_use_id: p.id, content: (e as Error).message, is_error: true }); }
    }
    this.messages.push({ role: "user", content: results });
    return this.loop(rounds + 1);
  }

  private async resume(draftId: string, outcome: string, isError: boolean) {
    const w = this.waiting; if (!w || w.draftId !== draftId) return;
    this.waiting = null;
    this.messages.push({ role: "user", content: [...w.results, { type: "tool_result", tool_use_id: w.toolUseId, content: outcome, ...(isError ? { is_error: true } : {}) }] });
    try { await this.loop(); }
    catch { this.host.push([botSay(outcome.startsWith("Saved") ? `Done ✓ ${outcome.slice(7)}` : outcome)]); }
  }

  private async runTool(u: Extract<Block, { type: "tool_use" }>): Promise<Block> {
    const ok = (v: unknown): Block => ({ type: "tool_result", tool_use_id: u.id, content: typeof v === "string" ? v : JSON.stringify(v).slice(0, 11000) });
    const bad = (m: string): Block => ({ type: "tool_result", tool_use_id: u.id, content: m, is_error: true });
    const i = u.input as Record<string, string | undefined>;
    try {
      switch (u.name) {
        case "go_to_page": this.host.go(String(i.path)); return ok(`Opened ${i.path}.`);
        case "start_tour": this.host.tour(); return ok("The tour is now showing on screen.");
        case "start_demo": this.host.demo(); return ok("The demo window is open; the visitor types their shop name there.");
        case "show_contact": this.host.push([botSay("", { card: { kind: "contact" } })]); return ok("Contact details are shown to the visitor.");
        case "find_products": {
          const cur = await D.currency(); const list = await D.findProducts(String(i.query ?? ""));
          return ok({ count: list.length, currency: cur, products: list.slice(0, 15).map((p) => ({ id: p.id, name: p.name, sku: p.sku, price: p.unitPrice, ...(p.costPrice != null ? { cost: p.costPrice } : {}), stock_total: p.stockQuantity, reorder_level: p.reorderLevel })) });
        }
        case "stock_levels": {
          const rows = (await D.stock(i.branch_id || undefined)).filter((r) => !i.product_id || r.productId === i.product_id || r.product.id === i.product_id);
          const lines: Line[] = rows.slice(0, 12).map((r) => ({ label: i.product_id ? r.branch.name : `${r.product.name}`, detail: i.product_id ? undefined : r.branch.name, value: String(r.quantity), tone: r.quantity <= 0 ? "bad" : r.quantity <= r.product.reorderLevel ? "warn" : "ok" }));
          if (rows.length) this.host.push([botSay("", { card: { kind: "list", title: i.product_id ? `${rows[0].product.name} · stock` : "Stock levels", lines, more: Math.max(0, rows.length - 12) } })]);
          return ok({ shown_to_person_as_card: rows.length > 0, rows: rows.slice(0, 40).map((r) => ({ product: r.product.name, product_id: r.productId, branch: r.branch.name, branch_id: r.branch.id, quantity: r.quantity, reorder_level: r.product.reorderLevel })) });
        }
        case "low_stock": {
          const rows = (await D.lowStock(i.branch_id || undefined)).sort((a, b) => a.quantity - b.quantity);
          if (rows.length) this.host.push([botSay("", { card: this.lowCard(rows) })]);
          return ok({ shown_to_person_as_card: rows.length > 0, count: rows.length, rows: rows.slice(0, 40).map((r) => ({ product: r.product.name, product_id: r.productId, branch: r.branch.name, branch_id: r.branch.id, quantity: r.quantity, reorder_level: r.product.reorderLevel })) });
        }
        case "list_branches": { const [m, list] = await Promise.all([D.me(), D.branches()]); return ok({ branches: list, home_branch_id: m.homeBranchId }); }
        case "find_customers": { const list = await D.findCustomers(String(i.query ?? "")); return ok({ count: list.length, customers: list.slice(0, 15).map((c) => ({ id: c.id, name: c.name, code: c.code, phone: c.phone })) }); }
        case "find_suppliers": { const list = await D.findSuppliers(String(i.query ?? "")); return ok({ count: list.length, suppliers: list.slice(0, 15).map((s) => ({ id: s.id, name: s.name, code: s.code })) }); }
        case "list_expense_categories": return ok({ categories: await D.categories() });
        case "sales_report": {
          const data = await D.salesReport(String(i.from), String(i.to ?? i.from), i.branch_id || undefined);
          const item = this.reportItem(data); item.text = ""; item.chips = undefined;
          if (data.count) this.host.push([item]);
          return ok({ shown_to_person_as_card: data.count > 0, ...data });
        }
        default: return bad(`Unknown tool ${u.name}.`);
      }
    } catch (e) { return bad(D.errorText(e)); }
  }

  /** Turns Claude's proposal into a checked draft (real ids, prices filled in), or explains what is wrong. */
  private async buildDraft(name: string, input: Record<string, unknown>): Promise<A.Draft> {
    const branches = await D.branches();
    const branchOk = (id: unknown) => { if (!branches.some((b) => b.id === id)) throw new Error("Unknown branch_id. Use list_branches and pass one of those ids."); return String(id); };
    const items = (Array.isArray(input.items) ? input.items : []) as Record<string, unknown>[];
    if (name === "propose_sale" || name === "propose_purchase_order") {
      if (!items.length) throw new Error("items is empty.");
      const all = await D.products();
      const lines = items.map((it) => {
        const p = all.find((x) => x.id === it.product_id); if (!p) throw new Error(`Unknown product_id ${String(it.product_id)}. Use find_products first.`);
        const qty = Math.round(Number(it.quantity)); if (!(qty > 0)) throw new Error(`Quantity for ${p.name} must be 1 or more.`);
        return { p, qty, price: it.unit_price != null ? Number(it.unit_price) : it.unit_cost != null ? Number(it.unit_cost) : undefined };
      });
      if (name === "propose_sale") {
        const custs = await D.customers();
        if (input.customer_id && !custs.some((c) => c.id === input.customer_id)) throw new Error("Unknown customer_id. Use find_customers, or leave it out for a walk-in customer.");
        const method = input.payment_method ? String(input.payment_method) : null;
        return { kind: "sale", branchId: branchOk(input.branch_id), customerId: (input.customer_id as string) || null, lines: lines.map((l) => ({ productId: l.p.id, name: l.p.name, quantity: l.qty, price: l.price ?? l.p.unitPrice })), pay: !method || method === "CREDIT" ? "later" : { method, ...(input.payment_amount != null ? { amount: Number(input.payment_amount) } : {}) } };
      }
      const sups = await D.suppliers();
      if (!sups.some((s) => s.id === input.supplier_id)) throw new Error("Unknown supplier_id. Use find_suppliers first.");
      return { kind: "po", supplierId: String(input.supplier_id), branchId: branchOk(input.branch_id), lines: lines.map((l) => ({ productId: l.p.id, name: l.p.name, quantity: l.qty, cost: l.price ?? l.p.costPrice ?? l.p.unitPrice })), ...(input.expected_date ? { expectedDate: String(input.expected_date) } : {}), ...(input.notes ? { notes: String(input.notes).slice(0, 500) } : {}) };
    }
    if (name === "propose_expense") {
      const cats = await D.categories();
      if (!cats.some((c) => c.id === input.category_id)) throw new Error("Unknown category_id. Use list_expense_categories first.");
      const amount = Number(input.amount); if (!(amount > 0)) throw new Error("amount must be more than 0.");
      return { kind: "expense", branchId: branchOk(input.branch_id), categoryId: String(input.category_id), amount, description: String(input.description ?? "").slice(0, 300) || "Expense", date: /^\d{4}-\d{2}-\d{2}$/.test(String(input.date ?? "")) ? String(input.date) : A.today() };
    }
    if (name === "propose_customer") {
      const n = String(input.name ?? "").trim(); if (n.length < 2) throw new Error("name is too short.");
      return { kind: "customer", name: n.slice(0, 160), phone: input.phone ? String(input.phone) : "", ...(input.email ? { email: String(input.email) } : {}), ...(input.address ? { address: String(input.address) } : {}) };
    }
    throw new Error(`Unknown tool ${name}.`);
  }
}

const words4 = (t: string) => norm(t).split(" ").filter((w) => w.length >= 4);
const A_default = () => D.defaultBranch();
