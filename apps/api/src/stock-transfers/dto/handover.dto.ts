import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

/** One transfer line as counted at the door: how many, how many of those were scanned, and the item labels for tracked products. */
export class HandoverLineInput {
  @IsUUID() itemId!: string;
  @IsInt() @Min(0) @Max(100000) quantity!: number;
  @IsInt() @Min(0) @Max(100000) scanned!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @IsString({ each: true }) @MaxLength(64, { each: true }) codes?: string[];
}

/** Sending or receiving a transfer. Without lines, everything is taken as counted by hand (and questioned). */
export class HandoverDto {
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => HandoverLineInput) lines?: HandoverLineInput[];
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
