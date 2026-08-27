import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions("BRANCHES:READ")
  list(@CurrentUser() user: AuthUser) { return this.branches.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("BRANCHES:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.branches.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("BRANCHES:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) { return this.branches.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("BRANCHES:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateBranchDto) { return this.branches.update(user.organizationId, id, dto); }

  @Delete(":id")
  @RequirePermissions("BRANCHES:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.branches.remove(user.organizationId, id); }
}
