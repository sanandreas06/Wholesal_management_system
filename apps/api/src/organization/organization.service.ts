import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";

const orgSelect = {
  id:true,name:true,code:true,createdAt:true,updatedAt:true,
  _count:{select:{branches:true,users:true,regions:true,products:true}}
};

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where:{id:organizationId}, select:orgSelect });
    if(!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async update(organizationId: string, dto: UpdateOrganizationDto) {
    await this.get(organizationId);
    return this.prisma.organization.update({ where:{id:organizationId}, data:dto, select:orgSelect });
  }
}
