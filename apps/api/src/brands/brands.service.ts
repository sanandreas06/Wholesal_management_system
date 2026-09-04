import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.brand.findMany({ where:{organizationId}, orderBy:{name:"asc"}, include:{_count:{select:{products:true}}} });
  }

  async get(organizationId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({ where:{id,organizationId} });
    if(!brand) throw new NotFoundException("Brand not found");
    return brand;
  }

  async create(organizationId: string, dto: CreateBrandDto) {
    const existing = await this.prisma.brand.findFirst({ where:{organizationId,code:dto.code} });
    if(existing) throw new ConflictException(`Brand code "${dto.code}" already exists`);
    return this.prisma.brand.create({ data:{ ...dto, organizationId } });
  }

  async update(organizationId: string, id: string, dto: UpdateBrandDto) {
    await this.get(organizationId, id);
    if(dto.code) {
      const existing = await this.prisma.brand.findFirst({ where:{organizationId,code:dto.code,NOT:{id}} });
      if(existing) throw new ConflictException(`Brand code "${dto.code}" already exists`);
    }
    return this.prisma.brand.update({ where:{id}, data:dto });
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    const productCount = await this.prisma.product.count({ where:{brandId:id} });
    if(productCount > 0) throw new ConflictException("Cannot delete a brand still assigned to products");
    await this.prisma.brand.delete({ where:{id} });
    return { deleted:true };
  }
}
