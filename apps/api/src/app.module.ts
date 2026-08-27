import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health.controller";
import { AuthModule } from "./auth/auth.module";
import { DashboardController, DashboardService } from "./dashboard";
import { RegionsModule } from "./regions/regions.module";
import { BranchesModule } from "./branches/branches.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { PermissionsModule } from "./permissions/permissions.module";

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal:true}),
    PrismaModule,
    AuthModule,
    RegionsModule,
    BranchesModule,
    UsersModule,
    RolesModule,
    PermissionsModule
  ],
  controllers: [HealthController, DashboardController],
  providers: [DashboardService]
})
export class AppModule {}
