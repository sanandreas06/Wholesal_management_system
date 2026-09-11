import { IsInt, IsUUID, Min } from "class-validator";

export class StockCountItemUpdate {
  @IsUUID() itemId!: string;
  @IsInt() @Min(0) countedQuantity!: number;
}
