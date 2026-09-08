import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { StockTransfersController } from "./stock-transfers.controller";
import { StockTransfersService } from "./stock-transfers.service";

@Module({
  imports:[InventoryModule],
  controllers:[StockTransfersController],
  providers:[StockTransfersService]
})
export class StockTransfersModule {}
