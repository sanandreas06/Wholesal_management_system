import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, MaxLength, ValidateNested } from "class-validator";
import { SaleReturnItemInput } from "./sale-return-item.input";

export class CreateSaleReturnDto {
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleReturnItemInput) items!: SaleReturnItemInput[];
}
