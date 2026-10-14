import { IsInt, IsUUID, Min } from "class-validator";

export class SaleReturnItemInput {
  @IsUUID() saleItemId!: string;
  @IsInt() @Min(1) quantity!: number;
}
