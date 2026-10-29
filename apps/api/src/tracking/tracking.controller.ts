import { Body, Controller, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { InventoryModule } from "../inventory/inventory.module";
import { TrackingService } from "./tracking.service";

export class ScanLineInput {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
  @IsInt() @Min(0) @Max(100000) scanned!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @IsString({ each: true }) @MaxLength(64, { each: true }) codes?: string[];
}

export class GoodsInDto {
  @IsUUID() branchId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ScanLineInput) lines!: ScanLineInput[];
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsOptional() @IsString() @MaxLength(120) supplierName?: string;
}

export class LabelRunDto {
  @IsUUID() productId!: string;
  @IsUUID() branchId!: string;
  @IsInt() @Min(1) @Max(2000) quantity!: number;
}

export class FoundDto { @IsUUID() branchId!: string }
export class ExplainDto { @IsString() @MaxLength(1000) explanation!: string }
export class CloseIssueDto { @IsIn(["CLEARED", "AT_FAULT", "RECOVERED"]) outcome!: string; @IsString() @MaxLength(1000) resolution!: string }

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("tracking")
export class TrackingController {
  constructor(private readonly svc: TrackingService) {}

  /** Scan or type any code: an item label, a product barcode or a SKU. */
  @Get("find") @RequirePermissions("INVENTORY:READ", "GOODS_RECEIVING:READ", "STOCK_TRANSFERS:READ")
  find(@CurrentUser() u: AuthUser, @Query("code") code: string) { return this.svc.find(u, code); }

  @Post("items/:code/found") @RequirePermissions("GOODS_RECEIVING:CREATE", "STOCK_TRANSFERS:UPDATE")
  found(@CurrentUser() u: AuthUser, @Param("code") code: string, @Body() dto: FoundDto) { return this.svc.found(u, code, dto.branchId); }

  /** Goods arriving without a purchase order, confirmed by scanning. */
  @Post("goods-in") @RequirePermissions("GOODS_RECEIVING:CREATE")
  goodsIn(@CurrentUser() u: AuthUser, @Body() dto: GoodsInDto) { return this.svc.goodsIn(u, dto); }

  /** Item labels on the shelf at a branch (code, product), kept on the counter's device for scanning without internet. */
  @Get("codes") @RequirePermissions("SALES:CREATE", "INVENTORY:READ")
  codes(@CurrentUser() u: AuthUser, @Query("branchId") branchId: string) { return this.svc.codesAt(u, branchId); }

  @Get("unlabelled") @RequirePermissions("GOODS_RECEIVING:READ", "INVENTORY:READ")
  unlabelled(@CurrentUser() u: AuthUser, @Query("branchId") branchId: string) { return this.svc.unlabelled(u, branchId); }

  @Post("labels") @RequirePermissions("GOODS_RECEIVING:CREATE")
  labelRun(@CurrentUser() u: AuthUser, @Body() dto: LabelRunDto) { return this.svc.labelExisting(u, dto); }

  @Get("labels") @RequirePermissions("GOODS_RECEIVING:READ", "INVENTORY:READ")
  labels(@CurrentUser() u: AuthUser, @Query("reference") reference?: string, @Query("codes") codes?: string) { return this.svc.labels(u, { reference, codes: codes ? codes.split(",") : undefined }); }

  @Get("issues") @RequirePermissions("STOCK_TRANSFERS:READ", "GOODS_RECEIVING:READ", "AUDIT:READ")
  issues(@CurrentUser() u: AuthUser, @Query("status") status?: string) { return this.svc.issues(u, status); }

  @Patch("issues/:id/explain") @RequirePermissions("STOCK_TRANSFERS:UPDATE", "GOODS_RECEIVING:CREATE", "AUDIT:READ")
  explain(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: ExplainDto) { return this.svc.explain(u, id, dto.explanation); }

  /** Only the owner or an administrator (people who can read the audit log) decide the outcome. */
  @Patch("issues/:id/close") @RequirePermissions("AUDIT:READ")
  close(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: CloseIssueDto) { return this.svc.close(u, id, dto.outcome, dto.resolution); }
}

@Module({ imports: [InventoryModule], controllers: [TrackingController], providers: [TrackingService], exports: [TrackingService] })
export class TrackingModule {}
