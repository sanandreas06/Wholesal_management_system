import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

export class UpdateContactDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) role?: string;
  @IsOptional() @IsString() @Matches(PHONE_PATTERN, { message: "phone must be a valid phone number (digits, spaces, +, -, parentheses only)" }) phone?: string;
  @IsOptional() @IsEmail({}, { message: "email must be a valid email address" }) email?: string;
}
