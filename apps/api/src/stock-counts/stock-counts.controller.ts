import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { StockCountsService } from "./stock-counts.service";
import { CreateStockCountDto } from "./dto/create-stock-count.dto";
import { UpdateStockCountItemsDto } from "./dto/update-stock-count-items.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("stock-counts")
export class StockCountsController {
  constructor(private readonly stockCounts: StockCountsService) {}

  @Get()
  @RequirePermissions("STOCK_COUNTS:READ")
  list(@CurrentUser() user: AuthUser) { return this.stockCounts.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("STOCK_COUNTS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.stockCounts.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("STOCK_COUNTS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockCountDto) { return this.stockCounts.create(user.organizationId, user.sub, dto); }

  @Put(":id/items")
  @RequirePermissions("STOCK_COUNTS:UPDATE")
  updateItems(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateStockCountItemsDto) {
    return this.stockCounts.updateItems(user.organizationId, id, dto);
  }

  @Patch(":id/complete")
  @RequirePermissions("STOCK_COUNTS:UPDATE")
  complete(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.stockCounts.complete(user.organizationId, id, user.sub); }

  @Patch(":id/cancel")
  @RequirePermissions("STOCK_COUNTS:UPDATE")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.stockCounts.cancel(user.organizationId, id); }
}
