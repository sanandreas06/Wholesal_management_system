import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsUUID, ValidateNested } from "class-validator";
import { SaleItemInput } from "./sale-item.input";

export class CreateSaleDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemInput) items!: SaleItemInput[];
}
