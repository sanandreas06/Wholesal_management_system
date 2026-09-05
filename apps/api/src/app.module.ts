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
import { OrganizationModule } from "./organization/organization.module";
import { CategoriesModule } from "./categories/categories.module";
import { BrandsModule } from "./brands/brands.module";
import { UnitsModule } from "./units/units.module";
import { ProductsModule } from "./products/products.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { CustomersModule } from "./customers/customers.module";
import { PurchaseOrdersModule } from "./purchase-orders/purchase-orders.module";

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal:true}),
    PrismaModule,
    AuthModule,
    RegionsModule,
    BranchesModule,
    OrganizationModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    CategoriesModule,
    BrandsModule,
    UnitsModule,
    ProductsModule,
    SuppliersModule,
    CustomersModule,
    PurchaseOrdersModule
  ],
  controllers: [HealthController, DashboardController],
  providers: [DashboardService]
})
export class AppModule {}
