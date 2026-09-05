import { IsInt, IsNumber, IsUUID, Min } from "class-validator";

export class PurchaseOrderItemInput {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantityOrdered!: number;
  @IsNumber() @Min(0) unitCost!: number;
}
