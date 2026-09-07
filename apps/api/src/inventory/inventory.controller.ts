import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { InventoryService } from "./inventory.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermissions("INVENTORY:READ")
  list(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    return this.inventory.list(user.organizationId, branchId);
  }

  @Get("low-stock")
  @RequirePermissions("INVENTORY:READ")
  lowStock(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    return this.inventory.lowStock(user.organizationId, branchId);
  }

  @Get("movements")
  @RequirePermissions("INVENTORY:READ")
  movements(@CurrentUser() user: AuthUser, @Query("productId") productId?: string, @Query("branchId") branchId?: string) {
    return this.inventory.movements(user.organizationId, { productId, branchId });
  }
}
