import { IsUUID, Matches } from "class-validator";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class UploadImportDto {
  @IsUUID() branchId!: string;
  @Matches(DAY, { message: "periodStart must be a date in YYYY-MM-DD format" }) periodStart!: string;
  @Matches(DAY, { message: "periodEnd must be a date in YYYY-MM-DD format" }) periodEnd!: string;
}
