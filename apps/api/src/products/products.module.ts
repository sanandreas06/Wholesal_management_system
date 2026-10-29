import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { QuickAddController, QuickAddService } from "./quick-add";

@Module({
  controllers:[QuickAddController, ProductsController],
  providers:[ProductsService, QuickAddService]
})
export class ProductsModule {}
