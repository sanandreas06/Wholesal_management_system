import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { TrackingModule } from "../tracking/tracking.controller";
import { StockTransfersController } from "./stock-transfers.controller";
import { StockTransfersService } from "./stock-transfers.service";

@Module({
  imports:[InventoryModule, TrackingModule],
  controllers:[StockTransfersController],
  providers:[StockTransfersService]
})
export class StockTransfersModule {}
