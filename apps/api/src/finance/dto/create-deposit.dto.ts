import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from "class-validator";
import { DAY_MESSAGE, DAY_PATTERN } from "./day";

export enum DepositMethodInput { CASH = "CASH", BANK = "BANK", MOBILE_MONEY = "MOBILE_MONEY" }

export class CreateDepositDto {
  @IsUUID() branchId!: string;
  @IsEnum(DepositMethodInput) method!: DepositMethodInput;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @Matches(DAY_PATTERN, { message: `depositDate ${DAY_MESSAGE}` }) depositDate!: string;
}
