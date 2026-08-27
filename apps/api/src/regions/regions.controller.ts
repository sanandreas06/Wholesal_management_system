import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { RegionsService } from "./regions.service";
import { CreateRegionDto } from "./dto/create-region.dto";
import { UpdateRegionDto } from "./dto/update-region.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("regions")
export class RegionsController {
  constructor(private readonly regions: RegionsService) {}

  @Get()
  @RequirePermissions("REGIONS:READ")
  list(@CurrentUser() user: AuthUser) { return this.regions.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("REGIONS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.regions.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("REGIONS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRegionDto) { return this.regions.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("REGIONS:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateRegionDto) { return this.regions.update(user.organizationId, id, dto); }

  @Delete(":id")
  @RequirePermissions("REGIONS:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.regions.remove(user.organizationId, id); }
}
