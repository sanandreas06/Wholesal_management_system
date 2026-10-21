import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { AuthService, ClientInfo } from "./auth.service";
import { OAuthService, isProvider } from "./oauth.service";

class EmailStartDto { @IsEmail() @MaxLength(160) email!: string; @IsIn(["signin", "signup"]) purpose!: "signin" | "signup"; @IsOptional() @IsIn(["email", "sms"]) channel?: "email" | "sms"; }
class ForgotDto { @IsString() @MaxLength(2000) ticket!: string; }
class TicketCodeDto { @IsString() @MaxLength(2000) ticket!: string; @IsString() @MaxLength(40) code!: string; }
class ResetInfoDto { @IsString() @MaxLength(2000) token!: string; }
class ResetLinkDto { @IsString() @MaxLength(2000) token!: string; @IsString() @MinLength(8) @MaxLength(100) password!: string; @IsOptional() @IsString() @MaxLength(40) code?: string; }
class EmailCheckDto { @IsEmail() @MaxLength(160) email!: string; }
class EmailVerifyDto {
  @IsEmail() @MaxLength(160) email!: string;
  @IsIn(["signin", "signup"]) purpose!: "signin" | "signup";
  @IsOptional() @IsIn(["email", "authenticator"]) method?: "email" | "authenticator";
  @IsString() @MaxLength(40) code!: string;
  @IsOptional() @IsString() @MaxLength(2000) device?: string;
}
class MfaDto { @IsString() @MaxLength(2000) mfa!: string; @IsString() @MaxLength(40) code!: string; }
class LoginDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(2000) ticket?: string;
  @IsString() @MinLength(8) @MaxLength(100) password!: string;
  @IsOptional() @IsString() @MaxLength(2000) device?: string;
}
class ResetDto { @IsString() @MaxLength(2000) ticket!: string; @IsString() @MinLength(8) @MaxLength(100) password!: string; }
class SignupDto {
  @IsString() @MaxLength(2000) ticket!: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(8) @MaxLength(100) password!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(20) referralCode?: string;
}
class DemoDto { @IsOptional() @IsString() @MaxLength(80) company?: string; }
class ExchangeDto { @IsString() @MaxLength(2000) ticket!: string; }
class CodeDto { @IsString() @MaxLength(40) code!: string; }
class EmailChangeDto { @IsEmail() @MaxLength(160) email!: string; @IsOptional() @IsString() @MaxLength(100) password?: string; }
class EmailChangeVerifyDto { @IsEmail() @MaxLength(160) email!: string; @IsString() @MaxLength(40) code!: string; }
class DisableDto { @IsString() @MaxLength(40) code!: string; @IsOptional() @IsString() @MaxLength(100) password?: string; }

