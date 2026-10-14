import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export enum PaymentMethodInput { CASH = "CASH", BANK = "BANK", MOBILE_MONEY = "MOBILE_MONEY", CREDIT = "CREDIT" }

export class CreatePaymentDto {
  @IsEnum(PaymentMethodInput) method!: PaymentMethodInput;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() @MaxLength(60) reference?: string;
}
