import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsUUID, ValidateNested } from "class-validator";
import { CreatePaymentDto } from "./create-payment.dto";
import { SaleItemInput } from "./sale-item.input";

export class CreateSaleDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemInput) items!: SaleItemInput[];
  /** Payments taken at the same moment (the counter): saved together with the sale, so a sale is never left half-recorded. */
  @IsOptional() @IsArray() @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => CreatePaymentDto) payments?: CreatePaymentDto[];
}
