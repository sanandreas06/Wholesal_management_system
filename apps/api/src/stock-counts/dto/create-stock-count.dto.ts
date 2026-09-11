import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateStockCountDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
