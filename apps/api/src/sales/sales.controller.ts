import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { SalesService } from "./sales.service";
import { BranchScopeService } from "../common/branch/branch-scope";

import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { CreateSaleReturnDto } from "./dto/create-sale-return.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("sales")
export class SalesController {
  constructor(private readonly sales: SalesService, private readonly scope: BranchScopeService) {}

  @Get()
  @RequirePermissions("SALES:READ")
  list(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) { return this.sales.list(user.organizationId, this.scope.limit(user, branchId)); }

  @Get(":id/audit") @RequirePermissions("SALES:READ")
  async audit(@CurrentUser() u: AuthUser, @Param("id") id: string) { await this.scope.record(u, "sale", id); return this.sales.auditTrail(u.organizationId, id); }
  @Get(":id")
  @RequirePermissions("SALES:READ")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "sale", id); return this.sales.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("SALES:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) { this.scope.assert(user, dto.branchId); return this.sales.create(user.organizationId, user.sub, dto); }

  @Patch(":id/void")
  @RequirePermissions("SALES:UPDATE")
  async void(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.scope.record(user, "sale", id); return this.sales.void(user.organizationId, id, user.sub); }

  @Post(":id/payments")
  @RequirePermissions("PAYMENTS:CREATE")
  async pay(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreatePaymentDto) { await this.scope.record(user, "sale", id); return this.sales.recordPayment(user.organizationId, id, user.sub, dto); }

  @Post(":id/returns")
  @RequirePermissions("RETURNS:CREATE")
  async ret(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateSaleReturnDto) { await this.scope.record(user, "sale", id); return this.sales.createReturn(user.organizationId, id, user.sub, dto); }
}
