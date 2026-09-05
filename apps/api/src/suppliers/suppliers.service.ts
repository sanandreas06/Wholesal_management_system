import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.supplier.findMany({ where:{organizationId}, orderBy:{name:"asc"}, include:{contacts:true} });
  }

  async get(organizationId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where:{id,organizationId}, include:{contacts:true} });
    if(!supplier) throw new NotFoundException("Supplier not found");
    return supplier;
  }

  async create(organizationId: string, dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({ where:{organizationId,code:dto.code} });
    if(existing) throw new ConflictException(`Supplier code "${dto.code}" already exists`);
    return this.prisma.supplier.create({ data:{ ...dto, organizationId }, include:{contacts:true} });
  }

  async update(organizationId: string, id: string, dto: UpdateSupplierDto) {
    await this.get(organizationId, id);
    if(dto.code) {
      const existing = await this.prisma.supplier.findFirst({ where:{organizationId,code:dto.code,NOT:{id}} });
      if(existing) throw new ConflictException(`Supplier code "${dto.code}" already exists`);
    }
    return this.prisma.supplier.update({ where:{id}, data:dto, include:{contacts:true} });
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    await this.prisma.supplier.delete({ where:{id} });
    return { deleted:true };
  }

  private async assertNoDuplicateContact(supplierId: string, dto: { name: string; email?: string; phone?: string }, excludeContactId?: string) {
    const candidates = await this.prisma.contact.findMany({ where:{ supplierId, ...(excludeContactId ? { NOT:{id:excludeContactId} } : {}) } });
    const nameLower = dto.name.trim().toLowerCase();
    const emailLower = dto.email?.trim().toLowerCase();
    const duplicate = candidates.find(c => {
      if(emailLower && c.email?.toLowerCase() === emailLower) return true;
      if(c.name.trim().toLowerCase() === nameLower && dto.phone && c.phone === dto.phone) return true;
      return false;
    });
    if(duplicate) throw new ConflictException("A contact with this name/email or name/phone already exists for this supplier");
  }

  async addContact(organizationId: string, supplierId: string, dto: CreateContactDto) {
    await this.get(organizationId, supplierId);
    await this.assertNoDuplicateContact(supplierId, dto);
    return this.prisma.contact.create({ data:{ ...dto, supplierId } });
  }

  async updateContact(organizationId: string, supplierId: string, contactId: string, dto: UpdateContactDto) {
    await this.get(organizationId, supplierId);
    const contact = await this.prisma.contact.findFirst({ where:{id:contactId,supplierId} });
    if(!contact) throw new NotFoundException("Contact not found");
    if(dto.name || dto.email || dto.phone) {
      await this.assertNoDuplicateContact(supplierId, { name: dto.name ?? contact.name, email: dto.email ?? contact.email ?? undefined, phone: dto.phone ?? contact.phone ?? undefined }, contactId);
    }
    return this.prisma.contact.update({ where:{id:contactId}, data:dto });
  }

  async removeContact(organizationId: string, supplierId: string, contactId: string) {
    await this.get(organizationId, supplierId);
    const contact = await this.prisma.contact.findFirst({ where:{id:contactId,supplierId} });
    if(!contact) throw new NotFoundException("Contact not found");
    await this.prisma.contact.delete({ where:{id:contactId} });
    return { deleted:true };
  }
}
