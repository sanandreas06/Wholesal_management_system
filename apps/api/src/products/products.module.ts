import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { QuickAddController, QuickAddService } from "./quick-add";
import { OwnCodeBackfill } from "./own-code";

@Module({
  controllers:[QuickAddController, ProductsController],
  providers:[ProductsService, QuickAddService, OwnCodeBackfill]
})
export class ProductsModule {}
