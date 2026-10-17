import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  /** an administrator can correct a person's sign-in email; codes then go to the new address */
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsIn(["ACTIVE","INACTIVE","SUSPENDED"]) status?: "ACTIVE"|"INACTIVE"|"SUSPENDED";
}
