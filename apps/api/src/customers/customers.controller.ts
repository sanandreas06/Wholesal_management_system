import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions("CUSTOMERS:READ")
  list(@CurrentUser() user: AuthUser) { return this.customers.list(user.organizationId); }

  @Get(":id")
  @RequirePermissions("CUSTOMERS:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.customers.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("CUSTOMERS:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) { return this.customers.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("CUSTOMERS:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCustomerDto) { return this.customers.update(user.organizationId, id, dto); }

  @Delete(":id")
  @RequirePermissions("CUSTOMERS:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.customers.remove(user.organizationId, id); }

  @Post(":id/contacts")
  @RequirePermissions("CUSTOMERS:UPDATE")
  addContact(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateContactDto) { return this.customers.addContact(user.organizationId, id, dto); }

  @Put(":id/contacts/:contactId")
  @RequirePermissions("CUSTOMERS:UPDATE")
  updateContact(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("contactId") contactId: string, @Body() dto: UpdateContactDto) {
    return this.customers.updateContact(user.organizationId, id, contactId, dto);
  }

  @Delete(":id/contacts/:contactId")
  @RequirePermissions("CUSTOMERS:UPDATE")
  removeContact(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("contactId") contactId: string) {
    return this.customers.removeContact(user.organizationId, id, contactId);
  }
}
