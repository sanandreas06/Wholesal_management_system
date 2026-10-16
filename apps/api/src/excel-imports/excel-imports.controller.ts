import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { ExcelImportsService } from "./excel-imports.service";
import { UploadImportDto } from "./dto/upload-import.dto";
import { BranchScopeService } from "../common/branch/branch-scope";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("imports")
export class ExcelImportsController {
  constructor(private readonly imports: ExcelImportsService, private readonly scope: BranchScopeService) {}

  @Get("template") @RequirePermissions("EXCEL_IMPORT:READ")
  async template() {
    return new StreamableFile(await this.imports.template(), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", disposition: 'attachment; filename="weekly-sales-template.xlsx"' });
  }

  @Get("summary") @RequirePermissions("EXCEL_IMPORT:READ")
  summary(@CurrentUser() u: AuthUser, @Query("from") from: string, @Query("to") to: string, @Query("branchId") branchId?: string) { return this.imports.summary(u.organizationId, from, to, this.scope.limit(u, branchId)); }

  @Get() @RequirePermissions("EXCEL_IMPORT:READ")
  list(@CurrentUser() u: AuthUser, @Query("branchId") branchId?: string) { return this.imports.list(u.organizationId, this.scope.limit(u, branchId)); }

  @Get(":id/unmatched") @RequirePermissions("EXCEL_IMPORT:READ")
  async unmatched(@CurrentUser() u: AuthUser, @Param("id") id: string) { await this.scope.record(u, "importBatch", id); return this.imports.unmatched(u.organizationId, id); }

  @Post(":id/resolve") @RequirePermissions("EXCEL_IMPORT:CREATE")
  async resolve(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() body: { mappings?: { text: string; productId: string }[] }) {
    await this.scope.record(u, "importBatch", id);
    if (!Array.isArray(body?.mappings)) throw new BadRequestException("mappings must be a list of { text, productId }");
    return this.imports.resolve(u.organizationId, u.sub, id, body.mappings.filter(m => m && typeof m.text === "string" && typeof m.productId === "string"));
  }

  @Get(":id") @RequirePermissions("EXCEL_IMPORT:READ")
  async get(@CurrentUser() u: AuthUser, @Param("id") id: string) { await this.scope.record(u, "importBatch", id); return this.imports.get(u.organizationId, id); }

  @Post() @RequirePermissions("EXCEL_IMPORT:CREATE")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadImportDto) { this.scope.assert(u, dto.branchId); return this.imports.upload(u.organizationId, u.sub, file, dto); }
}
