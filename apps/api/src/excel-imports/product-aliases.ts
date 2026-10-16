import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeName } from "./match";

@Injectable()
export class ProductAliasesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string, productId?: string) {
    return this.prisma.productAlias.findMany({
      where: { organizationId, ...(productId ? { productId } : {}) },
      select: { id: true, alias: true, productId: true, createdAt: true, product: { select: { name: true, sku: true } } },
      orderBy: { alias: "asc" }, take: 500,
    });
  }

  async create(organizationId: string, userId: string, productId: string, alias: string) {
    const text = (alias ?? "").trim();
    const key = normalizeName(text);
    if (text.length < 2 || !key) throw new BadRequestException("Alias must be at least 2 characters");
    const product = await this.prisma.product.findFirst({ where: { id: productId, organizationId }, select: { id: true } });
    if (!product) throw new NotFoundException("Product not found");
    const clash = await this.prisma.productAlias.findFirst({ where: { organizationId, aliasKey: key }, include: { product: { select: { name: true } } } });
    if (clash) throw new ConflictException(`"${text}" is already an alias of ${clash.product.name}`);
    return this.prisma.productAlias.create({ data: { organizationId, productId, alias: text, aliasKey: key, createdByUserId: userId }, select: { id: true, alias: true, productId: true } });
  }

  async remove(organizationId: string, id: string) {
    const a = await this.prisma.productAlias.findFirst({ where: { id, organizationId } });
    if (!a) throw new NotFoundException("Alias not found");
    await this.prisma.productAlias.delete({ where: { id } });
    return { deleted: true };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("product-aliases")
export class ProductAliasesController {
  constructor(private readonly aliases: ProductAliasesService) {}
  @Get() @RequirePermissions("PRODUCTS:READ")
  list(@CurrentUser() u: AuthUser, @Query("productId") productId?: string) { return this.aliases.list(u.organizationId, productId); }
  @Post() @RequirePermissions("PRODUCTS:UPDATE")
  create(@CurrentUser() u: AuthUser, @Body() body: { productId: string; alias: string }) { return this.aliases.create(u.organizationId, u.sub, body?.productId, body?.alias); }
  @Delete(":id") @RequirePermissions("PRODUCTS:UPDATE")
  remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.aliases.remove(u.organizationId, id); }
}
