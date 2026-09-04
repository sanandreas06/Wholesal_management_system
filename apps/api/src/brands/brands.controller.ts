import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { BrandsService } from "./brands.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("brands")
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @RequirePermissions("BRANDS:READ")
  list(@CurrentUser() user: AuthUser) { return this.brands.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("BRANDS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.brands.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("BRANDS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBrandDto) { return this.brands.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("BRANDS:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateBrandDto) { return this.brands.update(user.organizationId, id, dto); }

  @Delete(":id")
  @RequirePermissions("BRANDS:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.brands.remove(user.organizationId, id); }
}
