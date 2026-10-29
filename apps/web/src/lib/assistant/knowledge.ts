/** What the assistant knows without asking anyone: short answers for the website and step-by-step help inside the app. */
import { Chip, norm } from "./core";

export type Entry = { id: string; keys: string[]; a: string; chips?: Chip[]; need?: string };

const go = (label: string, path: string): Chip => ({ label, run: { do: "go", path } });
const say = (label: string, text = label): Chip => ({ label, say: text });

// ------------------------------------------------------------------------------------------------ the public website
export const SITE: Entry[] = [
  { id: "what", keys: ["what is wholestra", "what is this", "what do you do", "what does it do", "about wholestra", "explain", "tell me about", "who are you", "what is it"],
    a: "WHOLESTRA runs a wholesale business with one or more branches in one place: stock in every branch, sales and invoices, purchasing, expenses and money owed. Owners see everything, and each branch manager sees only their own branch.",
    chips: [go("See the features", "/features"), { label: "Try the demo", run: { do: "demo" } }, say("Show me around")] },
  { id: "features", keys: ["features", "what can it do", "modules", "functions", "capabilities", "what can i do", "inventory", "stock", "sales", "purchase", "expenses", "reports"],
    a: "The main parts:\n• Stock for every branch, with pictures, low-stock alerts and transfers between branches\n• Sales, invoices, payments, returns and money owed\n• Purchase orders and goods received\n• Expenses with approval limits, deposits and branch closings\n• Excel import of weekly sales\n• A sealed change log and profit insights",
    chips: [go("Open Features", "/features"), { label: "Try the demo", run: { do: "demo" } }] },
  { id: "price", keys: ["price", "pricing", "cost", "how much", "subscription", "plan", "plans", "fee", "fees", "charge", "pay for", "free", "trial"],
    a: "No payment is taken inside the app. For plans and pricing for your company, talk to our team and we will reply within one working day. You can try the demo for free right now.",
    chips: [{ label: "Contact the team", run: { do: "go", path: "/contact" } }, { label: "Try the demo", run: { do: "demo" } }] },
  { id: "signup", keys: ["sign up", "signup", "create account", "create an account", "register", "get started", "open account", "new account", "join"],
    a: "Choose Get started. Sign up with your email (we send a 6-digit code to confirm it) or with Google, Facebook or LinkedIn. Then fill in your company profile and you are ready.",
    chips: [go("Get started", "/get-started")] },
  { id: "signin", keys: ["sign in", "log in", "login", "signin", "cant sign in", "can t sign in", "cannot sign in", "code not", "no code", "didn t get", "not receiving", "otp", "password", "forgot", "locked"],
    a: "To sign in, type your email, then the 6-digit code we email you, then your password. If the code does not arrive, check your spam folder or use your authenticator app instead. If it still fails, contact us on WhatsApp or by email.",
    chips: [go("Sign in", "/login"), { label: "Contact the team", run: { do: "go", path: "/contact" } }] },
  { id: "demo", keys: ["demo", "try", "test it", "sample", "trial", "see it", "see the app", "preview", "look inside"],
    a: "The demo opens a sample wholesale company with three branches, products, sales and purchase orders. It is read-only and needs no sign-up. You will be asked for your shop name so it feels like yours.",
    chips: [{ label: "Open the demo", run: { do: "demo" } }] },
  { id: "security", keys: ["secure", "safe", "security", "safety", "protect", "hack", "data", "privacy", "private", "who can see", "trust"],
    a: "Each company only ever sees its own records. Every sign-in starts with a code sent to the email, you can add Google Authenticator, branch staff see only their branch, and every change goes into a sealed change log that shows if anyone tampers with it.",
    chips: [go("Read about security", "/security"), go("Privacy notice", "/privacy")] },
  { id: "branches", keys: ["branch", "branches", "branch manager", "other branches", "many shops", "locations", "warehouses", "multiple"],
    a: "Add as many branches as you have. Stock, sales and expenses are kept per branch, goods move between branches with transfers, and a role can be limited to its own branch so a manager only sees theirs.",
    chips: [go("See the features", "/features")] },
  { id: "tracking", keys: ["barcode", "scan", "scanner", "track", "tracking", "lost goods", "missing", "label", "labels", "where is my", "goods missing", "stolen", "theft", "transfer short"],
    a: "Every handover is confirmed by scanning: goods arriving, goods sent to another branch, goods received there, and goods sold. If anything is typed by hand instead of scanned, or fewer items arrive than were sent, the branch is asked to explain and the owner decides. For costly goods, turn on \"Track each item\" on the product: every item gets its own label, so you can see where each one is and where it has been. Open Scan or Item Tracking in the Inventory menu.",
    chips: [go("Open Scan", "/scan"), go("Item tracking", "/tracking")] },
  { id: "install", keys: ["app", "install", "download", "android", "iphone", "ios", "play store", "app store", "phone", "mobile", "desktop", "computer", "laptop", "home screen"],
    a: "WHOLESTRA installs straight from this website, no app store needed. Press Install app at the top (on a phone, open the menu first). On iPhone: Safari, Share, then Add to Home Screen. It gets its own icon and opens like an app.",
    chips: [{ label: "Install the app", run: { do: "install" } }] },
  { id: "excel", keys: ["excel", "import", "spreadsheet", "csv", "xlsx", "upload sales", "bring my data", "existing records"],
    a: "Yes. Upload your weekly sales as .xlsx or .csv per branch and period. Products are matched by SKU, name or the names your staff use, and rows already imported are never counted twice." },
  { id: "refer", keys: ["refer", "referral", "earn", "commission", "reward", "30", "invite", "bonus"],
    a: "Introduce another business to WHOLESTRA. When it signs up with your link and our team confirms it, you earn up to US$30, usually paid by mobile money or bank transfer.",
    chips: [go("How refer & earn works", "/refer")] },
  { id: "contact", keys: ["contact", "talk to", "speak to", "call", "whatsapp", "email you", "support", "human", "agent", "help me", "reach", "phone number", "customer care"],
    a: "You can reach the WHOLESTRA team here:" },
  { id: "auth", keys: ["authenticator", "2fa", "two factor", "two step", "google authenticator", "qr code", "recovery code"],
    a: "After signing up you can turn on an authenticator app (Google or Microsoft Authenticator): scan the QR code, type one code, and keep your recovery codes. Then a password alone is never enough to get in." },
  { id: "offline", keys: ["offline", "no internet", "internet", "network", "data bundle", "slow"],
    a: "WHOLESTRA needs the internet so every branch sees the same, up-to-date numbers. It is light on data, and when the connection drops it tells you and carries on when it is back." },
  { id: "currency", keys: ["currency", "cedi", "cedis", "naira", "dollar", "ghs", "ngn", "kes", "country", "countries", "ghana", "nigeria", "kenya"],
    a: "Pick your country and currency in the company profile: cedi, naira, CFA franc, shilling, rand, dollar, euro, pound and more. Every amount then shows in your currency." },
  { id: "tax", keys: ["tax", "vat", "nhil", "accounting", "quickbooks", "accountant", "ledger", "payroll"],
    a: "Taxes, credit notes and links to accounting software are on the way but not built yet. Today WHOLESTRA covers stock, sales, purchasing, expenses and profit; your accountant can use the exports." },
  { id: "who", keys: ["who made", "who built", "company behind", "where are you", "located", "based"],
    a: "WHOLESTRA is built in Accra, Ghana, for wholesalers and distributors with more than one branch.", chips: [go("About us", "/about")] },
];

