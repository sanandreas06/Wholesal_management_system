import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.category.findMany({ where:{organizationId}, orderBy:{name:"asc"}, include:{_count:{select:{products:true}}} });
  }

  async get(organizationId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where:{id,organizationId} });
    if(!category) throw new NotFoundException("Category not found");
    return category;
  }

  async create(organizationId: string, dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({ where:{organizationId,code:dto.code} });
    if(existing) throw new ConflictException(`Category code "${dto.code}" already exists`);
    return this.prisma.category.create({ data:{ ...dto, organizationId } });
  }

  async update(organizationId: string, id: string, dto: UpdateCategoryDto) {
    await this.get(organizationId, id);
    if(dto.code) {
      const existing = await this.prisma.category.findFirst({ where:{organizationId,code:dto.code,NOT:{id}} });
      if(existing) throw new ConflictException(`Category code "${dto.code}" already exists`);
    }
    return this.prisma.category.update({ where:{id}, data:dto });
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    const productCount = await this.prisma.product.count({ where:{categoryId:id} });
    if(productCount > 0) throw new ConflictException("Cannot delete a category still assigned to products");
    await this.prisma.category.delete({ where:{id} });
    return { deleted:true };
  }
}
