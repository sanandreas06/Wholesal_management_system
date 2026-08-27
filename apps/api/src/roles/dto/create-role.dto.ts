import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateRoleDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) @MaxLength(20) code!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
