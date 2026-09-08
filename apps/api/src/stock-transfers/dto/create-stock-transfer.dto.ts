import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { StockTransferItemInput } from "./stock-transfer-item.input";

export class CreateStockTransferDto {
  @IsUUID() fromBranchId!: string;
  @IsUUID() toBranchId!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => StockTransferItemInput) items!: StockTransferItemInput[];
}
