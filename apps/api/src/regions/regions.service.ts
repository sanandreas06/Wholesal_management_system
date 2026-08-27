import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRegionDto } from "./dto/create-region.dto";
import { UpdateRegionDto } from "./dto/update-region.dto";

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.region.findMany({ where:{organizationId}, orderBy:{name:"asc"}, include:{_count:{select:{branches:true}}} });
  }

  async get(organizationId: string, id: string) {
    const region = await this.prisma.region.findFirst({ where:{id,organizationId}, include:{branches:true} });
    if(!region) throw new NotFoundException("Region not found");
    return region;
  }

  async create(organizationId: string, dto: CreateRegionDto) {
    const existing = await this.prisma.region.findFirst({ where:{organizationId,code:dto.code} });
    if(existing) throw new ConflictException(`Region code "${dto.code}" already exists`);
    return this.prisma.region.create({ data:{ ...dto, organizationId } });
  }

  async update(organizationId: string, id: string, dto: UpdateRegionDto) {
    await this.get(organizationId, id);
    if(dto.code) {
      const existing = await this.prisma.region.findFirst({ where:{organizationId,code:dto.code,NOT:{id}} });
      if(existing) throw new ConflictException(`Region code "${dto.code}" already exists`);
    }
    return this.prisma.region.update({ where:{id}, data:dto });
  }

  async remove(organizationId: string, id: string) {
    const region = await this.get(organizationId, id);
    if(region.branches.length > 0) throw new ConflictException("Cannot delete a region that still has branches assigned");
    await this.prisma.region.delete({ where:{id} });
    return { deleted:true };
  }
}
