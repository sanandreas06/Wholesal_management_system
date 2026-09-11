import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { StockCountItemUpdate } from "./stock-count-item-update.input";

export class UpdateStockCountItemsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => StockCountItemUpdate) items!: StockCountItemUpdate[];
}
