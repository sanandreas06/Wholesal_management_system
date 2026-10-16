import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { StockCountsService } from "./stock-counts.service";
import { CreateStockCountDto } from "./dto/create-stock-count.dto";
import { UpdateStockCountItemsDto } from "./dto/update-stock-count-items.dto";
import { BranchScopeService } from "../common/branch/branch-scope";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("stock-counts")
export class StockCountsController {
  constructor(private readonly stockCounts: StockCountsService, private readonly scope: BranchScopeService) {}

  @Get()
  @RequirePermissions("STOCK_COUNTS:READ")
  list(@CurrentUser() user: AuthUser) { return this.stockCounts.list(user.organizationId, this.scope.scope(user) ?? undefined); }

  @Get(":id")
  @RequirePermissions("STOCK_COUNTS:READ")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "stockCount", id); return this.stockCounts.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("STOCK_COUNTS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockCountDto) { this.scope.assert(user, dto.branchId); return this.stockCounts.create(user.organizationId, user.sub, dto); }

  @Put(":id/items")
  @RequirePermissions("STOCK_COUNTS:UPDATE")
  async updateItems(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateStockCountItemsDto) {
    await this.scope.record(user, "stockCount", id);
    return this.stockCounts.updateItems(user.organizationId, id, dto);
  }

  @Patch(":id/complete")
  @RequirePermissions("STOCK_COUNTS:UPDATE")
  async complete(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "stockCount", id); return this.stockCounts.complete(user.organizationId, id, user.sub); }

  @Patch(":id/cancel")
  @RequirePermissions("STOCK_COUNTS:UPDATE")
  async cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "stockCount", id); return this.stockCounts.cancel(user.organizationId, id); }
}
