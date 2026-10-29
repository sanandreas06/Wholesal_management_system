import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from "class-validator";
import { CreatePaymentDto } from "./create-payment.dto";
import { SaleItemInput } from "./sale-item.input";

export class CreateSaleDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemInput) items!: SaleItemInput[];
  /** Payments taken at the same moment (the counter): saved together with the sale, so a sale is never left half-recorded. */
  @IsOptional() @IsArray() @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => CreatePaymentDto) payments?: CreatePaymentDto[];
  /**
   * "now": the customer takes the goods at once (the counter); each line says how many were scanned.
   * "later": the goods stay in the store until they are collected or delivered, and leave by scanning (Scan, Release to customer).
   * Left out (older screens): taken as handed over, as before.
   */
  @IsOptional() @IsIn(["now", "later"]) handover?: "now" | "later";
  /** why some items were not scanned (handover "now") */
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  /** A code the counter makes for each sale. Sending the same sale twice (a retry after a dropped connection) saves it once. */
  @IsOptional() @IsUUID() clientRef?: string;
  /** The sale was made while the internet was down: these carry the real time of the sale and the receipt's QR code. */
  @IsOptional() @IsBoolean() offline?: boolean;
  @IsOptional() @IsDateString() soldAt?: string;
  @IsOptional() @Matches(/^[2-9A-HJKMNP-Z]{16}$/) confirmToken?: string;
}
