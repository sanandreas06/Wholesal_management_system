import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports:[ConfigModule, AuditModule, JwtModule.registerAsync({
    global:true,
    imports:[ConfigModule],inject:[ConfigService],
    useFactory:(c:ConfigService)=>({secret:c.get("JWT_SECRET")||(process.env.NODE_ENV==="production"?(()=>{throw new Error("JWT_SECRET is not set")})():"development-secret"),signOptions:{expiresIn:c.get("JWT_EXPIRES_IN")||"1d"}})
  })],
  controllers:[AuthController], providers:[AuthService]
})
export class AuthModule {}
