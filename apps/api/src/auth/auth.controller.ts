import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { IsEmail, IsString, MinLength } from "class-validator";
class LoginDto { @IsEmail() email!: string; @IsString() @MinLength(8) password!: string; }
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService){}
  @Post("login") login(@Body() dto: LoginDto){ return this.auth.login(dto); }
}
