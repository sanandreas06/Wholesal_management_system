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
import { ProfileModule } from "./profile/profile";
import { SavedViewsModule } from "./saved-views/saved-views";
import { BranchScopeModule } from "./common/branch/branch-scope";
import { SearchModule } from "./search/search";
import { InsightsModule } from "./insights/investment";
import { PurchaseOrdersModule } from "./purchase-orders/purchase-orders.module";
import { InventoryModule } from "./inventory/inventory.module";
import { StockAdjustmentsModule } from "./stock-adjustments/stock-adjustments.module";
import { StockTransfersModule } from "./stock-transfers/stock-transfers.module";
import { StockCountsModule } from "./stock-counts/stock-counts.module";
import { AuditModule } from "./audit/audit.module";
import { SalesModule } from "./sales/sales.module";
import { FinanceModule } from "./finance/finance.module";
import { ExcelImportsModule } from "./excel-imports/excel-imports.module";
import { NotificationsModule } from "./notifications/notifications";

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal:true,envFilePath:[".env","../../.env"]}),
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
    PurchaseOrdersModule,
    InsightsModule,
    SearchModule,
    ProfileModule,
    SavedViewsModule,
    BranchScopeModule,
    InventoryModule,
    StockAdjustmentsModule,
    StockTransfersModule,
    StockCountsModule,
    AuditModule,
    SalesModule,
    FinanceModule,
    ExcelImportsModule, NotificationsModule],
  controllers: [HealthController, DashboardController],
  providers: [DashboardService]
})
export class AppModule {}
