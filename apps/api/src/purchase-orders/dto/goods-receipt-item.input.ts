import { IsInt, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class GoodsReceiptItemInput {
  @IsUUID() purchaseOrderItemId!: string;
  @IsInt() @Min(1) quantityReceived!: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
}
