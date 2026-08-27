import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports:[ConfigModule, JwtModule.registerAsync({
    global:true,
    imports:[ConfigModule],inject:[ConfigService],
    useFactory:(c:ConfigService)=>({secret:c.get("JWT_SECRET")||"development-secret",signOptions:{expiresIn:c.get("JWT_EXPIRES_IN")||"1d"}})
  })],
  controllers:[AuthController], providers:[AuthService]
})
export class AuthModule {}
