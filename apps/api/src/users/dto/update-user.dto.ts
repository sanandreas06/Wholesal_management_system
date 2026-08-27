import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsIn(["ACTIVE","INACTIVE","SUSPENDED"]) status?: "ACTIVE"|"INACTIVE"|"SUSPENDED";
}
