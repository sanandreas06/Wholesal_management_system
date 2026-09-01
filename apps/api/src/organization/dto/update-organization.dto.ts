import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateOrganizationDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
}
