import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { OrganizationService } from "./organization.service";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organization")
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get()
  @RequirePermissions("ORGANIZATION:READ")
  get(@CurrentUser() user: AuthUser) { return this.organization.get(user.organizationId); }

  @Put()
  @RequirePermissions("ORGANIZATION:UPDATE")
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrganizationDto) { return this.organization.update(user.organizationId, dto); }
}