type Req = { ip?: string; headers: Record<string, string | string[] | undefined>; protocol?: string; get?: (h: string) => string | undefined };
const client = (req: Req): ClientInfo => ({ ip: req.ip, agent: String(req.headers["user-agent"] ?? "") });

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** What this site can do right now (email codes, which social providers are switched on), so the pages show only what works. */
  @Get("options") options() { return this.auth.options(); }

  @Post("email/start") @HttpCode(200) start(@Body() dto: EmailStartDto, @Req() req: Req) { return this.auth.startEmail(dto, client(req)); }
  @Post("email/check") @HttpCode(200) check(@Body() dto: EmailCheckDto, @Req() req: Req) { return this.auth.checkAccount(dto.email, client(req)); }
  @Post("email/verify") @HttpCode(200) verify(@Body() dto: EmailVerifyDto, @Req() req: Req) { return this.auth.verifyEmail(dto, client(req)); }
  @Post("authenticator") @HttpCode(200) mfa(@Body() dto: MfaDto, @Req() req: Req) { return this.auth.verifyAuthenticator(dto, client(req)); }
  @Post("login") @HttpCode(201) login(@Body() dto: LoginDto, @Req() req: Req) { return this.auth.login(dto, client(req)); }
  @Post("password/reset") @HttpCode(200) reset(@Body() dto: ResetDto, @Req() req: Req) { return this.auth.resetPassword(dto, client(req)); }
  @Post("password/forgot") @HttpCode(200) forgot(@Body() dto: ForgotDto, @Req() req: Req) { return this.auth.forgotPassword(dto, client(req)); }
  @Post("password/authenticator") @HttpCode(200) withApp(@Body() dto: TicketCodeDto, @Req() req: Req) { return this.auth.signInWithAuthenticator(dto, client(req)); }
  @Post("password/reset-info") @HttpCode(200) resetInfo(@Body() dto: ResetInfoDto) { return this.auth.resetInfo(dto); }
  @Post("password/reset-link") @HttpCode(200) resetLink(@Body() dto: ResetLinkDto, @Req() req: Req) { return this.auth.resetWithLink(dto, client(req)); }
  @Post("signup") @HttpCode(201) signup(@Body() dto: SignupDto, @Req() req: Req) { return this.auth.signup(dto, client(req)); }
  @Post("demo") @HttpCode(200) demo(@Body() dto: DemoDto, @Req() req: Req) { return this.auth.demo(client(req), dto.company); }
  @Post("oauth/exchange") @HttpCode(200) exchange(@Body() dto: ExchangeDto, @Req() req: Req) { return this.auth.exchangeOAuth(dto.ticket, client(req)); }

  /** Called by the app when someone signs out, so the Change log shows when each session ended. */
  @Post("logout") @HttpCode(200) @UseGuards(JwtAuthGuard) logout(@CurrentUser() user: AuthUser, @Req() req: Req) { return this.auth.logout(user, client(req)); }

  @Post("email-change/start") @HttpCode(200) @UseGuards(JwtAuthGuard) emailChange(@CurrentUser() u: AuthUser, @Body() dto: EmailChangeDto, @Req() req: Req) { return this.auth.emailChangeStart(u, dto, client(req)); }
  @Post("email-change/verify") @HttpCode(200) @UseGuards(JwtAuthGuard) emailChangeVerify(@CurrentUser() u: AuthUser, @Body() dto: EmailChangeVerifyDto, @Req() req: Req) { return this.auth.emailChangeVerify(u, dto, client(req)); }
  @Get("workspace") @UseGuards(JwtAuthGuard) workspace(@CurrentUser() u: AuthUser) { return this.auth.workspace(u); }
  @Get("security") @UseGuards(JwtAuthGuard) security(@CurrentUser() u: AuthUser) { return this.auth.security(u); }
  @Post("totp/setup") @HttpCode(200) @UseGuards(JwtAuthGuard) setup(@CurrentUser() u: AuthUser) { return this.auth.totpSetup(u); }
  @Post("totp/enable") @HttpCode(200) @UseGuards(JwtAuthGuard) enable(@CurrentUser() u: AuthUser, @Body() dto: CodeDto, @Req() req: Req) { return this.auth.totpEnable(u, dto.code, client(req)); }
  @Post("totp/disable") @HttpCode(200) @UseGuards(JwtAuthGuard) disable(@CurrentUser() u: AuthUser, @Body() dto: DisableDto, @Req() req: Req) { return this.auth.totpDisable(u, dto, client(req)); }
  @Post("totp/recovery") @HttpCode(200) @UseGuards(JwtAuthGuard) recovery(@CurrentUser() u: AuthUser, @Body() dto: CodeDto, @Req() req: Req) { return this.auth.newRecoveryCodes(u, dto.code, client(req)); }
}

type Res = { redirect(status: number, url: string): void; cookie(name: string, value: string, o: object): void; clearCookie(name: string, o: object): void };
const COOKIE = "wms_oauth", COOKIE_PATH = "/api/auth/oauth";
const readCookie = (h: string | string[] | undefined) => { const m = String(h ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`)); return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : undefined; };

/** The two browser redirects of "Continue with Google / Facebook / LinkedIn". */
@Controller("auth/oauth")
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}
  private redirectUri(provider: string, req: Req) {
    const base = (process.env.API_PUBLIC_URL || `${req.protocol ?? "https"}://${req.get?.("host") ?? "localhost:4000"}`).replace(/\/+$/, "");
    return `${base}/api/auth/oauth/${provider}/callback`;
  }
  @Get(":provider")
  async begin(@Param("provider") provider: string, @Query("mode") mode: string | undefined, @Query("ref") ref: string | undefined, @Query("hint") hint: string | undefined, @Req() req: Req, @Res() res: Res) {
    if (!isProvider(provider) || !this.oauth.available()[provider]) throw new NotFoundException("That sign-in method is not switched on for this site.");
    const { url, nonce } = await this.oauth.begin(provider, this.redirectUri(provider, req), { mode, ref, hint });
    res.cookie(COOKIE, nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600_000, path: COOKIE_PATH });
    res.redirect(302, url);
  }
  @Get(":provider/callback")
  async callback(@Param("provider") provider: string, @Query() q: { code?: string; state?: string; error?: string }, @Req() req: Req, @Res() res: Res) {
    if (!isProvider(provider) || !this.oauth.available()[provider]) throw new NotFoundException("That sign-in method is not switched on for this site.");
    const to = await this.oauth.finish(provider, q, readCookie(req.headers.cookie), this.redirectUri(provider, req));
    res.clearCookie(COOKIE, { path: COOKIE_PATH });
    res.redirect(302, to);
  }
}
