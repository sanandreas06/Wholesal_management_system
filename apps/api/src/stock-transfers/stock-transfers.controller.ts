import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { StockTransfersService } from "./stock-transfers.service";
import { CreateStockTransferDto } from "./dto/create-stock-transfer.dto";
import { HandoverDto } from "./dto/handover.dto";
import { BranchScopeService } from "../common/branch/branch-scope";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("stock-transfers")
export class StockTransfersController {
  constructor(private readonly stockTransfers: StockTransfersService, private readonly scope: BranchScopeService) {}

  @Get()
  @RequirePermissions("STOCK_TRANSFERS:READ")
  list(@CurrentUser() user: AuthUser) { return this.stockTransfers.list(user.organizationId, this.scope.scope(user) ?? undefined); }

  @Get(":id")
  @RequirePermissions("STOCK_TRANSFERS:READ")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "stockTransfer", id); return this.stockTransfers.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("STOCK_TRANSFERS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockTransferDto) { this.scope.assert(user, dto.fromBranchId); return this.stockTransfers.create(user.organizationId, user.sub, dto); }

  @Patch(":id/approve")
  @RequirePermissions("STOCK_TRANSFERS:UPDATE")
  async approve(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "stockTransferFrom", id); return this.stockTransfers.approve(user.organizationId, id, user.sub); }

  @Patch(":id/dispatch")
  @RequirePermissions("STOCK_TRANSFERS:UPDATE")
  async dispatch(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: HandoverDto) { await this.scope.record(user, "stockTransferFrom", id); return this.stockTransfers.dispatch(user.organizationId, id, user.sub, dto); }

  @Patch(":id/receive")
  @RequirePermissions("STOCK_TRANSFERS:UPDATE")
  async receive(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: HandoverDto) { await this.scope.record(user, "stockTransferTo", id); return this.stockTransfers.receive(user.organizationId, id, user.sub, dto); }

  @Patch(":id/cancel")
  @RequirePermissions("STOCK_TRANSFERS:UPDATE")
  async cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "stockTransferFrom", id); return this.stockTransfers.cancel(user.organizationId, id); }
}
