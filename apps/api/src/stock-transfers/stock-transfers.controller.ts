import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { StockTransfersService } from "./stock-transfers.service";
import { CreateStockTransferDto } from "./dto/create-stock-transfer.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("stock-transfers")
export class StockTransfersController {
  constructor(private readonly stockTransfers: StockTransfersService) {}

  @Get()
  @RequirePermissions("STOCK_TRANSFERS:READ")
  list(@CurrentUser() user: AuthUser) { return this.stockTransfers.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("STOCK_TRANSFERS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.stockTransfers.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("STOCK_TRANSFERS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockTransferDto) { return this.stockTransfers.create(user.organizationId, user.sub, dto); }

  @Patch(":id/approve")
  @RequirePermissions("STOCK_TRANSFERS:UPDATE")
  approve(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.stockTransfers.approve(user.organizationId, id, user.sub); }

  @Patch(":id/dispatch")
  @RequirePermissions("STOCK_TRANSFERS:UPDATE")
  dispatch(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.stockTransfers.dispatch(user.organizationId, id, user.sub); }

  @Patch(":id/receive")
  @RequirePermissions("STOCK_TRANSFERS:UPDATE")
  receive(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.stockTransfers.receive(user.organizationId, id, user.sub); }

  @Patch(":id/cancel")
  @RequirePermissions("STOCK_TRANSFERS:UPDATE")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.stockTransfers.cancel(user.organizationId, id); }
}
