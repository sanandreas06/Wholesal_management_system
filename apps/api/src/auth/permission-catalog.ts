/** Every permission the application checks, as "RESOURCE:ACTION". New companies get these created (once, shared by all companies) the first time they are needed. */
const crud = (r: string) => ["READ", "CREATE", "UPDATE", "DELETE"].map((a) => `${r}:${a}`);
const some = (r: string, ...a: string[]) => a.map((x) => `${r}:${x}`);

export const ALL_PERMISSIONS: string[] = [
  ...some("DASHBOARD", "READ"),
  ...some("ORGANIZATION", "READ", "UPDATE"),
  ...some("SETTINGS", "READ", "UPDATE"),
  ...crud("REGIONS"), ...crud("BRANCHES"), ...crud("USERS"), ...crud("ROLES"),
  ...some("PERMISSIONS", "READ"),
  ...crud("PRODUCTS"), ...crud("CATEGORIES"), ...crud("BRANDS"), ...crud("UNITS"), ...crud("SUPPLIERS"), ...crud("CUSTOMERS"), ...crud("PURCHASING"),
  ...some("GOODS_RECEIVING", "READ", "CREATE"),
  ...some("INVENTORY", "READ", "CREATE", "UPDATE"),
  ...some("STOCK_ADJUSTMENTS", "READ", "CREATE"),
  ...some("STOCK_TRANSFERS", "READ", "CREATE", "UPDATE"),
  ...some("STOCK_COUNTS", "READ", "CREATE", "UPDATE"),
  ...some("PAYMENTS", "READ", "CREATE"),
  ...some("RETURNS", "READ", "CREATE"),
  ...some("SALES", "READ", "CREATE", "UPDATE"),
  ...some("EXPENSES", "READ", "CREATE", "APPROVE"),
  ...some("DEPOSITS", "READ", "CREATE"),
  ...some("RECONCILIATION", "READ"),
  ...some("VARIANCE_CASES", "READ", "UPDATE"),
  ...some("BRANCH_CLOSING", "READ", "CREATE"),
  ...some("EXCEL_IMPORT", "READ", "CREATE"),
  ...some("PROFIT", "READ"),
  ...some("REPORTS", "READ", "EXPORT"),
  ...some("AUDIT", "READ"),
];

/** What the second-in-command gets: everything except approving expenses stays with the owner only if the owner chooses (kept the same as the original seed). */
export const ADMIN_RESOURCES = [
  "ORGANIZATION", "SETTINGS", "REGIONS", "BRANCHES", "USERS", "ROLES", "PERMISSIONS", "PRODUCTS", "CATEGORIES", "BRANDS", "UNITS", "INVENTORY", "SALES", "REPORTS",
  "SUPPLIERS", "CUSTOMERS", "PURCHASING", "GOODS_RECEIVING", "STOCK_ADJUSTMENTS", "STOCK_COUNTS", "STOCK_TRANSFERS", "AUDIT", "PAYMENTS", "RETURNS",
  "EXPENSES", "DEPOSITS", "RECONCILIATION", "VARIANCE_CASES", "BRANCH_CLOSING", "EXCEL_IMPORT", "PROFIT", "DASHBOARD",
];

export const ROLE_DEFS = [
  { code: "SUPER_ADMIN", name: "Owner", description: "Full access to everything in the company" },
  { code: "ORGANIZATION_ADMIN", name: "Organization Administrator", description: "Company-wide administrative access" },
  { code: "REGIONAL_MANAGER", name: "Regional Manager", description: "Manages the branches in one region" },
  { code: "BRANCH_MANAGER", name: "Branch Manager", description: "Manages one branch" },
  { code: "SALES_USER", name: "Sales User", description: "Records and looks up sales" },
  { code: "INVENTORY_USER", name: "Inventory User", description: "Handles stock, receiving and counts" },
];

export const DEFAULT_UNITS = [["Piece", "PCS"], ["Carton", "CTN"], ["Bag", "BAG"], ["Box", "BOX"], ["Dozen", "DOZ"], ["Pack", "PACK"], ["Kilogram", "KG"], ["Litre", "LTR"]];
export const DEFAULT_EXPENSE_CATEGORIES = ["Fuel and transport", "Rent", "Salaries and wages", "Utilities", "Repairs and maintenance", "Marketing", "Other"];
