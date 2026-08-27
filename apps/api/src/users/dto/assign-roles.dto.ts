import { ArrayUnique, IsArray, IsUUID } from "class-validator";

export class AssignRolesDto {
  @IsArray() @IsUUID("4",{each:true}) @ArrayUnique() roleIds!: string[];
}
