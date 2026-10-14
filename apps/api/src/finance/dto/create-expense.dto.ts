import { IsNotEmpty, IsNumber, IsString, IsUUID, Matches, MaxLength, Min } from "class-validator";
import { DAY_MESSAGE, DAY_PATTERN } from "./day";

export class CreateExpenseDto {
  @IsUUID() branchId!: string;
  @IsUUID() categoryId!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsString() @IsNotEmpty() @MaxLength(300) description!: string;
  @Matches(DAY_PATTERN, { message: `expenseDate ${DAY_MESSAGE}` }) expenseDate!: string;
}
