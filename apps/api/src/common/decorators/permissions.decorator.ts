import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

// Usage: @RequirePermissions("PRODUCTS:CREATE", "PRODUCTS:UPDATE") — user needs ANY one of these
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
