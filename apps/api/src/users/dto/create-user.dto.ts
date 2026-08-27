import { ArrayUnique, IsArray, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsArray() @IsUUID("4",{each:true}) @ArrayUnique() roleIds?: string[];
}
