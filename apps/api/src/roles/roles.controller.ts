import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignPermissionsDto } from "./dto/assign-permissions.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions("ROLES:READ")
  list(@CurrentUser() user: AuthUser) { return this.roles.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("ROLES:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.roles.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("ROLES:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) { return this.roles.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("ROLES:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateRoleDto) { return this.roles.update(user.organizationId, id, dto); }

  @Put(":id/permissions")
  @RequirePermissions("ROLES:UPDATE")
  assignPermissions(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AssignPermissionsDto) { return this.roles.assignPermissions(user.organizationId, id, dto); }

  @Patch(":id/activate")
  @RequirePermissions("ROLES:UPDATE")
  activate(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.roles.setStatus(user.organizationId, id, "ACTIVE"); }

  @Patch(":id/deactivate")
  @RequirePermissions("ROLES:UPDATE")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.roles.setStatus(user.organizationId, id, "INACTIVE"); }
}
