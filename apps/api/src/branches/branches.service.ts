import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.branch.findMany({ where:{organizationId}, orderBy:{name:"asc"}, include:{region:true} });
  }

  async get(organizationId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where:{id,organizationId}, include:{region:true} });
    if(!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  private async assertRegionBelongsToOrg(organizationId: string, regionId?: string) {
    if(!regionId) return;
    const region = await this.prisma.region.findFirst({ where:{id:regionId,organizationId} });
    if(!region) throw new NotFoundException("Region not found in this organization");
  }

  async create(organizationId: string, dto: CreateBranchDto) {
    await this.assertRegionBelongsToOrg(organizationId, dto.regionId);
    const existing = await this.prisma.branch.findFirst({ where:{organizationId,code:dto.code} });
    if(existing) throw new ConflictException(`Branch code "${dto.code}" already exists`);
    return this.prisma.branch.create({ data:{ ...dto, organizationId } });
  }

  async update(organizationId: string, id: string, dto: UpdateBranchDto) {
    await this.get(organizationId, id);
    await this.assertRegionBelongsToOrg(organizationId, dto.regionId);
    if(dto.code) {
      const existing = await this.prisma.branch.findFirst({ where:{organizationId,code:dto.code,NOT:{id}} });
      if(existing) throw new ConflictException(`Branch code "${dto.code}" already exists`);
    }
    return this.prisma.branch.update({ where:{id}, data:dto });
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    const userCount = await this.prisma.user.count({ where:{branchId:id} });
    if(userCount > 0) throw new ConflictException("Cannot delete a branch that still has users assigned");
    await this.prisma.branch.delete({ where:{id} });
    return { deleted:true };
  }
}
