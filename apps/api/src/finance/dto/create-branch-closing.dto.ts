import { IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { DAY_MESSAGE, DAY_PATTERN } from "./day";

export class CreateBranchClosingDto {
  @IsUUID() branchId!: string;
  @Matches(DAY_PATTERN, { message: `periodStart ${DAY_MESSAGE}` }) periodStart!: string;
  @Matches(DAY_PATTERN, { message: `periodEnd ${DAY_MESSAGE}` }) periodEnd!: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}
