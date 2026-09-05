import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermissions("SUPPLIERS:READ")
  list(@CurrentUser() user: AuthUser) { return this.suppliers.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("SUPPLIERS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.suppliers.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("SUPPLIERS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) { return this.suppliers.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("SUPPLIERS:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateSupplierDto) { return this.suppliers.update(user.organizationId, id, dto); }

  @Delete(":id")
  @RequirePermissions("SUPPLIERS:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.suppliers.remove(user.organizationId, id); }

  @Post(":id/contacts")
  @RequirePermissions("SUPPLIERS:UPDATE")
  addContact(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateContactDto) { return this.suppliers.addContact(user.organizationId, id, dto); }

  @Put(":id/contacts/:contactId")
  @RequirePermissions("SUPPLIERS:UPDATE")
  updateContact(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("contactId") contactId: string, @Body() dto: UpdateContactDto) {
    return this.suppliers.updateContact(user.organizationId, id, contactId, dto);
  }

  @Delete(":id/contacts/:contactId")
  @RequirePermissions("SUPPLIERS:UPDATE")
  removeContact(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("contactId") contactId: string) {
    return this.suppliers.removeContact(user.organizationId, id, contactId);
  }
}
