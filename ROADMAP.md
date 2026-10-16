# WHOLESTRA — Roadmap

*Last reconciled 2026-10-16. This is the single source of truth for project
status.*

## Where we are (2026-10-16)

**Phase 2 — Core Management is built through Batch 22 and pushed to GitHub**
(commit "Batches 11-22"). The system is ready for a first pilot with other
users who are not the super admin.

What a pilot can rely on today:
- Roles with their own permissions; branch managers and sales/inventory users
  can be limited to their own branch (enforced on the server, not just hidden)
- A tamper-evident, sealed Change log, including sign-ins with device and
  place in plain words
- Real secrets for sign-in and sealing (`pnpm secrets:set`, then
  `pnpm audit:rotate-key`); the API warns about weak ones and refuses to start
  with them in production
- First-login password change, admin password reset, database backups
  (`pnpm db:backup`)

**Before real use, still to do (owner's side):**
1. Run the secrets steps on the live computer (stop API, `pnpm secrets:set`,
   `pnpm audit:rotate-key`, restart, sign in again) and delete the
   `.env.backup-…` copy afterwards
2. Walk through the system once as a Branch Manager: create a user with a
   temporary password, sign in, confirm only their own branch shows and that
   Audit, Users and Roles are hidden
3. Back up nightly and copy the file off the computer
4. Push to GitHub after every batch

**Next candidates** (not started, in rough order): a free demo for mentors and investors, a first run on a throwaway server, then a pilot at one real branch
(the plan and walk-through checklists exist); the unscoped items
at the bottom of this file.

## A note on numbering (2026-09-11)

A separate "Master Build Roadmap" document surfaced during this project,
proposing a 12-phase structure (Foundation, Auth, Master Data, Inventory,
Purchasing, Sales & Payments, Finance, Excel, Dashboard, Audit, AI, Pilot)
that would replace the batch structure below — its own text explicitly frames
itself as superseding "the original documents['] broader phases."

**Decision: the batch structure below remains authoritative.** We are still
in **Phase 2 — Core Management**, and Sales is **Batch 7** of that phase, not
a standalone "Phase 6." The newer document's *content* (specific gaps like
Product Aliases, Purchase Requests, formal Opening Stock) is genuinely useful
and has been folded into the relevant batches below as gap notes — only its
proposed renumbering has been declined.

## Tooling decision (2026-09-11)

That same document specifies a fuller enterprise stack: Keycloak/Auth0,
Redis + BullMQ, Tailwind + shadcn/ui, S3/Azure Blob Storage, a separate
Python/FastAPI AI service, and a full CI/CD + monitoring stack (Cloudflare,
Sentry, OpenTelemetry, Azure).

**Decision: keep the current lightweight, self-contained stack** (custom JWT
auth, plain CSS with a custom theme system) and build toward the same
*functional* requirements rather than adopting every specified tool — our
custom auth and theming are already built, tested, and working; replacing
them now would be a costly rewrite for no functional gain at this stage.
Revisit if real scale, compliance, or team-size needs justify it later
(most likely relevant around Batch 9 Excel Integration, which will need
background job processing, and any future production deployment phase).

---

## Phase 1 — Foundation *(marked complete before this conversation)*
Status: ✅ Assumed complete, not independently verified in detail here.
Monorepo scaffold, NestJS/Next.js skeletons, Prisma schema, Docker Compose
for Postgres, basic login form and dashboard shell.

## Phase 1.5 — Dashboard *(marked complete before this conversation)*
Status: ✅ Assumed complete. `/api/dashboard/summary` endpoint, KPI cards,
sales trend and branch performance charts.

---

## Phase 2 — Core Management

### Batch 1 — RBAC
Status: ✅ Complete. Verified in-browser and via API.
Roles, Permissions, User-role assignment, Permission guards
(`PermissionsGuard`), JWT authentication with roles/permissions embedded.

### Batch 2 — Organization
Status: ✅ Complete. Verified in-browser and via API.
Regions, Branch management, Branch users (branch assignment on Users),
Organization settings.

### Batch 3 — Products
Status: ✅ Complete. Verified in-browser and via API.
Product management (SKU, cost, reorder level, status), Categories, Brands,
Units, Stock/reorder thresholds.
- 🔲 **Gap (from the technical architecture doc): Product aliases**
  (alternative names, normalized names, SKU/name matching) — not built.
  Will matter once Batch 9 Excel Integration needs to match messy
  branch-entered product names to master records.

