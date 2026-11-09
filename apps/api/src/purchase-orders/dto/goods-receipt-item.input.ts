import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class GoodsReceiptItemInput {
  @IsUUID() purchaseOrderItemId!: string;
  @IsInt() @Min(1) quantityReceived!: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) scannedCount?: number;
  /** item labels scanned while receiving: new goods cannot carry one already, so any known label is refused */
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @IsString({ each: true }) @MaxLength(64, { each: true }) itemCodes?: string[];
}
