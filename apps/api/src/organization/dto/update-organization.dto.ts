import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";

export const CURRENCIES = ["GHS", "NGN", "USD", "EUR", "GBP", "XOF", "XAF", "KES", "UGX", "TZS", "ZAR", "RWF", "ZMW", "EGP", "MAD", "CAD", "AUD", "INR", "CNY", "AED"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const LANGUAGES = ["en"];
// a small picture already shrunk by the browser, kept inside the 100 kB request limit
export const LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Fields an owner can change in Settings. Every one is optional here; an empty string clears the text fields. */
export class UpdateOrganizationDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(80) industry?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(80) stateProvince?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ValidateIf((o) => o.email !== undefined && o.email !== "") @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsString() @MaxLength(60) taxId?: string;
  @IsOptional() @IsIn(CURRENCIES) currency?: string;
  @IsOptional() @IsIn(LANGUAGES) language?: string;
  @IsOptional() @IsString() @MaxLength(64) timeZone?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "inventoryStartDate must look like 2026-01-31" }) inventoryStartDate?: string;
  @IsOptional() @IsIn(MONTHS) fiscalYearStart?: string;
  /** empty string removes the logo */
  @IsOptional() @IsString() @MaxLength(90000) logo?: string;
}

/** The "Set up your organization profile" screen: the same fields, but the ones marked * on that screen must be there. */
export class SetupOrganizationDto extends UpdateOrganizationDto {
  @IsString() @MinLength(2) @MaxLength(160) declare name: string;
  @IsString() @MinLength(2) @MaxLength(80) declare country: string;
  @IsIn(CURRENCIES) declare currency: string;
  @IsIn(LANGUAGES) declare language: string;
  @IsString() @MaxLength(64) declare timeZone: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "inventoryStartDate must look like 2026-01-31" }) declare inventoryStartDate: string;
  @IsIn(MONTHS) declare fiscalYearStart: string;
}
