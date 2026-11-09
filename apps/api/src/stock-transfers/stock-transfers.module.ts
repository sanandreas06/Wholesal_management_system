import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { TrackingModule } from "../tracking/tracking.controller";
import { TripsModule } from "../trips/trips";
import { StockTransfersController } from "./stock-transfers.controller";
import { StockTransfersService } from "./stock-transfers.service";

@Module({
  imports:[InventoryModule, TrackingModule, TripsModule],
  controllers:[StockTransfersController],
  providers:[StockTransfersService]
})
export class StockTransfersModule {}
