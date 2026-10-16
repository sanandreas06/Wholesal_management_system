import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { AuditService } from "./audit.service";
import { AuditSealService } from "./audit-seal";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService, private readonly seal: AuditSealService) {}

  @Get("log/verify")
  @RequirePermissions("AUDIT:READ")
  verify(@CurrentUser() user: AuthUser, @Query("code") code?: string) { return this.seal.verify(user.organizationId, code); }

  @Get("flags")
  @RequirePermissions("AUDIT:READ")
  getFlags(@CurrentUser() user: AuthUser) { return this.audit.getFlags(user.organizationId); }

  @Get("log")
  @RequirePermissions("AUDIT:READ")
  getLog(@CurrentUser() user: AuthUser, @Query("entityType") entityType?: string, @Query("entityId") entityId?: string, @Query("userId") userId?: string, @Query("days") days?: string) {
    return this.audit.getLog(user.organizationId, { entityType, entityId, userId, days: Number(days) || 30 });
  }
}
