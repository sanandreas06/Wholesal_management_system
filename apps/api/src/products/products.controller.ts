import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions("PRODUCTS:READ")
  list(@CurrentUser() user: AuthUser, @Query("lowStock") lowStock?: string) {
    return this.products.list(user.organizationId, lowStock === "true");
  }

  @Get(":id")
  @RequirePermissions("PRODUCTS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.products.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("PRODUCTS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) { return this.products.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("PRODUCTS:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProductDto) { return this.products.update(user.organizationId, id, dto); }

  @Delete(":id")
  @RequirePermissions("PRODUCTS:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.products.remove(user.organizationId, id); }
}
