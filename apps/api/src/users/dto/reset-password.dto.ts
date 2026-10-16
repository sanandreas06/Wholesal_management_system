import { IsString, MaxLength, MinLength } from "class-validator";

/** A temporary password an administrator hands to someone; they are made to choose their own at next sign-in. */
export class ResetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
}
