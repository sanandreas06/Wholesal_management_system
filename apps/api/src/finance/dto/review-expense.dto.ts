import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewExpenseDto {
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
