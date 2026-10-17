/** Everything that can be set up, grouped like the rest of the app. A link with `soon` is planned but not built yet: it opens a page that says so honestly. */
export type Link = { label: string; href: string; permission?: string; soon?: boolean; hint?: string };
export type Group = { title: string; icon: string; links: Link[] };
export type Section = { title: string; groups: Group[] };

export const SOON: Record<string, { title: string; text: string }> = {
  "number-series": { title: "Transaction number series", text: "Choose how invoice, purchase order and transfer numbers look, for example a prefix per branch (ACC-INV-0001). Today numbers are given automatically and never repeat." },
  "email-notifications": { title: "Email notifications", text: "Choose which events send an email, such as an expense waiting for approval or stock running out. Today these appear under the bell at the top of the app." },
  "reporting-tags": { title: "Reporting tags", text: "Add your own labels to sales and expenses (for example a salesperson or a project) and filter reports by them." },
  taxes: { title: "Taxes", text: "Set VAT and the other levies that apply to you, and show them on invoices. Until then, prices are recorded as you enter them." },
  "payment-gateways": { title: "Payment gateways", text: "Let customers pay invoices online by mobile money or card. Today payments are recorded by hand (cash, mobile money, bank)." },
  "credit-notes": { title: "Credit notes", text: "Give a customer credit after a return or an overcharge, and use it on their next invoice." },
  "supplier-credits": { title: "Supplier credits", text: "Record money a supplier owes you after returned goods, and use it on their next bill." },
  shipping: { title: "Shipping and delivery partners", text: "Book deliveries with courier companies and follow parcels from inside WHOLESTRA." },
  integrations: { title: "Other apps", text: "Connect WHOLESTRA with your accounting software, online shop or messaging tools." },
  "api-usage": { title: "API and developer access", text: "Let your own systems read and write WHOLESTRA data with a secure key, and see how much it is used." },
  "data-export": { title: "Export all your data", text: "Download everything your company has recorded in one file. Today each list can already be exported to CSV from its own page." },
};

export const SECTIONS: Section[] = [
  { title: "Organization settings", groups: [
    { title: "Organization", icon: "🏢", links: [
      { label: "Profile", href: "/settings/organization", permission: "ORGANIZATION:READ", hint: "Name, location, currency, time zone" },
      { label: "Branches and warehouses", href: "/branches", permission: "BRANCHES:READ" },
      { label: "Regions", href: "/regions", permission: "REGIONS:READ" },
      { label: "Branding", href: "/settings/branding", permission: "ORGANIZATION:READ", hint: "Logo on invoices and in the app" },
      { label: "Plan", href: "/settings/plan" },
    ] },
    { title: "Users and roles", icon: "👥", links: [
      { label: "Users", href: "/users", permission: "USERS:READ" },
      { label: "Roles and permissions", href: "/roles", permission: "ROLES:READ" },
    ] },
    { title: "Setup and configuration", icon: "⚙️", links: [
      { label: "Currency and regional settings", href: "/settings/organization", permission: "ORGANIZATION:READ" },
      { label: "Units of measurement", href: "/units", permission: "UNITS:READ" },
    ] },
    { title: "Customization", icon: "🎨", links: [
      { label: "Transaction number series", href: "/settings/soon/number-series", soon: true },
      { label: "Invoice look", href: "/settings/branding", permission: "ORGANIZATION:READ" },
      { label: "Email notifications", href: "/settings/soon/email-notifications", soon: true },
      { label: "Reporting tags", href: "/settings/soon/reporting-tags", soon: true },
    ] },
    { title: "Taxes and compliance", icon: "🧾", links: [
      { label: "Taxes", href: "/settings/soon/taxes", soon: true },
    ] },
    { title: "Security", icon: "🔒", links: [
      { label: "Sign-in and security", href: "/settings/security", hint: "Authenticator app, recovery codes" },
      { label: "Change log", href: "/audit", permission: "AUDIT:READ" },
    ] },
  ] },
  { title: "Module settings", groups: [
    { title: "General", icon: "📇", links: [
      { label: "Customers", href: "/customers", permission: "CUSTOMERS:READ" },
      { label: "Suppliers", href: "/suppliers", permission: "SUPPLIERS:READ" },
      { label: "Products", href: "/products", permission: "PRODUCTS:READ" },
      { label: "Categories", href: "/categories", permission: "CATEGORIES:READ" },
      { label: "Brands", href: "/brands", permission: "BRANDS:READ" },
    ] },
    { title: "Inventory", icon: "📦", links: [
      { label: "Stock levels", href: "/inventory", permission: "INVENTORY:READ" },
      { label: "Stock adjustments", href: "/stock-adjustments", permission: "STOCK_ADJUSTMENTS:READ" },
      { label: "Transfers between branches", href: "/stock-transfers", permission: "STOCK_TRANSFERS:READ" },
      { label: "Stock counts", href: "/stock-counts", permission: "STOCK_COUNTS:READ" },
      { label: "Reorder levels", href: "/reorder", permission: "PURCHASING:READ" },
    ] },
    { title: "Online payments", icon: "💳", links: [
      { label: "Payment gateways", href: "/settings/soon/payment-gateways", soon: true },
    ] },
    { title: "Sales", icon: "🛒", links: [
      { label: "Sales and invoices", href: "/sales", permission: "SALES:READ" },
      { label: "Unpaid invoices", href: "/sales?status=unpaid", permission: "SALES:READ" },
      { label: "Credit notes", href: "/settings/soon/credit-notes", soon: true },
    ] },
    { title: "Purchases", icon: "🛍️", links: [
      { label: "Purchase orders and goods received", href: "/purchase-orders", permission: "PURCHASING:READ" },
      { label: "Expenses", href: "/finance?tab=expenses", permission: "EXPENSES:READ" },
      { label: "Expense approval limits", href: "/roles", permission: "ROLES:READ" },
      { label: "Supplier credits", href: "/settings/soon/supplier-credits", soon: true },
    ] },
    { title: "Finance", icon: "💰", links: [
      { label: "Daily reconciliation", href: "/finance?tab=reconciliation", permission: "RECONCILIATION:READ" },
      { label: "Bank deposits", href: "/finance?tab=deposits", permission: "DEPOSITS:READ" },
      { label: "Branch closing", href: "/finance?tab=closings", permission: "BRANCH_CLOSING:READ" },
    ] },
  ] },
  { title: "Extensions and data", groups: [
    { title: "Integrations", icon: "🔌", links: [
      { label: "Shipping", href: "/settings/soon/shipping", soon: true },
      { label: "Other apps", href: "/settings/soon/integrations", soon: true },
    ] },
    { title: "Data", icon: "🗂️", links: [
      { label: "Excel import", href: "/imports", permission: "EXCEL_IMPORT:READ" },
      { label: "Export all data", href: "/settings/soon/data-export", soon: true },
      { label: "API usage", href: "/settings/soon/api-usage", soon: true },
    ] },
    { title: "Rewards", icon: "🎁", links: [
      { label: "Refer and earn", href: "/referrals", hint: "Up to US$30 per company" },
    ] },
  ] },
];
