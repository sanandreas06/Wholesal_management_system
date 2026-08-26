import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(dto:{email:string;password:string}) {
    const user = await this.prisma.user.findUnique({
      where:{email:dto.email},
      include:{
        organization:true,
        branch:true,
        userRoles:{include:{role:{include:{permissions:{include:{permission:true}}}}}}
      }
    });
    if(!user || user.status !== "ACTIVE" || !(await bcrypt.compare(dto.password,user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const roles = user.userRoles.map(ur=>ur.role.code);
    const permissions = [...new Set(
      user.userRoles.flatMap(ur=>ur.role.permissions.map(rp=>`${rp.permission.resource}:${rp.permission.action}`))
    )];
    const accessToken = await this.jwt.signAsync({
      sub:user.id,email:user.email,organizationId:user.organizationId,branchId:user.branchId,
      roles,permissions
    });
    return {
      accessToken,
      user:{id:user.id,name:user.name,email:user.email,organization:user.organization.name,branch:user.branch?.name??null,roles,permissions}
    };
  }
}
