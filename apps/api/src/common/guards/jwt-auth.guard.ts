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
    // the shared demo company can be looked at but never changed (signing out is the one thing it may post)
    if (payload.demo && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !String(req.originalUrl ?? "").split("?")[0].endsWith("/auth/logout")) {
      throw new ForbiddenException("This is the demo, so it is read-only. Create your own account to try this for real.");
    }
    return true;
  }
}
