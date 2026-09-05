import { IsEmail, IsIn, IsNumber, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from "class-validator";

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(30) code?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @IsOptional() @IsInt() @Min(0) creditDays?: number;
  @IsOptional() @IsIn(["ACTIVE","INACTIVE"]) status?: "ACTIVE"|"INACTIVE";
}
