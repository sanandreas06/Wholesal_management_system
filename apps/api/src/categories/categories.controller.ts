import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions("CATEGORIES:READ")
  list(@CurrentUser() user: AuthUser) { return this.categories.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("CATEGORIES:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.categories.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("CATEGORIES:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) { return this.categories.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("CATEGORIES:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCategoryDto) { return this.categories.update(user.organizationId, id, dto); }

  @Delete(":id")
  @RequirePermissions("CATEGORIES:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.categories.remove(user.organizationId, id); }
}
