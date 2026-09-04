import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(40) sku!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number;
  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
}
