import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AssignRolesDto } from "./dto/assign-roles.dto";

const userSelect = {
  id:true,email:true,name:true,status:true,branchId:true,createdAt:true,updatedAt:true,
  branch:{select:{id:true,name:true}},
  userRoles:{select:{role:{select:{id:true,name:true,code:true}}}}
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.user.findMany({ where:{organizationId}, orderBy:{name:"asc"}, select:userSelect });
  }

  async get(organizationId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where:{id,organizationId}, select:userSelect });
    if(!user) throw new NotFoundException("User not found");
    return user;
  }

  private async assertBranchBelongsToOrg(organizationId: string, branchId?: string) {
    if(!branchId) return;
    const branch = await this.prisma.branch.findFirst({ where:{id:branchId,organizationId} });
    if(!branch) throw new NotFoundException("Branch not found in this organization");
  }

  private async assertRolesBelongToOrg(organizationId: string, roleIds: string[]) {
    if(roleIds.length === 0) return;
    const count = await this.prisma.role.count({ where:{id:{in:roleIds},organizationId} });
    if(count !== roleIds.length) throw new NotFoundException("One or more roles not found in this organization");
  }

  async create(organizationId: string, dto: CreateUserDto) {
    dto.email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where:{ email:{ equals:dto.email, mode:"insensitive" } } });
    if(existing) throw new ConflictException(`Email "${dto.email}" is already in use`);
    await this.assertBranchBelongsToOrg(organizationId, dto.branchId);
    const roleIds = dto.roleIds ?? [];
    await this.assertRolesBelongToOrg(organizationId, roleIds);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data:{
        organizationId, email:dto.email, name:dto.name, passwordHash, branchId:dto.branchId, mustChangePassword:true,
        userRoles:{ create: roleIds.map(roleId=>({roleId})) }
      },
      select:userSelect
    });
    return user;
  }

  async update(organizationId: string, id: string, dto: UpdateUserDto) {
    const before = await this.get(organizationId, id);
    await this.assertBranchBelongsToOrg(organizationId, dto.branchId);
    const data: UpdateUserDto & { emailVerifiedAt?: null } = { ...dto };
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email === String(before.email).toLowerCase()) delete data.email;
      else {
        const taken = await this.prisma.user.findFirst({ where:{ email:{ equals:email, mode:"insensitive" }, NOT:{ id } }, select:{ id:true } });
        if (taken) throw new ConflictException(`Email "${email}" is already in use`);
        data.email = email; data.emailVerifiedAt = null;
      }
    }
    return this.prisma.user.update({ where:{id}, data, select:userSelect });
  }

  async assignRoles(organizationId: string, id: string, dto: AssignRolesDto) {
    await this.get(organizationId, id);
    await this.assertRolesBelongToOrg(organizationId, dto.roleIds);
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where:{userId:id} }),
      this.prisma.userRole.createMany({ data: dto.roleIds.map(roleId=>({userId:id,roleId})) })
    ]);
    return this.get(organizationId, id);
  }

  /** Sets a temporary password; the person has to replace it when they next sign in. */
  async resetPassword(organizationId: string, id: string, password: string) {
    await this.get(organizationId, id);
    await this.prisma.user.update({ where:{id}, data:{ passwordHash: await bcrypt.hash(password, 10), mustChangePassword:true } });
    return { ok: true };
  }

  async setStatus(organizationId: string, id: string, status: "ACTIVE"|"INACTIVE"|"SUSPENDED") {
    await this.get(organizationId, id);
    return this.prisma.user.update({ where:{id}, data:{status}, select:userSelect });
  }
}
