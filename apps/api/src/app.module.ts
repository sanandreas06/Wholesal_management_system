import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health.controller";
import { AuthModule } from "./auth/auth.module";
import { DashboardController, DashboardService } from "./dashboard";

@Module({
  imports: [ConfigModule.forRoot({isGlobal:true}), PrismaModule, AuthModule],
  controllers: [HealthController, DashboardController],
  providers: [DashboardService]
})
export class AppModule {}
