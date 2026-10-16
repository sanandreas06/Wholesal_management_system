import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { PurchaseOrdersService } from "./purchase-orders.service";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";
import { BranchScopeService } from "../common/branch/branch-scope";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("purchase-orders")
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService, private readonly scope: BranchScopeService) {}

  @Get()
  @RequirePermissions("PURCHASING:READ")
  list(@CurrentUser() user: AuthUser) { return this.purchaseOrders.list(user.organizationId, this.scope.scope(user) ?? undefined); }

  @Get(":id")
  @RequirePermissions("PURCHASING:READ")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "purchaseOrder", id); return this.purchaseOrders.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("PURCHASING:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseOrderDto) { this.scope.assert(user, dto.branchId); return this.purchaseOrders.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("PURCHASING:UPDATE")
  async update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdatePurchaseOrderDto) { await this.scope.record(user, "purchaseOrder", id); return this.purchaseOrders.update(user.organizationId, id, dto); }

  @Patch(":id/send")
  @RequirePermissions("PURCHASING:UPDATE")
  async send(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "purchaseOrder", id); return this.purchaseOrders.send(user.organizationId, id); }

  @Patch(":id/cancel")
  @RequirePermissions("PURCHASING:UPDATE")
  async cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "purchaseOrder", id); return this.purchaseOrders.cancel(user.organizationId, id); }

  @Delete(":id")
  @RequirePermissions("PURCHASING:DELETE")
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "purchaseOrder", id); return this.purchaseOrders.remove(user.organizationId, id); }

  @Post(":id/receipts")
  @RequirePermissions("GOODS_RECEIVING:CREATE")
  async receive(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateGoodsReceiptDto) {
    await this.scope.record(user, "purchaseOrder", id);
    return this.purchaseOrders.receive(user.organizationId, id, user.sub, dto);
  }
}
