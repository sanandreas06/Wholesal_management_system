export interface AuthUser {
  sub: string;
  email: string;
  organizationId: string;
  branchId: string | null;
  roles: string[];
  permissions: string[]; // formatted as "RESOURCE:ACTION", e.g. "PRODUCTS:CREATE"
}
