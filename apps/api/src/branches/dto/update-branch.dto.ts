import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateBranchDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) code?: string;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsUUID() regionId?: string;
}
