import { ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { GoodsReceiptItemInput } from "./goods-receipt-item.input";

export class CreateGoodsReceiptDto {
  @IsOptional() @IsString() @MaxLength(60) supplierInvoiceNumber?: string;
  @IsOptional() @IsNumber() @Min(0) supplierInvoiceAmount?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  /** true when the goods were confirmed by scanning (each line then says how many were scanned); otherwise the count is questioned */
  @IsOptional() @IsBoolean() byScan?: boolean;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => GoodsReceiptItemInput) items!: GoodsReceiptItemInput[];
}
