import { IsInt, IsNumber, IsUUID, Min } from "class-validator";

export class SaleItemInput {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
}
