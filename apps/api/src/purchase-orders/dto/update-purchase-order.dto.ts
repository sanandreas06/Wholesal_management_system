import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { PurchaseOrderItemInput } from "./purchase-order-item.input";

export class UpdatePurchaseOrderDto {
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseOrderItemInput) items?: PurchaseOrderItemInput[];
}
