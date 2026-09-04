import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateBrandDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(30) code?: string;
}
