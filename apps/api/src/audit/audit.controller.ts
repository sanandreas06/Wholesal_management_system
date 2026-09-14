import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { AuditService } from "./audit.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get("flags")
  @RequirePermissions("AUDIT:READ")
  getFlags(@CurrentUser() user: AuthUser) { return this.audit.getFlags(user.organizationId); }
}
