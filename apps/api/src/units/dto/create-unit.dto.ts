import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateUnitDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) @MaxLength(30) code!: string;
}
