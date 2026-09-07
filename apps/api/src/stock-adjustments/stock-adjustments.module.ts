import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { StockAdjustmentsController } from "./stock-adjustments.controller";
import { StockAdjustmentsService } from "./stock-adjustments.service";

@Module({
  imports:[InventoryModule],
  controllers:[StockAdjustmentsController],
  providers:[StockAdjustmentsService]
})
export class StockAdjustmentsModule {}
