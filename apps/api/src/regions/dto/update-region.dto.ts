import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateRegionDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) code?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsIn(["ACTIVE","INACTIVE"]) status?: "ACTIVE"|"INACTIVE";
}
