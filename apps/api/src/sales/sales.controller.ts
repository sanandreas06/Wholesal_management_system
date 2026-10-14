import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { CreateSaleReturnDto } from "./dto/create-sale-return.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("sales")
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @RequirePermissions("SALES:READ")
  list(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) { return this.sales.list(user.organizationId, branchId); }

  @Get(":id")
  @RequirePermissions("SALES:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.sales.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("SALES:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) { return this.sales.create(user.organizationId, user.sub, dto); }

  @Patch(":id/void")
  @RequirePermissions("SALES:UPDATE")
  void(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.sales.void(user.organizationId, id, user.sub); }

  @Post(":id/payments")
  @RequirePermissions("PAYMENTS:CREATE")
  pay(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreatePaymentDto) { return this.sales.recordPayment(user.organizationId, id, user.sub, dto); }

  @Post(":id/returns")
  @RequirePermissions("RETURNS:CREATE")
  ret(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateSaleReturnDto) { return this.sales.createReturn(user.organizationId, id, user.sub, dto); }
}
