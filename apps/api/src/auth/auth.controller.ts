import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { AuthService } from "./auth.service";
import { IsEmail, IsString, MinLength } from "class-validator";
class LoginDto { @IsEmail() email!: string; @IsString() @MinLength(8) password!: string; }
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService){}
  @Post("login") login(@Body() dto: LoginDto, @Req() req: { ip?: string; headers: Record<string, string | string[] | undefined> }){ return this.auth.login(dto, { ip: req.ip, agent: String(req.headers["user-agent"] ?? "") }); }
  /** Called by the app when someone signs out, so the Change log shows when each session ended. */
  @Post("logout") @HttpCode(200) @UseGuards(JwtAuthGuard) logout(@CurrentUser() user: AuthUser, @Req() req: { ip?: string; headers: Record<string, string | string[] | undefined> }){ return this.auth.logout(user, { ip: req.ip, agent: String(req.headers["user-agent"] ?? "") }); }
}
