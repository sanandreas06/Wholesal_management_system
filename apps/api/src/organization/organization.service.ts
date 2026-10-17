import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LOGO, SetupOrganizationDto, UpdateOrganizationDto } from "./dto/update-organization.dto";

const profileFields = {
  id: true, name: true, code: true, createdAt: true, updatedAt: true,
  industry: true, country: true, stateProvince: true, address: true, phone: true, email: true, website: true, taxId: true,
  currency: true, language: true, timeZone: true, inventoryStartDate: true, fiscalYearStart: true, logo: true, plan: true, setupPending: true, isDemo: true,
};
const orgSelect = { ...profileFields, _count: { select: { branches: true, users: true, regions: true, products: true } } };

const validZone = (z: string) => { try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; } };

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: orgSelect });
    if (!org) throw new NotFoundException("Organization not found");
    return { ...org, inventoryStartDate: org.inventoryStartDate ? org.inventoryStartDate.toISOString().slice(0, 10) : null };
  }

  /** Just what an invoice or printout needs: the company's name, logo and contact details. Anyone signed in may read it. */
  async brand(organizationId: string) {
    const o = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, logo: true, address: true, phone: true, email: true, website: true, taxId: true, currency: true } });
    if (!o) throw new NotFoundException("Organization not found");
    return o;
  }

  private clean(dto: UpdateOrganizationDto) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      if (k === "timeZone") { if (!validZone(String(v))) throw new BadRequestException("That time zone is not recognised."); data[k] = v; continue; }
      if (k === "inventoryStartDate") { const d = new Date(`${v}T00:00:00Z`); if (Number.isNaN(d.getTime())) throw new BadRequestException("That date is not valid."); data[k] = d; continue; }
      if (k === "logo") { if (v === "") data[k] = null; else if (!LOGO.test(String(v))) throw new BadRequestException("That picture is not supported. Use a PNG, JPEG or WebP image."); else data[k] = v; continue; }
      if (k === "name") { data[k] = String(v).trim(); continue; }
      data[k] = typeof v === "string" && ["industry", "country", "stateProvince", "address", "phone", "email", "website", "taxId"].includes(k) ? (v.trim() || null) : v;
    }
    return data;
  }

  async update(organizationId: string, dto: UpdateOrganizationDto) {
    await this.get(organizationId);
    await this.prisma.organization.update({ where: { id: organizationId }, data: this.clean(dto) });
    return this.get(organizationId);
  }

  /** Finishing the profile screen: saves everything and marks the company as set up. */
  async setup(organizationId: string, dto: SetupOrganizationDto) {
    await this.get(organizationId);
    await this.prisma.organization.update({ where: { id: organizationId }, data: { ...this.clean(dto), setupPending: false } });
    return this.get(organizationId);
  }
}
