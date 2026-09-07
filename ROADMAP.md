# Wholesale Management System — Roadmap

*Consolidated from this conversation on 2026-08-28. This is the single source of
truth going forward — update it here rather than letting plans live only in
chat history across different tools.*

## A note on how this was built

Some of the early phase numbering (Phase 1, Phase 1.5) originated from another
AI tool used on this project before this conversation, not from me. I'm
recording what's been **verified working** through direct testing in this
conversation, not assuming anything about work done outside of it. If Phase 1
covers more than what's listed below, that detail lives elsewhere and should
be added here.

---

## Phase 1 — Foundation *(marked complete before this conversation)*

Status: ✅ Assumed complete, not independently verified in detail here.
Known to include, based on what we've encountered:
- Monorepo scaffold (pnpm workspaces: `apps/api`, `apps/web`, `database`)
- NestJS API skeleton (`main.ts`, `app.module.ts`, health check)
- Next.js web skeleton
- Prisma schema (Organization, Branch, User, Product, Sale, SaleItem, Region,
  Role, Permission, UserRole, RolePermission)
- Docker Compose for Postgres
- Basic login form + dashboard UI shell (pre-dating this conversation's
  auth/permission wiring)

## Phase 1.5 — Dashboard *(marked complete before this conversation)*

Status: ✅ Assumed complete.
- `/api/dashboard/summary` endpoint
- Dashboard UI with KPIs and charts (sales trend, branch performance)

---

## Phase 2 — Core Management

*(This is the authoritative 10-batch structure for Phase 2, as clarified
2026-08-28. Supersedes earlier fragmentary batch descriptions above.)*

### Batch 1 — RBAC
Status: ✅ Complete. Verified in-browser and via API.
- Roles (CRUD, activate/deactivate)
- Permissions (read-only catalogue)
- User-role assignment
- Permission guards (`PermissionsGuard`)
- Authentication/authorization (JWT with embedded roles/permissions)

### Batch 2 — Organization
Status: ✅ Complete. Verified in-browser and via API.
- Regions (CRUD)
- Branch management (CRUD, region assignment)
- Branch users (branch assignment as part of Users)
- Organization settings (view stats, edit name) — API + UI, tested live

### Batch 3 — Products
Status: ✅ Complete. Verified in-browser and via API.
- Category, Brand, Unit models added to schema (additive migration, no
  destructive changes — kept `Product.category` text field alongside new
  `categoryId`/`brandId`/`unitId` relations)
- Full CRUD APIs: `/api/categories`, `/api/brands`, `/api/units`,
  `/api/products` — org-scoped, permission-guarded, with FK validation
  (a product's category/brand/unit must belong to your organization) and
  delete guards (can't delete a category still assigned to products, can't
  delete a product with sales history)
- Product management UI with SKU, pricing, stock quantity, reorder level,
  and a "Low stock only" filter using the API's `?lowStock=true` query param
- Categories/Brands/Units management UI (simple list/create/edit/delete)
- One-time seed migration linking existing seeded products' legacy
  `category` text to real `Category` records — Brands/Units left empty by
  design, for the user to populate with real supplier/unit data
- Fixed a modal UX bug affecting every modal in the app: missing
  height/scroll limits meant content (including Cancel buttons and
  dropdowns) could render below the visible area with no way to reach it.
  Added explicit × close buttons, scroll containment, and example
  placeholder text across all forms.
- Fixed a typo from earlier (`org-form` missing its `.` in globals.css,
  so that rule silently never applied)

### Batch 4 — Suppliers & Customers
Status: ✅ Complete. Verified in-browser and via API.
- `Supplier`, `Customer`, and shared `Contact` models added (additive
  migration — no destructive changes, same safe pattern as Batch 3)
- Full CRUD APIs: `/api/suppliers`, `/api/customers` — org-scoped,
  permission-guarded, with credit limit/credit days fields
- Nested contact management per supplier/customer:
  `POST/PUT/DELETE /api/{suppliers|customers}/:id/contacts[/:contactId]`
  — contacts are guarded by the parent's own permission (no separate
  `CONTACTS` permission resource exists, by design)
