import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { GoodsReceiptItemInput } from "./goods-receipt-item.input";

export class CreateGoodsReceiptDto {
  @IsOptional() @IsString() @MaxLength(60) supplierInvoiceNumber?: string;
  @IsOptional() @IsNumber() @Min(0) supplierInvoiceAmount?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => GoodsReceiptItemInput) items!: GoodsReceiptItemInput[];
}