// ------------------------------------------------------------------------------------------------ inside the app
export const APP: Entry[] = [
  { id: "sale", keys: ["how do i sell", "how to sell", "how do i record a sale", "how to record a sale", "make an invoice", "create invoice", "new invoice", "how do i invoice", "record sales"], need: "SALES:CREATE",
    a: "To record a sale:\n1. Open Sales & Invoices and press + New sale\n2. Pick the branch and the customer (or leave it as walk-in)\n3. Add each product and quantity; the price fills in\n4. Record the payment if they paid now, then Save\nYou can print the invoice from the sale.",
    chips: [say("Do it for me", "record a sale"), go("Open New sale", "/sales?new=1")] },
  { id: "payment", keys: ["payment", "pay invoice", "customer paid", "record payment", "part payment", "balance", "owe", "owed", "debt", "debtors", "credit"], need: "SALES:READ",
    a: "To record money a customer paid: open Sales & Invoices, open the sale, and press Record payment (cash, bank, mobile money). What is still owed shows on the sale and on the customer.",
    chips: [go("Open Sales", "/sales"), go("Open Customers", "/customers")] },
  { id: "return", keys: ["return", "returned", "refund", "bring back", "send back"], need: "SALES:READ",
    a: "To take goods back: open the sale in Sales & Invoices and press Return. Pick the lines and quantities and give a reason. The stock goes back to the branch and profit is adjusted.",
    chips: [go("Open Sales", "/sales")] },
  { id: "product", keys: ["add product", "new product", "create product", "add item", "new item", "product picture", "price change", "change price", "edit product"], need: "PRODUCTS:READ",
    a: "To add a product: Products, then + New product. Give it a name, SKU, selling price, cost price, reorder level and (optional) a picture. To change a price, open the product and edit it; the change log keeps the old price.",
    chips: [go("Open Products", "/products"), go("New product", "/products?new=1")] },
  { id: "transfer", keys: ["transfer", "move stock", "move goods", "send goods", "send stock", "between branches", "other branch"], need: "STOCK_TRANSFERS:READ",
    a: "To move goods between branches: Stock Transfers, + New transfer, pick from and to branches and the items. It goes Draft, Approved, Sent, then the receiving branch marks it Received. Stock moves only when it is sent and received.",
    chips: [go("Open Stock Transfers", "/stock-transfers")] },
  { id: "adjust", keys: ["adjust", "adjustment", "damaged", "damage", "expired", "lost", "missing", "stolen", "found stock", "correct stock", "wrong stock"], need: "STOCK_ADJUSTMENTS:READ",
    a: "To correct stock (damaged, expired, lost or found): Stock Adjustments, + New adjustment, pick the branch and product, the amount up or down, and the reason. Stock can never go below zero.",
    chips: [go("Open Stock Adjustments", "/stock-adjustments")] },
  { id: "count", keys: ["count", "stock count", "stock taking", "stocktake", "physical count"], need: "STOCK_COUNTS:READ",
    a: "To count stock: Stock Counts, start a count for a branch, type what you find on the shelf, and finish it. Differences become adjustments and show up for review.",
    chips: [go("Open Stock Counts", "/stock-counts")] },
  { id: "po", keys: ["purchase order", "order from supplier", "order goods", "restock", "buy from", "receive goods", "goods received", "delivery arrived", "supplier order"], need: "PURCHASING:READ",
    a: "To order from a supplier: Purchase Orders, + New order, pick the supplier, branch and items. When the goods arrive, open the order and press Receive goods; you can receive part of it. Stock goes up when received.",
    chips: [say("Do it for me", "create a purchase order"), go("Open Purchase Orders", "/purchase-orders")] },
  { id: "reorder", keys: ["reorder", "what to buy", "what should i order", "running low", "low stock", "out of stock", "suggestion"], need: "PURCHASING:READ",
    a: "Reorder Suggestions looks at how fast each product sells in each branch and what is on hand and on order, and suggests quantities. Adjust them and it creates draft purchase orders per supplier.",
    chips: [say("What is running low?", "show low stock"), go("Open Reorder Suggestions", "/reorder")] },
  { id: "expense", keys: ["expense", "expenses", "spent", "spend", "fuel", "transport", "approval limit", "approve expense", "approve"], need: "EXPENSES:READ",
    a: "To record an expense: Finance, Expenses tab, + New expense: branch, category, amount, what it was for and the date. Expenses above a role's approval limit wait for the owner. Nobody can approve their own.",
    chips: [say("Do it for me", "record an expense"), go("Open Expenses", "/finance?tab=expenses")] },
  { id: "deposit", keys: ["deposit", "bank the money", "banked", "reconcile", "reconciliation", "closing", "close the day", "end of day", "cash up", "variance", "shortage"],
    a: "In Finance: Deposits records money taken to the bank or mobile money; Reconciliation compares sales, payments, expenses and deposits per branch; Branch closings lock a period; Variance cases follow up any shortage.",
    chips: [go("Open Finance", "/finance")] },
  { id: "excel", keys: ["excel", "import", "spreadsheet", "csv", "upload"], need: "EXCEL_IMPORT:READ",
    a: "Excel Import: pick the branch and the week, upload the .xlsx or .csv, check the preview and import. Products are matched by SKU, name or alias; unmatched ones wait in Review. Rows already imported are not counted twice.",
    chips: [go("Open Excel Import", "/imports")] },
  { id: "user", keys: ["add user", "new user", "add staff", "add employee", "invite", "give access", "reset password", "user account", "staff account"], need: "USERS:READ",
    a: "To add someone: Users, + New user, with their real email (their sign-in codes go there), role and branch. They choose their own password at first sign-in. Roles decide what they can see and do.",
    chips: [go("Open Users", "/users"), go("Open Roles", "/roles")] },
  { id: "role", keys: ["role", "roles", "permission", "permissions", "access", "limit to branch", "only their branch", "restrict"], need: "ROLES:READ",
    a: "In Roles, each role has permissions (read, create, approve…), an option to limit people to their own branch, and an expense approval limit. A change applies when the person signs in again.",
    chips: [go("Open Roles", "/roles")] },
  { id: "branch", keys: ["add branch", "new branch", "open branch", "branches", "region"], need: "BRANCHES:READ",
    a: "To add a branch: Branches, + New branch, with a name and code. Each branch gets its own stock, sales and expenses.",
    chips: [go("Open Branches", "/branches")] },
  { id: "audit", keys: ["audit", "change log", "who changed", "who deleted", "tamper", "fraud", "history", "sign in history", "log"], need: "AUDIT:READ",
    a: "Audit shows every change (who, when, before and after), every sign-in and sign-out, and fraud signals. The log is sealed: if anyone alters it, the status turns red.",
    chips: [go("Open Audit", "/audit")] },
  { id: "security", keys: ["authenticator", "2fa", "two factor", "security", "change email", "recovery code", "change password", "password"],
    a: "Sign-in and security (from your name at the top right) lets you turn on an authenticator app, make new recovery codes and change your email. To change your password, open My profile.",
    chips: [go("Open Sign-in & security", "/settings/security")] },
  { id: "invoice", keys: ["print", "invoice", "receipt", "logo", "branding", "pdf"],
    a: "Open a sale and press Print to print the invoice or save it as a PDF. Your logo, address and tax number come from Settings, Branding and Organization profile.",
    chips: [go("Open Branding", "/settings/branding")] },
  { id: "insights", keys: ["profit", "margin", "insight", "insights", "best seller", "slow", "dead stock", "investment"], need: "PROFIT:READ",
    a: "Investment Insights shows gross profit and margin, money tied up in slow stock, products worth stocking more of and thin-margin sellers, each with the numbers behind it.",
    chips: [go("Open Insights", "/insights")] },
  { id: "customer", keys: ["add customer", "new customer", "credit limit", "customer list", "customers"], need: "CUSTOMERS:READ",
    a: "Customers: + New customer with a name, phone and (optional) credit limit and credit days. A sale on credit is refused if it would take them over their limit.",
    chips: [say("Do it for me", "add a customer"), go("Open Customers", "/customers")] },
  { id: "settings", keys: ["settings", "company profile", "currency", "time zone", "fiscal year", "organization"],
    a: "All settings (the gear at the top right): company profile, currency, time zone, branding, sign-in and security, users and roles, and more.",
    chips: [go("Open Settings", "/settings")] },
  { id: "search", keys: ["search", "find", "shortcut", "keyboard", "ctrl k", "quick"],
    a: "Press Ctrl+K (or /) anywhere to search products, invoices, customers and suppliers, or to jump to a page. Press ? to see all shortcuts. The + button at the top creates anything quickly." },
  { id: "refer", keys: ["refer", "referral", "earn", "reward", "my link"],
    a: "Refer & earn: share your link or code. When a new business signs up with it and our team confirms it, you earn up to US$30.",
    chips: [go("Open Refer & earn", "/referrals")] },
  { id: "install", keys: ["install", "app", "download", "home screen", "desktop app"],
    a: "Install WHOLESTRA from your name at the top right, then Install app. On iPhone: Safari, Share, Add to Home Screen. It opens like an app with its own icon.",
    chips: [{ label: "Install the app", run: { do: "install" } }] },
  { id: "dark", keys: ["dark mode", "night mode", "theme", "light mode"],
    a: "Use the moon button at the top right to switch between light and dark." },
];

/** The entry that best answers a question, if any fits well enough. */
export function lookup(text: string, list: Entry[], allowed: (need?: string) => boolean = () => true): Entry | null {
  const plain = (x: string) => norm(x).replace(/\b(a|an|the|my|our|some|new)\b/g, " ").replace(/\s+/g, " ").trim();
  const t = ` ${plain(text)} `;
  let top: { e: Entry; s: number } | null = null;
  for (const e of list) {
    if (!allowed(e.need)) continue;
    let s = 0;
    for (const k of e.keys) { const n = plain(k); if (n && t.includes(` ${n} `)) s += n.split(" ").length + 0.5; }
    if (s > 0 && (!top || s > top.s)) top = { e, s };
  }
  return top?.e ?? null;
}
