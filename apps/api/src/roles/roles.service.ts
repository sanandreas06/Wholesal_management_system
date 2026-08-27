import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignPermissionsDto } from "./dto/assign-permissions.dto";

const roleSelect = {
  id:true,name:true,code:true,description:true,status:true,createdAt:true,updatedAt:true,
  permissions:{select:{permission:{select:{id:true,resource:true,action:true}}}},
  _count:{select:{userRoles:true}}
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.role.findMany({ where:{organizationId}, orderBy:{name:"asc"}, select:roleSelect });
  }

  async get(organizationId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where:{id,organizationId}, select:roleSelect });
    if(!role) throw new NotFoundException("Role not found");
    return role;
  }

  async create(organizationId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findFirst({ where:{organizationId,code:dto.code} });
    if(existing) throw new ConflictException(`Role code "${dto.code}" already exists`);
    const role = await this.prisma.role.create({ data:{ ...dto, organizationId }, select:roleSelect });
    return role;
  }

  async update(organizationId: string, id: string, dto: UpdateRoleDto) {
    await this.get(organizationId, id);
    if(dto.code) {
      const existing = await this.prisma.role.findFirst({ where:{organizationId,code:dto.code,NOT:{id}} });
      if(existing) throw new ConflictException(`Role code "${dto.code}" already exists`);
    }
    return this.prisma.role.update({ where:{id}, data:dto, select:roleSelect });
  }

  async assignPermissions(organizationId: string, id: string, dto: AssignPermissionsDto) {
    await this.get(organizationId, id);
    if(dto.permissionIds.length > 0) {
      const count = await this.prisma.permission.count({ where:{id:{in:dto.permissionIds}} });
      if(count !== dto.permissionIds.length) throw new NotFoundException("One or more permissions not found");
    }
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where:{roleId:id} }),
      this.prisma.rolePermission.createMany({ data: dto.permissionIds.map(permissionId=>({roleId:id,permissionId})) })
    ]);
    return this.get(organizationId, id);
  }

  async setStatus(organizationId: string, id: string, status: "ACTIVE"|"INACTIVE") {
    await this.get(organizationId, id);
    return this.prisma.role.update({ where:{id}, data:{status}, select:roleSelect });
  }
}
