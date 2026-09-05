import { IsEmail, IsNumber, IsInt, IsOptional, IsString, Matches, Min, MaxLength, MinLength } from "class-validator";

const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

export class CreateSupplierDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString() @MinLength(1) @MaxLength(30) code!: string;
  @IsOptional() @IsString() @Matches(PHONE_PATTERN, { message: "phone must be a valid phone number (digits, spaces, +, -, parentheses only)" }) phone?: string;
  @IsOptional() @IsEmail({}, { message: "email must be a valid email address" }) email?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @IsOptional() @IsInt() @Min(0) creditDays?: number;
}
