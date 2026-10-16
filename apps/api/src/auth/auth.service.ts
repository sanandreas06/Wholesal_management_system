import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { AuditSealService } from "../audit/audit-seal";
import { AuthUser } from "../common/types/auth-user.type";
import { NO_BRANCH } from "../common/branch/branch-scope";

export interface ClientInfo { ip?: string; agent?: string }
/** "Chrome on Windows"-style label from a user-agent string; only what a person would recognise, never the raw string. */
export function deviceLabel(agent = ""): string {
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\/|Opera/.test(agent) ? "Opera" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Unknown browser";
  const os = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad|iOS/.test(agent) ? "iOS" : /Mac OS X|Macintosh/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "unknown device";
  return `${browser} on ${os}`;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger("Auth");
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly seal: AuditSealService) {}

  /** Writes a sign-in/sign-out line to the sealed Change log. Never blocks or fails the request. */
  private async record(u: { id: string; email: string; organizationId: string }, action: string, summary: string, c: ClientInfo) {
    try {
      await this.seal.append({ organizationId: u.organizationId, userId: u.id, userName: u.email, action, entityType: "Sign-in", entityId: u.id, summary, changes: { request: { device: deviceLabel(c.agent), ip: c.ip ?? null } } });
    } catch (e) { this.log.warn(`could not record ${action}: ${(e as Error).message}`); }
  }

  async logout(user: AuthUser, c: ClientInfo) {
    await this.record({ id: user.sub, email: user.email, organizationId: user.organizationId }, "SIGN OUT", "Signed out", c);
    return { ok: true };
  }

  async login(dto:{email:string;password:string}, client: ClientInfo = {}) {
    const user = await this.prisma.user.findUnique({
      where:{email:dto.email},
      include:{
        organization:true,
        branch:true,
        userRoles:{include:{role:{include:{permissions:{include:{permission:true}}}}}}
      }
    });
    const passwordOk = !!user && await bcrypt.compare(dto.password, user.passwordHash);
    if(!user || user.status !== "ACTIVE" || !passwordOk) {
      // Failed attempts on a real account are logged (the person is told nothing extra). Capped so a guessing script cannot flood the log.
      if (user) {
        const recent = await this.prisma.auditLog.count({ where: { organizationId: user.organizationId, entityType: "Sign-in", entityId: user.id, action: "FAILED SIGN-IN", createdAt: { gte: new Date(Date.now() - 600_000) } } }).catch(() => 99);
        if (recent < 10) await this.record(user, "FAILED SIGN-IN", user.status !== "ACTIVE" && passwordOk ? "Sign-in refused: account is not active" : "Failed sign-in: wrong password", client);
      }
      throw new UnauthorizedException("Invalid credentials");
    }
    await this.record(user, "SIGN IN", "Signed in", client);
    const roles = user.userRoles.map(ur=>ur.role.code);
    const permissions = [...new Set(
      user.userRoles.flatMap(ur=>ur.role.permissions.map(rp=>`${rp.permission.resource}:${rp.permission.action}`))
    )];
    // A role marked "limit to own branch" keeps the person to their branch (to nothing at all if they have no branch).
    const restricted = user.userRoles.some(ur=>ur.role.branchRestricted);
    const branchScope = restricted ? (user.branchId ?? NO_BRANCH) : null;
    const accessToken = await this.jwt.signAsync({
      sub:user.id,email:user.email,organizationId:user.organizationId,branchId:user.branchId,branchScope,
      roles,permissions
    });
    return {
      accessToken,
      mustChangePassword:user.mustChangePassword,
      user:{id:user.id,name:user.name,email:user.email,organization:user.organization.name,branch:user.branch?.name??null,branchScope,roles,permissions}
    };
  }
}
