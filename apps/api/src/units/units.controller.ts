import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { UnitsService } from "./units.service";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("units")
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  @RequirePermissions("UNITS:READ")
  list(@CurrentUser() user: AuthUser) { return this.units.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("UNITS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.units.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("UNITS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUnitDto) { return this.units.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("UNITS:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateUnitDto) { return this.units.update(user.organizationId, id, dto); }

  @Delete(":id")
  @RequirePermissions("UNITS:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.units.remove(user.organizationId, id); }
}
