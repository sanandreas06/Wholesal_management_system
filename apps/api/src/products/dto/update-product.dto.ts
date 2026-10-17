import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Min, MaxLength, MinLength } from "class-validator";

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) sku?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number;
  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  /** A small picture already shrunk by the browser; an empty string removes it. */
  @IsOptional() @IsString() @MaxLength(70000) @Matches(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)?$/, { message: "imageUrl must be a PNG, JPEG or WebP picture" }) imageUrl?: string;
  /** The same picture, much smaller, for lists. */
  @IsOptional() @IsString() @MaxLength(14000) @Matches(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)?$/, { message: "imageThumb must be a PNG, JPEG or WebP picture" }) imageThumb?: string;
}
