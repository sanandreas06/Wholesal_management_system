import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export enum VarianceStatusInput { INVESTIGATING = "INVESTIGATING", RESOLVED = "RESOLVED" }

export class UpdateVarianceCaseDto {
  @IsEnum(VarianceStatusInput) status!: VarianceStatusInput;
  @IsOptional() @IsString() @MaxLength(500) explanation?: string;
  @IsOptional() @IsString() @MaxLength(500) resolution?: string;
}
