import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { PurchaseOrderItemInput } from "./purchase-order-item.input";

export class CreatePurchaseOrderDto {
  @IsUUID() supplierId!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseOrderItemInput) items!: PurchaseOrderItemInput[];
}
