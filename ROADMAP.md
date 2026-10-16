# Wholesale Management System — Roadmap

*Last reconciled 2026-10-14. This is the single source of truth for project
status.*

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
Status: 🟡 Dashboard built; drill-down still open. **This is next.**
- ✅ Dashboard with 7/30/90-day and branch filters
- ✅ Sales with change vs previous period, net of returns, invoice count and
  average, stock value
- ✅ Sales trend (zero-filled), branch performance, top products, low stock,
  recent stock activity, attention links (pending expenses, open variance
  cases), approved expenses and imported weekly sales (permission-gated)
- ✅ Light/dark theme, Zoho-inspired layout
- 🔲 Full drill-down (Branch → Transaction → Product → User → Audit Record):
  KPI cards and table rows are not yet clickable
- 🔲 Gaps: stock value is at selling price (no cost price yet), so no profit
  or margin; low stock is organization-wide, not per branch; branch users
  can still pick any branch; no export of dashboard figures

---

## Not yet scoped as a batch, but flagged from the technical architecture doc

- **Audit & Security beyond inventory** — we already have genuine audit
  value today: the Stock Movement ledger (who/what/when/branch/before-after
  quantity for all inventory activity) and a rule-based fraud/anomaly
  detection page (large single reductions, frequent reducers, recurring
  branch shortages, off-hours activity — framed as "worth reviewing," not
  accusations, every flag traces to real records). Gap: no audit log yet for
  non-inventory actions (e.g. who edited a supplier's credit limit, who
  changed a role's permissions). Approval workflows and period locking are
  not built (depend on Batches 7–8 existing first).
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
