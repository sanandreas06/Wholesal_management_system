import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { ProductsService } from "./products.service";
import { scopeOf } from "../common/branch/branch-scope";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions("PRODUCTS:READ")
  list(@CurrentUser() user: AuthUser, @Query("lowStock") lowStock?: string, @Query("branchId") branchId?: string) {
    // ?branchId= shows that branch's stock on each product (the counter); a person limited to one branch always gets their own
    return this.products.list(user.organizationId, lowStock === "true", user.permissions.includes("PROFIT:READ"), scopeOf(user) ?? branchId ?? null);
  }

  /** What a scanned barcode is. `branchId` gives that branch's stock (a person limited to one branch always gets their own). */
  @Get("lookup")
  @RequirePermissions("PRODUCTS:READ")
  lookup(@CurrentUser() user: AuthUser, @Query("code") code: string, @Query("branchId") branchId?: string) {
    return this.products.lookup(user.organizationId, code, scopeOf(user) ?? branchId ?? null, user.permissions.includes("PROFIT:READ"));
  }

  @Get(":id")
  @RequirePermissions("PRODUCTS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.products.get(user.organizationId, id, user.permissions.includes("PROFIT:READ"), scopeOf(user)); }

  @Post()
  @RequirePermissions("PRODUCTS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) { return this.products.create(user.organizationId, dto, user.permissions.includes("PROFIT:READ")); }

  @Put(":id")
  @RequirePermissions("PRODUCTS:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProductDto) { return this.products.update(user.organizationId, id, dto, user.permissions.includes("PROFIT:READ")); }

  @Delete(":id")
  @RequirePermissions("PRODUCTS:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.products.remove(user.organizationId, id); }
}
