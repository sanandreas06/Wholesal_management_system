import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.unit.findMany({ where:{organizationId}, orderBy:{name:"asc"}, include:{_count:{select:{products:true}}} });
  }

  async get(organizationId: string, id: string) {
    const unit = await this.prisma.unit.findFirst({ where:{id,organizationId} });
    if(!unit) throw new NotFoundException("Unit not found");
    return unit;
  }

  async create(organizationId: string, dto: CreateUnitDto) {
    const existing = await this.prisma.unit.findFirst({ where:{organizationId,code:dto.code} });
    if(existing) throw new ConflictException(`Unit code "${dto.code}" already exists`);
    return this.prisma.unit.create({ data:{ ...dto, organizationId } });
  }

  async update(organizationId: string, id: string, dto: UpdateUnitDto) {
    await this.get(organizationId, id);
    if(dto.code) {
      const existing = await this.prisma.unit.findFirst({ where:{organizationId,code:dto.code,NOT:{id}} });
      if(existing) throw new ConflictException(`Unit code "${dto.code}" already exists`);
    }
    return this.prisma.unit.update({ where:{id}, data:dto });
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    const productCount = await this.prisma.product.count({ where:{unitId:id} });
    if(productCount > 0) throw new ConflictException("Cannot delete a unit still assigned to products");
    await this.prisma.unit.delete({ where:{id} });
    return { deleted:true };
  }
}
