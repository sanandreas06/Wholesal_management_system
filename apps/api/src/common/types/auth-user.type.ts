export interface AuthUser {
  sub: string;
  email: string;
  organizationId: string;
  branchId: string | null;
  /** Set when the person's role is limited to their own branch: that branch id (or "__none__" if they have none). Absent = every branch. */
  branchScope?: string | null;
  /** True for the shared read-only demo company: it can look at everything and change nothing. */
  demo?: boolean;
  /** in the demo: the shop or company name the visitor typed, shown instead of the sample company's name */
  demoFor?: string;
  roles: string[];
  permissions: string[]; // formatted as "RESOURCE:ACTION", e.g. "PRODUCTS:CREATE"
}
