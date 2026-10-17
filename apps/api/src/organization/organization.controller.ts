import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { OrganizationService } from "./organization.service";
import { SetupOrganizationDto, UpdateOrganizationDto } from "./dto/update-organization.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organization")
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get()
  @RequirePermissions("ORGANIZATION:READ")
  async get(@CurrentUser() user: AuthUser) { const o = await this.organization.get(user.organizationId); return user.demo && user.demoFor ? { ...o, name: user.demoFor } : o; }

  /** Name, logo and contact details for invoices and printouts: no permission needed beyond being signed in. */
  @Get("brand")
  async brand(@CurrentUser() user: AuthUser) { const b = await this.organization.brand(user.organizationId); return user.demo && user.demoFor ? { ...b, name: user.demoFor } : b; }

  @Put()
  @RequirePermissions("ORGANIZATION:UPDATE")
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrganizationDto) { return this.organization.update(user.organizationId, dto); }

  @Put("setup")
  @RequirePermissions("ORGANIZATION:UPDATE")
  setup(@CurrentUser() user: AuthUser, @Body() dto: SetupOrganizationDto) { return this.organization.setup(user.organizationId, dto); }
}
