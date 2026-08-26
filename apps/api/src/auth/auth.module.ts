import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports:[ConfigModule, PassportModule, JwtModule.registerAsync({
    global:true,
    imports:[ConfigModule],inject:[ConfigService],
    useFactory:(c:ConfigService)=>({secret:c.get("JWT_SECRET")||"development-secret",signOptions:{expiresIn:c.get("JWT_EXPIRES_IN")||"1d"}})
  })],
  controllers:[AuthController], providers:[AuthService, JwtStrategy]
})
export class AuthModule {}
