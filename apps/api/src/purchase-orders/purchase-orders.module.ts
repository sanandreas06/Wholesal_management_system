import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { TrackingModule } from "../tracking/tracking.controller";
import { PurchaseOrdersController } from "./purchase-orders.controller";
import { PurchaseOrdersService } from "./purchase-orders.service";
import { ReorderController, ReorderService } from "./reorder";

@Module({
  imports:[InventoryModule, TrackingModule],
  controllers:[PurchaseOrdersController, ReorderController],
  providers:[PurchaseOrdersService, ReorderService],
  exports:[ReorderService]
})
export class PurchaseOrdersModule {}
