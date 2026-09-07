import { IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Validate, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

@ValidatorConstraint({ name: "nonZero", async: false })
class NonZeroConstraint implements ValidatorConstraintInterface {
  validate(value: number) { return typeof value === "number" && value !== 0; }
  defaultMessage() { return "quantityDelta cannot be zero"; }
}

export class CreateStockAdjustmentDto {
  @IsUUID() productId!: string;
  @IsUUID() branchId!: string;
  @IsInt() @Validate(NonZeroConstraint) quantityDelta!: number; // positive to add stock, negative to remove
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string;
}
