import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.customer.findMany({ where:{organizationId}, orderBy:{name:"asc"}, include:{contacts:true} });
  }

  async get(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where:{id,organizationId}, include:{contacts:true} });
    if(!customer) throw new NotFoundException("Customer not found");
    return customer;
  }

  async create(organizationId: string, dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({ where:{organizationId,code:dto.code} });
    if(existing) throw new ConflictException(`Customer code "${dto.code}" already exists`);
    return this.prisma.customer.create({ data:{ ...dto, organizationId }, include:{contacts:true} });
  }

  async update(organizationId: string, id: string, dto: UpdateCustomerDto) {
    await this.get(organizationId, id);
    if(dto.code) {
      const existing = await this.prisma.customer.findFirst({ where:{organizationId,code:dto.code,NOT:{id}} });
      if(existing) throw new ConflictException(`Customer code "${dto.code}" already exists`);
    }
    return this.prisma.customer.update({ where:{id}, data:dto, include:{contacts:true} });
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    await this.prisma.customer.delete({ where:{id} });
    return { deleted:true };
  }

  private async assertNoDuplicateContact(customerId: string, dto: { name: string; email?: string; phone?: string }, excludeContactId?: string) {
    const candidates = await this.prisma.contact.findMany({ where:{ customerId, ...(excludeContactId ? { NOT:{id:excludeContactId} } : {}) } });
    const nameLower = dto.name.trim().toLowerCase();
    const emailLower = dto.email?.trim().toLowerCase();
    const duplicate = candidates.find(c => {
      if(emailLower && c.email?.toLowerCase() === emailLower) return true;
      if(c.name.trim().toLowerCase() === nameLower && dto.phone && c.phone === dto.phone) return true;
      return false;
    });
    if(duplicate) throw new ConflictException("A contact with this name/email or name/phone already exists for this customer");
  }

  async addContact(organizationId: string, customerId: string, dto: CreateContactDto) {
    await this.get(organizationId, customerId);
    await this.assertNoDuplicateContact(customerId, dto);
    return this.prisma.contact.create({ data:{ ...dto, customerId } });
  }

  async updateContact(organizationId: string, customerId: string, contactId: string, dto: UpdateContactDto) {
    await this.get(organizationId, customerId);
    const contact = await this.prisma.contact.findFirst({ where:{id:contactId,customerId} });
    if(!contact) throw new NotFoundException("Contact not found");
    if(dto.name || dto.email || dto.phone) {
      await this.assertNoDuplicateContact(customerId, { name: dto.name ?? contact.name, email: dto.email ?? contact.email ?? undefined, phone: dto.phone ?? contact.phone ?? undefined }, contactId);
    }
    return this.prisma.contact.update({ where:{id:contactId}, data:dto });
  }

  async removeContact(organizationId: string, customerId: string, contactId: string) {
    await this.get(organizationId, customerId);
    const contact = await this.prisma.contact.findFirst({ where:{id:contactId,customerId} });
    if(!contact) throw new NotFoundException("Contact not found");
    await this.prisma.contact.delete({ where:{id:contactId} });
    return { deleted:true };
  }
}
