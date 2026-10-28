import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

/** How customers pay a branch by mobile money: shown on the customer screen at the counter. Empty strings clear a field. */
export class BranchPaymentDto {
  @IsOptional() @IsString() @MaxLength(30) @Matches(/^[0-9 +\-]*$/, { message: "The mobile money number can only have digits, spaces, + and -" }) momoNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) momoName?: string;
  @IsOptional() @IsString() @MaxLength(40) momoMerchantId?: string;
  /** A picture of the QR code, already shrunk by the browser. */
  @IsOptional() @IsString() @MaxLength(200000) @Matches(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)?$/, { message: "The QR code must be a PNG, JPEG or WebP picture" }) momoQr?: string;
}
