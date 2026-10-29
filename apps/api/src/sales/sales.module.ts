import { ReleasesModule } from "../releases/releases";
import { TrackingModule } from "../tracking/tracking.controller";
import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports:[InventoryModule, ReleasesModule, TrackingModule],
  controllers:[SalesController],
  providers:[SalesService]
})
export class SalesModule {}
