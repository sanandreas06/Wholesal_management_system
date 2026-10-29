import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class SaleItemInput {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
  /** For products with a label on each item: the labels scanned at the counter (one per item sold). */
  @IsOptional() @IsArray() @ArrayMaxSize(2000) @IsString({ each: true }) @MaxLength(64, { each: true }) itemCodes?: string[];
  /** how many of this line were scanned at the counter */
  @IsOptional() @IsInt() @Min(0) @Max(100000) scanned?: number;
}