### Batch 4 — Suppliers & Customers
Status: ✅ Complete. Verified in-browser and via API.
Supplier & Customer records, nested Contacts with server-side duplicate
detection, credit limit/days fields, phone/email format validation.

### Batch 5 — Purchasing & Receiving
Status: 🟡 Mostly complete.
- ✅ Purchase orders — full workflow (`DRAFT → SENT → PARTIALLY_RECEIVED →
  RECEIVED/CLOSED/CANCELLED`), line items, supplier/branch validation
- ✅ Goods receiving — partial receiving supported, validated against what's
  actually still owed, atomically updates inventory + ledger + PO status
- 🔲 **Gap (from the technical architecture doc): Purchase requests** — a
  pre-PO requisition/approval step (branch requests → gets approved →
  becomes a PO). We currently go straight to PO creation. Worth adding if
  formal approval workflows become a real requirement.

### Batch 6 — Inventory
Status: 🟡 Mostly complete.
- ✅ Stock ledger — every movement recorded (`StockMovement`: RECEIPT,
  ADJUSTMENT, TRANSFER_IN/OUT, COUNT_VARIANCE, INITIAL, SALE, RETURN), single shared
  `adjustStock()` helper every feature routes through so the ledger and
  per-branch `Inventory` balances can never drift apart
- ✅ Stock adjustments — required reason, protected against negative stock
- ✅ Stock counts — snapshot system quantity, enter physical count, apply
  variance on completion, blocks completion until every item is counted
- ✅ Stock transfers — full `DRAFT → APPROVED → DISPATCHED → RECEIVED`
  workflow; stock genuinely absent from both branches while in transit
  (verified by hand)
