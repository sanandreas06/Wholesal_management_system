import { Module } from "@nestjs/common";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";
import { RoleTemplates } from "./role-templates";

@Module({
  controllers:[RolesController],
  providers:[RolesService, RoleTemplates]
})
export class RolesModule {}
