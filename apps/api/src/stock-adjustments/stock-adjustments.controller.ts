import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { StockAdjustmentsService } from "./stock-adjustments.service";
import { CreateStockAdjustmentDto } from "./dto/create-stock-adjustment.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("stock-adjustments")
export class StockAdjustmentsController {
  constructor(private readonly stockAdjustments: StockAdjustmentsService) {}

  @Get()
  @RequirePermissions("STOCK_ADJUSTMENTS:READ")
  list(@CurrentUser() user: AuthUser) { return this.stockAdjustments.list(user.organizationId); }

  @Post()
  @RequirePermissions("STOCK_ADJUSTMENTS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockAdjustmentDto) {
    return this.stockAdjustments.create(user.organizationId, user.sub, dto);
  }
}
