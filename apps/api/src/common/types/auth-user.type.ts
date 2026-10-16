export interface AuthUser {
  sub: string;
  email: string;
  organizationId: string;
  branchId: string | null;
  /** Set when the person's role is limited to their own branch: that branch id (or "__none__" if they have none). Absent = every branch. */
  branchScope?: string | null;
  roles: string[];
  permissions: string[]; // formatted as "RESOURCE:ACTION", e.g. "PRODUCTS:CREATE"
}
