import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { ExpensesService } from "./expenses.service";
import { DepositsService } from "./deposits.service";
import { ReconciliationService } from "./reconciliation.service";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ReviewExpenseDto } from "./dto/review-expense.dto";
import { CreateDepositDto } from "./dto/create-deposit.dto";
import { CreateBranchClosingDto } from "./dto/create-branch-closing.dto";
import { UpdateVarianceCaseDto } from "./dto/update-variance-case.dto";
import { BranchScopeService } from "../common/branch/branch-scope";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("expense-categories")
export class ExpenseCategoriesController {
  constructor(private readonly expenses: ExpensesService) {}
  @Get() @RequirePermissions("EXPENSES:READ")
  list(@CurrentUser() u: AuthUser) { return this.expenses.listCategories(u.organizationId); }
  @Post() @RequirePermissions("EXPENSES:CREATE")
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateExpenseCategoryDto) { return this.expenses.createCategory(u.organizationId, dto); }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService, private readonly scope: BranchScopeService) {}
  @Get() @RequirePermissions("EXPENSES:READ")
  list(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string, @Query("status") status?: string, @Query("from") from?: string, @Query("to") to?: string, @Query("categoryId") categoryId?: string) { return this.expenses.list(u.organizationId, this.scope.limit(u, branchId), status, { from, to, categoryId }); }
  @Get("summary") @RequirePermissions("EXPENSES:READ")
  summary(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string, @Query("status") status?: string, @Query("from") from?: string, @Query("to") to?: string, @Query("categoryId") categoryId?: string) { return this.expenses.summary(u.organizationId, this.scope.limit(u, branchId), status, { from, to, categoryId }); }
  @Post() @RequirePermissions("EXPENSES:CREATE")
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateExpenseDto) { this.scope.assert(u, dto.branchId); return this.expenses.create(u.organizationId, u.sub, dto); }
  @Patch(":id/approve") @RequirePermissions("EXPENSES:APPROVE")
  async approve(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: ReviewExpenseDto) { await this.scope.record(u, "expense", id); return this.expenses.approve(u.organizationId, id, u.sub, dto); }
  @Patch(":id/reject") @RequirePermissions("EXPENSES:APPROVE")
  async reject(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: ReviewExpenseDto) { await this.scope.record(u, "expense", id); return this.expenses.reject(u.organizationId, id, u.sub, dto); }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("deposits")
export class DepositsController {
  constructor(private readonly deposits: DepositsService, private readonly scope: BranchScopeService) {}
  @Get() @RequirePermissions("DEPOSITS:READ")
  list(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string, @Query("from") from?: string, @Query("to") to?: string, @Query("method") method?: string) { return this.deposits.list(u.organizationId, this.scope.limit(u, branchId), { from, to, method }); }
  @Get("summary") @RequirePermissions("DEPOSITS:READ")
  summary(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string, @Query("from") from?: string, @Query("to") to?: string, @Query("method") method?: string) { return this.deposits.summary(u.organizationId, this.scope.limit(u, branchId), { from, to, method }); }
  @Post() @RequirePermissions("DEPOSITS:CREATE")
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateDepositDto) { this.scope.assert(u, dto.branchId); return this.deposits.create(u.organizationId, u.sub, dto); }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("reconciliation")
export class ReconciliationController {
  constructor(private readonly recon: ReconciliationService, private readonly scope: BranchScopeService) {}
  @Get() @RequirePermissions("RECONCILIATION:READ")
  summary(@CurrentUser() u: AuthUser, @Query("from") from: string, @Query("to") to: string, @Query("branchId") branchId?: string) {
    return this.recon.summary(u.organizationId, from, to, this.scope.limit(u, branchId));
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("branch-closings")
export class BranchClosingsController {
  constructor(private readonly recon: ReconciliationService, private readonly scope: BranchScopeService) {}
  @Get() @RequirePermissions("BRANCH_CLOSING:READ")
  list(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string) { return this.recon.listClosings(u.organizationId, this.scope.limit(u, branchId)); }
  @Post() @RequirePermissions("BRANCH_CLOSING:CREATE")
  close(@CurrentUser() u: AuthUser, @Body() dto: CreateBranchClosingDto) { this.scope.assert(u, dto.branchId); return this.recon.close(u.organizationId, u.sub, dto); }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("variance-cases")
export class VarianceCasesController {
  constructor(private readonly recon: ReconciliationService, private readonly scope: BranchScopeService) {}
  @Get() @RequirePermissions("VARIANCE_CASES:READ")
  list(@CurrentUser() u: AuthUser, @Query("status") status?: string, @Query("branchId") branchId?: string) { return this.recon.listCases(u.organizationId, status, this.scope.limit(u, branchId)); }
  @Patch(":id") @RequirePermissions("VARIANCE_CASES:UPDATE")
  async update(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: UpdateVarianceCaseDto) { await this.scope.record(u, "varianceCase", id); return this.recon.updateCase(u.organizationId, id, u.sub, dto); }
}
