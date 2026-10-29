import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from "class-validator";

export class GoodsReceiptItemInput {
  @IsUUID() purchaseOrderItemId!: string;
  @IsInt() @Min(1) quantityReceived!: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) scannedCount?: number;
}