- Server-side duplicate contact detection (same email, or same name+phone,
  rejected with a clear error) — catches what client-side validation alone
  would miss
- Phone number format validation (`@Matches`) and clearer email error
  messages — applied to **both** the Contact DTOs and the Supplier/Customer
  DTOs themselves (initially only added to Contacts; a real gap was caught
  when testing showed a supplier's own phone field accepted garbage input
  with no validation — fixed by applying the same pattern to
  create/update Supplier and Customer DTOs)
- Fixed a frontend bug where NestJS validation error arrays displayed as
  raw arrays instead of readable joined text
- Reworked the Contacts modal UX: opens showing the existing contact list
  first (or "No contacts yet"), with an explicit "+ Add Contact" button
  revealing the form on demand — previously it always showed the form
  immediately, which was confusing
- Note: duplicate detection on Supplier/Customer *records themselves* was
  already covered by the existing `code` uniqueness check from the start;
  the new duplicate check specifically targets *contacts*, which had none

### Batch 5 — Purchasing & Receiving
Status: ✅ Complete. Verified in-browser via full workflow test.
- `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, `GoodsReceiptItem`
  models added (additive migration, same safe pattern as prior batches)
- Purchase order workflow with real state transitions:
  `DRAFT → SENT → PARTIALLY_RECEIVED → RECEIVED`, plus `CLOSED`/`CANCELLED`
  — chosen over a simpler 3-state model since wholesale suppliers routinely
  deliver in multiple shipments; building partial-receiving support in now
  avoided a harder retrofit later
- Full CRUD + workflow actions: `POST/PUT/DELETE /api/purchase-orders`,
  `PATCH .../send`, `PATCH .../cancel` — items only editable while `DRAFT`,
  cancellation blocked once anything has been received
- **Goods receiving is the core piece**: `POST /api/purchase-orders/:id/receipts`
  validates received quantities against what's actually still owed, then
  atomically (single Prisma transaction): creates the receipt record,
  increments the product's stock, increments the PO item's received count,
  and recalculates the PO's overall status — proven correct via manual
  end-to-end testing (partial receive → status updated correctly → stock
  increased by the exact right amount → later full receive → status flipped
  to RECEIVED)
- Supplier invoice number/amount are optional fields on a receipt (goods
  often arrive before the paperwork does) — intentional, not a gap, though
  there's currently no way to attach invoice info to a receipt *after* the
  fact if it wasn't entered at receiving time; worth adding later if needed
- Purchase Orders UI: list with status badges, dynamic line-item entry on
  create, detail view showing ordered-vs-received quantities and receipt
  history, inline goods-receiving form

### Batch 6 — Inventory
Status: 🔜 Next up.

### Batch 7 — Sales
Status: Not started.

### Batch 8 — Finance & Reconciliation
Status: Not started.

### Batch 9 — Excel Integration
Status: Not started.

### Batch 10 — Dashboard & Analytics
Status: Not started. This is where the AI-driven investment recommendation
layer from the product vision lands, on top of KPI cards, sales/inventory
graphs, branch comparisons, and financial summaries.

---

## Superseded — earlier fragmentary phase notes

*(Kept for history only; Phase 2's batch structure above is now the single
source of truth.)*


---

## Working conventions established this session

- One AI tool driving changes at a time (previously had a conflict from two
  tools editing the repo independently)
- Changes delivered as git patch files (`git apply`), tested locally, then
  committed + pushed
- NestJS style: terse single-line class bodies, `PrismaService` injected
  directly, `@nestjs/jwt` used directly (no Passport)
- Next.js style: compact JSX, plain CSS classes in `globals.css` (no
  Tailwind/component library yet), `usePermissions()` hook for SSR-safe
  permission checks in UI
