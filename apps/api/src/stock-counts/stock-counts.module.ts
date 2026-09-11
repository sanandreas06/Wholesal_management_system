import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { StockCountsController } from "./stock-counts.controller";
import { StockCountsService } from "./stock-counts.service";

@Module({
  imports:[InventoryModule],
  controllers:[StockCountsController],
  providers:[StockCountsService]
})
export class StockCountsModule {}