- ✅ Low-stock alerts (per-branch, via the Inventory page's low-stock filter)
- 🔲 **Gap (from the technical architecture doc): formal "opening stock"
  concept.** The initial branch-split was handled via a one-time seed
  migration rather than a reusable feature. Low priority — only matters
  when onboarding a brand-new branch with existing physical stock.
- Warehouse/location sub-branch support — explicitly optional in the
  architecture doc; skipped for now.

### Batch 7 — Sales
Status: ✅ Complete. Verified in-browser and via API.
- ✅ Sales — invoice numbering (`INV-00001`), per-branch stock check, stock
  deducted exactly once through the shared `adjustStock()` path (ledger type
  `SALE`), atomic transaction so a failed sale never partially posts
- ✅ Customers on sales, with credit-limit enforcement against the customer's
  unpaid balance
- ✅ Payments — Cash / Bank / Mobile money / Credit, multiple payments per
  sale, overpayment rejected; Paid / Partial / Unpaid status derived from them
- ✅ Returns — per-line quantities capped at what was sold minus already
  returned, stock restored (ledger type `RETURN`)
- ✅ Void — restores all stock; blocked once a sale has returns
- ✅ Sales UI — list, new-sale form (with live branch stock), detail view,
  printable invoice
- 🔲 Not built: discounts and return approval workflow (returns post
  immediately); a downloadable PDF invoice (print view only).

### Batch 8 — Finance & Reconciliation
Status: 🔲 Not started. **This is next.**
Expenses, Deposits, Branch reconciliation, Variance cases, Branch closing.

### Batch 9 — Excel Integration
Status: ✅ Built; page verified in-browser, confirm a full import with the template before relying on it.
- ✅ Upload `.xlsx` / `.csv` per branch and period (5 MB / 5,000 rows limit),
  with a downloadable template
- ✅ Validation — required columns, readable dates inside the chosen period,
  whole-number quantities, numeric prices, product matched by SKU then exact
  name; every rejected row stored with row number, reason and row data
- ✅ Idempotent import — each row gets a fingerprint (branch, date, product,
  quantity, price, reference, occurrence); re-uploading the same rows is
  skipped and counted as duplicates
- ✅ Weekly sales storage — kept in `WeeklySale`, separate from live Sales,
  and does not change stock; each import keeps the source file, uploader,
  period and counts (`ImportBatch`)
- ✅ Import history, per-import detail, and a 30-day imported-sales summary
  per branch
- 🔲 Gaps: product aliases (non-matching names are rejected until the
  product exists under that SKU/name); OneDrive/SharePoint + Microsoft Graph
  sync; background processing for very large files; downloading the original
  file back from the UI; custom column mapping per branch.

### Batch 10 — Dashboard & Analytics
Status: ✅ Built (dashboard, drill-down). Cost price/profit is the main gap.
- ✅ WHOLESTRA-style dashboard: sales, inventory value, expenses,
  deposits, outstanding collections, each vs the previous period; 7/30/90-day
  and branch filters; sales trend, sales by branch, inventory by category,
  recent sales, top products, stock alerts, quick actions, recent activity,
  rule-based insights (not a prediction model)
- ✅ Grouped sidebar, light/dark theme, system-online indicator
- ✅ Drill-down: cards, branch bars, recent sales and top products open the
  Sales page filtered by branch / product / cashier / unpaid; a sale opens
  with its full audit trail (who created it, payments, returns, stock
  movements with before/after quantities) and links onward to the product
  and cashier
- 🔲 Gaps: no cost price, so no profit or margin; low stock is
  organization-wide; no global search or notifications; drill-down covers
  sales, not yet expenses/deposits rows; sales list is capped at 200;
  dashboard figures cannot be exported
- ✅ *Update:* cost price (Batch 11), global search and notifications (14b, 16a)
  and expenses/deposits drill-down (19e) are now built; low stock follows the
  Reorder rules (14b)

### Batch 11 — Cost price & profit
Status: ✅ Built (needs `db:push` + `db:seed`, then sign out/in).
- ✅ Product cost price; sale lines snapshot the cost at sale time so past
  profit never changes when costs change later
- ✅ Weighted-average cost updated automatically when goods are received
- ✅ Gross profit and margin on the dashboard, with a cost-coverage note
  when some products have no cost yet; cost and margin columns on Products
- ✅ `PROFIT:READ` permission: only holders ever receive cost data or can set it
- ✅ Profit is now netted for returns (Batch 19a)
- 🔲 Gaps: cost is organization-wide, not per branch; no cost history table

### Batch 14b — Attention & product dialog
- Stock alerts (bell, sidebar, dashboard banner and card) now use the same per-branch, sales-speed rules as the Reorder page, so they always agree with it.
- Notification bell in the top bar (out of stock, low stock, pending expenses, open variance cases, draft POs) with links; refreshes every minute.
- Red count badges on sidebar items, a banner on the dashboard when stock needs attention, and a count on the Stock Alerts card.
- New Sale dialog redesigned: items table with line totals, per-branch stock under each line, live summary panel (paid now, balance, credit-limit and stock warnings).
- Product create/edit dialog redesigned: sectioned layout, live margin, read-only on-hand stock when editing.

### Batches 12–28 (all built, in order)
- ✅ 12 Audit log for non-inventory changes — built (Audit → Change log tab; before/after values for products, prices, customers, suppliers, users, roles, branches, settings, expense decisions). Gaps: login/logout events, sales/finance postings (they have their own trails), tamper-proofing (hash chain), export
- ✅ 13 Product aliases + review screen — built (aliases on the product form; Excel import matches SKU, exact name, alias, then name ignoring case/punctuation; "Review unmatched products" suggests closest matches, remembers your choice and imports the held-back rows). Gaps: matching is suggestion-only (never auto-guesses), no bulk alias import
- ✅ 14 Reorder suggestions — built (Purchases → Reorder Suggestions: per branch, from recent sales speed vs on hand and on order; editable quantities and costs; creates a DRAFT purchase order per supplier, never sends one). Gaps: lead time and cover days are global settings you adjust on the page, not per supplier/product; suggestions ignore seasonality and returns; supplier is inferred from the last purchase order
- ✅ 15 Owner investment recommendations — built (Investment Insights, needs `PROFIT:READ`: gross profit and margin, money tied up in slow or unsold stock, products worth stocking more of, thin-margin sellers, branch and category comparison; every item shows its numbers and links to the sales behind it; phrased as "worth reviewing", not instructions). Gaps: no seasonality, supplier terms or returns; thresholds (90 days idle, 21 days of stock) are fixed; cost is organization-wide
- ✅ 16a Interactivity, part 1 — built: Ctrl+K / "/" command palette (jump to pages, start a sale or product, search products, invoices, customers, suppliers across the app, only what you may read); toasts instead of browser pop-ups; keyboard shortcuts (g then d/s/p/i/r/c/f/a/e, ? for help); loading skeletons; numbers that count up; the notification bell (14b). Dashboard quick actions open the new-sale / new-product form directly. Also fixed Investment Insights links so they filter Sales correctly.
- ✅ 16b Interactivity, part 2 — built: click a day on the sales trend to open that day's sales, click a donut slice or legend row to open that category's products (both already worked for branch bars); saved views (name and re-apply filter sets on Sales and Products, kept in this browser); Export CSV on Sales, Products, Customers and Stock (levels and movement ledger), opens cleanly in Excel; invoices print as a styled page you can save as PDF; Investment Insights prints to PDF; dashboard refreshes itself every minute with a Live indicator and a toast when a new sale comes in. Gaps: saved views live in one browser, not on the account; PDFs use the browser's Save as PDF, not a server-made file; export is of what is on screen (Sales is capped at 200)
- ✅ 17 Look and profile — built (needs `db:push`): large centred pill search bar in the top bar; Plus Jakarta Sans + Sora fonts across the app (loaded from Google Fonts, falls back to system fonts offline); every dialog except New Sale restyled (blurred backdrop, accent bar, rounded fields with focus ring, gradient primary button); profile menu on the avatar with My profile, shortcuts and Sign out; My profile lets a person upload a photo (shrunk in the browser) or pick one of 12 icons, edit name and phone, and change their password. Email, role and branch stay admin-controlled. Gaps: no profile audit entries; photo is stored in the database, not a file store
- ✅ 17b Dialogs: every dialog is centred on screen with a fixed header and footer, forms laid out in two columns so most fit without scrolling (long ones scroll inside the dialog, never the page)
- ✅ 17c Phones: sidebar becomes a slide-out menu (menu button in the top bar), tables scroll sideways, notification panel fits the screen, New Sale and other dialogs reflow to one column. Tested at 375px wide
- ✅ 18 Tamper-evident audit log — built (needs `db:generate` + `db:push`, then restart the API): every Change-log entry is sealed with a keyed hash (HMAC-SHA256) that also covers the entry before it, numbered per organization; the database refuses to edit or delete sealed rows; Audit → Change log opens with a plain-words status (intact / tampered), a re-check button, the latest seal code to write down and check later (catches deleted entries at the end), a “How does this work?” explainer, 🔒 #n chips per row (⚠ on any that no longer match) and an Export sealed CSV. Entries from before sealing are sealed at first start (marked *). Seal key is `AUDIT_SEAL_KEY` (falls back to `JWT_SECRET`); `AUDIT_APPEND_ONLY=false` skips the database guard. Gaps: someone holding both the database and the server key can re-seal; proves the log wasn't altered, not that an entry was honest; login/logout events still not logged
- ✅ 19 The five remaining gaps — built (needs `db:generate` + `db:push`; restart the API):
  - 19a Returns come off profit: goods brought back in a period reduce that period's units, revenue and gross profit (Dashboard profit card and Investment Insights), at the price and cost they were sold at; the dashboard says "after X returned". Counted on the date the return was recorded
  - 19b Sign-ins in the sealed Change log: Sign in, Failed sign-in (only for real accounts, capped at 10 per account per 10 minutes) and Sign out, each with the browser/device and IP; new "Sign-in" record type filter. Session expiry is not logged
  - 19c Per-supplier delivery time: Suppliers has a Delivery time field; if left empty it is learned from past deliveries (middle value of the last 10 orders, order date to first receipt, needs 2+); Reorder uses supplier's own time, else learned, else the default on the page (now labelled "Unknown suppliers take N days"); each group shows where its lead time came from
  - 19d Saved views live on the account (new SavedView table, own views only, 30 per screen); views already saved in a browser are moved up automatically the first time
  - 19e Expenses and Deposits drill-down: date range (with Today/This week/This month/Last 30 days), branch, category/method and status filters; totals for the exact filter (not just the first rows), status/method pills and a category bar breakdown you can click; Export CSV; Dashboard Expenses/Deposits cards and the bell open Finance with the right tab and filters already set. Gaps: lists show the latest 500 rows (totals cover everything); no per-expense attachments
- ✅ 20 Ready for other users (separate from the super admin) — built (needs `db:generate` + `db:push`; restart the API; people must sign in again):
  - 20a Branch limits: a role can be set to "Limit to the person's own branch" (Roles screen; shown as "Sees" column). Limited people only see and work with their own branch: sales, stock, purchasing, counts, adjustments, transfers (send from own branch; see ones sent to or from it), expenses, deposits, reconciliation, closings, variance cases, Excel imports, dashboard, reorder, bell, search, products' stock figures. Another branch's record looks like it does not exist, and asking for another branch's data is refused. Branch pickers offer only their branch. Enforced on the server, not just hidden
  - 20b Starting roles: Branch Manager, Sales User and Inventory User get sensible starting permissions the first time the API starts (only if they have none yet, never overwriting your edits) and are limited to own branch. They get no profit/cost, audit log, users/roles, settings, or expense approval
  - 20c First sign-in: new users and anyone whose password an administrator resets (Users → Reset password) must choose their own password before using the app
  - 20d Backups: `pnpm db:backup` saves the whole database to `backups/` (keeps the newest 30; restore steps are at the top of `scripts/backup-db.ps1`)
  - Gaps: customers and suppliers are shared across branches by design; the audit log and Fraud signals are organization-wide (give AUDIT only to owners); a person's role change takes effect when they sign in again; branch managers can't approve expenses (owner does)
- ✅ 21 Real secrets — built (API stopped, then `pnpm secrets:set`, then `pnpm audit:rotate-key`): `secrets:set` makes a long random `JWT_SECRET` and `AUDIT_SEAL_KEY` on your own computer (never shown), backs up `.env` first and remembers the old key; `audit:rotate-key` checks every Change-log entry under the old key, re-seals the whole log under the new one in a single all-or-nothing step, adds a “SEAL KEY CHANGED” entry and removes the old key from `.env`. It refuses (changing nothing) if any entry fails the old-key check. The API now reads the main `.env` no matter where it starts, warns about weak/placeholder secrets and refuses to start with them when `NODE_ENV=production`. Everyone is signed out once. Gaps: secrets still live in a plain `.env` file (use the host's secret store when deployed); changing `JWT_SECRET` later signs everyone out again; `AUDIT_SEAL_KEY` must never be changed by hand
- ✅ 22 Plain-words sign-in details — built: in Audit → Change log, “Details” on a sign-in no longer shows raw code. It shows “Device: Chrome on Windows” and “Connected from: The computer that runs the system / Inside your own network / Outside your network” (the technical address sits underneath in small grey), plus a one-line hint to change the password if the device or place is unfamiliar. Other entries with extra information show labelled lines instead of code. Gaps: “inside/outside your network” is a guess from the address, and behind a web proxy every visitor may look like the proxy
- ✅ 23 Expense approval limits — built (needs `db:generate` + `db:push`; restart the API): a role can have “Can approve expenses up to” (Roles → Edit; empty = any amount). Someone who may approve can approve or reject expenses up to that amount in their branch; bigger ones show “Above your limit… the owner needs to approve this one” with only a Reject button. Nobody can review an expense they entered themselves, owner included. The Expenses list tells the screen row by row whether you may review it. To use it: give the Branch Manager role the Expenses → Approve permission and set a limit. Gaps: one limit per role (not per category); the limit is checked at the moment of approval, so changing it does not affect expenses already approved
- ✅ 24 Ready to host — built, **not yet tried on a real server** (nothing to run on your computer except applying the patch): `deploy/` has a production setup for one server (database, API, website, automatic HTTPS through Caddy, nightly backup at 02:00 kept 14 days), `update.sh` (backs up, rebuilds, applies database changes, stops if one could lose data), and `.dockerignore` so secrets and node_modules never go into an image. The API trusts the web server's forwarded address when `TRUST_PROXY=true`, so the Change log shows real visitor addresses. **Seed fix:** re-running `db:seed` no longer resets the owner's password to the starting one; a newly created owner must change the starting password at first sign-in, and `SEED_ADMIN_PASSWORD` can set it. Gaps: first run needs a throwaway server; backups sit on the same server unless the host's backup option is on; one server is one point of failure
- ✅ 25 Free demo hosting — built, **not yet tried live** (for testing and showing mentors and investors, not for real shop data): `render.yaml` runs the API on Render's free plan (Render makes the secrets itself), the website goes on Vercel, the database on Neon (all free; see the Free demo guide page). **Security fix:** the sign-in page no longer pre-fills or prints the owner's email and starting password; an optional read-only demo account can be shown on purpose by setting `NEXT_PUBLIC_DEMO_EMAIL` and `NEXT_PUBLIC_DEMO_PASSWORD` when the site is built. The sign-in page wakes the sleeping free server as soon as it opens and explains a slow first sign-in. The API uses `PORT` when a host sets it. Hosted in Frankfurt (Render and Neon both; neither has an African region) for Ghana. Gaps: free servers sleep after ~15 minutes and take up to a minute to wake; Neon's free database has no scheduled backups (a 6-hour restore window only) and 0.5 GB of space; Vercel's free plan is for non-commercial use; move to paid hosting before real customers use it
- ✅ 26 WHOLESTRA name and public home page: the app is now called **WHOLESTRA**. Visitors land on a public home page (`/`) with product pictures (sample data only), what it does and how it is kept safe, and one click to sign in (signed-in people see "Open dashboard"). Sign-in page, sidebar and printed invoices use the new name.
- ✅ 27 Interactive home page, new logo and split sign-in page: the home page has floating inventory pictures (boxes, scanner, truck, shelves, clipboard) and little status cards that drift with the mouse, a dashboard picture that tilts and counts up, clickable feature tabs, hover effects and gentle scroll reveals (all switched off for people who prefer less motion). New WHOLESTRA logo: a gold helmet-shaped shield with an upward arrow, redrawn from the emblem you chose. The app keeps its original blue colours. Sign-in page now has a top bar (Home, Features, Modules, How it works, Security, Back to home), the sign-in box on the right and an animated warehouse picture on the left. Not built yet: any other public pages (pricing, contact) and a sign-up form; accounts are still added by an owner or administrator.
- ✅ 28 Multi-page public site, redesign: the public site is now Home, Features, Security, About, Contact and Get started, with one shared top bar (logo at the far left; Sign in and Get started for visitors, Open dashboard and Sign out for signed-in people; a menu button on phones) and footer. The home page opens with a working stock board (hover to scan, click a stack to sell a carton, alerts and takings update; sample data only), a "Today vs With WHOLESTRA" comparison, a clickable product tour, a module index, and a "try to change the record" demo of the sealed change log. Get started builds a ready-to-send message; it goes by WhatsApp or email once `NEXT_PUBLIC_CONTACT_WHATSAPP` and/or `NEXT_PUBLIC_CONTACT_EMAIL` are set on the website host (nothing is stored on the site). The logo now has a light tile on dark surfaces such as the sidebar. Not built yet: a form that stores requests for the owner to see, and a pricing page.

---

## Not yet scoped as a batch, but flagged from the technical architecture doc

- **Audit & Security beyond inventory** — we already have genuine audit
  value today: the Stock Movement ledger (who/what/when/branch/before-after
  quantity for all inventory activity) and a rule-based fraud/anomaly
  detection page (large single reductions, frequent reducers, recurring
  branch shortages, off-hours activity — framed as "worth reviewing," not
  accusations, every flag traces to real records). *Update:* the non-inventory audit log is built (Batch 12) and tamper-evident
  (Batches 18, 21), so who edited a supplier's credit limit or changed a role's
  permissions is now recorded. Still not built: general approval workflows
  (only expenses have approval) and period locking.
- **AI & Advanced Analytics** — the fraud detection above is a precursor,
  not real ML. Demand forecasting, reorder recommendations, and
  natural-language analytics are explicitly meant to come *after* reliable
  transactional data exists — matches the architecture doc's own stated
  principle: "build controls before AI."
- **Pilot & Rollout** — not relevant until the above batches are further
  along.

---

## Working conventions

- One AI tool driving code changes at a time — a real conflict occurred
  earlier when two tools edited the repo independently; resolved by
  consolidating on one driver
- Changes delivered as git patch files (`git apply`) or, when a file has
  accumulated too much layered history for a patch to apply reliably, as a
  complete replacement file
- Always `cd` to the actual project root before `git add .` — a real
  mistake was made running it from a subdirectory, silently staging nothing
- Commit and push frequently — long gaps between commits have repeatedly
  caused "what's actually on disk vs. what's in git" confusion
- NestJS style: terse single-line class bodies, `PrismaService` injected
  directly, `@nestjs/jwt` used directly (no Passport)
- Next.js style: compact JSX, CSS custom properties for theming (light/dark),
  `usePermissions()` hook for SSR-safe permission checks, `usePolling()` for
  live-updating views without a full WebSocket system
- Secrets (JWT_SECRET, AUDIT_SEAL_KEY) are generated on the owner's own
  computer and never pasted into chat or committed; `.env`, `.env.backup-*`
  and `*.patch` are git-ignored
- Never change AUDIT_SEAL_KEY by hand; use `pnpm secrets:set` then
  `pnpm audit:rotate-key`
