import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthUser } from "../types/auth-user.type";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers["authorization"];
    if (!header || !header.startsWith("Bearer ")) throw new UnauthorizedException("Missing bearer token");
    const token = header.slice(7);
    let payload: AuthUser;
    try {
      payload = await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    // a ticket from a sign-in step is signed with a different key, so it never gets this far; this is a second check that it is a real session token
    if (!payload?.sub || !Array.isArray(payload.permissions)) throw new UnauthorizedException("Invalid or expired token");
    req.user = payload;
    // the shared demo company can be looked at but never changed (signing out and talking to the assistant are the only things it may post)
    const path = String(req.originalUrl ?? "").split("?")[0];
    if (payload.demo && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !path.endsWith("/auth/logout") && !path.endsWith("/assistant/app")) {
      throw new ForbiddenException("This is the demo, so it is read-only. Create your own account to try this for real.");
    }
    return true;
  }
}
