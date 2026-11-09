import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { scopeOf } from "../common/branch/branch-scope";
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { BranchPaymentDto } from "./dto/branch-payment.dto";
import { WhereInput, place } from "../trips/geo";
import { BadRequestException } from "@nestjs/common";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions("BRANCHES:READ")
  /** `?own=1` is for pickers that should only offer the branches a person may work with (their own, when limited). */
  async list(@CurrentUser() user: AuthUser, @Query("own") own?: string) {
    const all = await this.branches.list(user.organizationId);
    const mine = scopeOf(user);
    return own && mine ? (all as { id: string }[]).filter(b => b.id === mine) : all;
  }

  /** The branch's mobile money details, for the counter and its customer screen. Anyone who sells at the branch may read them. */
  @Get(":id/payment")
  @RequirePermissions("SALES:CREATE")
  payment(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const mine = scopeOf(user);
    return this.branches.payment(user.organizationId, mine && mine !== id ? "__none__" : id);
  }

  @Put(":id/payment")
  @RequirePermissions("BRANCHES:UPDATE")
  setPayment(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: BranchPaymentDto) {
    const mine = scopeOf(user);
    return this.branches.setPayment(user.organizationId, mine && mine !== id ? "__none__" : id, dto);
  }

  /** Pins the branch on the map (from a phone standing in the branch, or typed). Used for the live map of goods on the road. */
  @Put(":id/location")
  @RequirePermissions("BRANCHES:UPDATE")
  async setLocation(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: WhereInput) {
    const mine = scopeOf(user), p = place(dto);
    if (!p) throw new BadRequestException("That location is not precise enough. Stand in the branch, turn on the phone's location, and try again.");
    return this.branches.setLocation(user.organizationId, mine && mine !== id ? "__none__" : id, p);
  }

  @Get(":id")
  @RequirePermissions("BRANCHES:READ")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.branches.get(user.organizationId, id); }

  @Post()
  @RequirePermissions("BRANCHES:CREATE")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) { return this.branches.create(user.organizationId, dto); }

  @Put(":id")
  @RequirePermissions("BRANCHES:UPDATE")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateBranchDto) { return this.branches.update(user.organizationId, id, dto); }

  @Delete(":id")
  @RequirePermissions("BRANCHES:DELETE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.branches.remove(user.organizationId, id); }
}
