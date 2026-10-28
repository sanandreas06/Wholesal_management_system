import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Min, MaxLength, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(40) sku!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number;
  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  /** A small picture already shrunk by the browser; an empty string removes it. */
  @IsOptional() @IsString() @MaxLength(70000) @Matches(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)?$/, { message: "imageUrl must be a PNG, JPEG or WebP picture" }) imageUrl?: string;
  /** The same picture, much smaller, for lists. */
  @IsOptional() @IsString() @MaxLength(14000) @Matches(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)?$/, { message: "imageThumb must be a PNG, JPEG or WebP picture" }) imageThumb?: string;
  /** Barcodes on the product (maker's EAN/UPC, or a WHOLESTRA label). Scanning any of them finds the product. */
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(64, { each: true }) @Matches(/^[\x21-\x7E]+$/, { each: true, message: "A barcode can only contain letters, digits and symbols, with no spaces" }) barcodes?: string[];
}
