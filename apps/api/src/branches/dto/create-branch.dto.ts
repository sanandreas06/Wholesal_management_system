import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateBranchDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) @MaxLength(20) code!: string;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsUUID() regionId?: string;
}
