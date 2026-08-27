import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AssignRolesDto } from "./dto/assign-roles.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions("USERS:READ")
  list(@CurrentUser() user: AuthUser) { return this.users.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("USERS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.users.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("USERS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) { return this.users.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("USERS:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateUserDto) { return this.users.update(user.organizationId, id, dto); }

  @Put(":id/roles")
  @RequirePermissions("USERS:UPDATE")
  assignRoles(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AssignRolesDto) { return this.users.assignRoles(user.organizationId, id, dto); }

  @Patch(":id/activate")
  @RequirePermissions("USERS:UPDATE")
  activate(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.users.setStatus(user.organizationId, id, "ACTIVE"); }

  @Patch(":id/deactivate")
  @RequirePermissions("USERS:UPDATE")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.users.setStatus(user.organizationId, id, "INACTIVE"); }
}
