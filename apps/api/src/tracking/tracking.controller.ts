import { Body, Controller, Get, Module, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { InventoryModule } from "../inventory/inventory.module";
import { WhereInput } from "../trips/geo";
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
  @IsOptional() @ValidateNested() @Type(() => WhereInput) where?: WhereInput;
}

export class LabelRunDto {
  @IsUUID() productId!: string;
  @IsUUID() branchId!: string;
  @IsInt() @Min(1) @Max(2000) quantity!: number;
}

export class FoundDto { @IsUUID() branchId!: string }
export class TrackAllDto { @IsBoolean() on!: boolean }
export class StickDto {
  @IsArray() @ArrayMaxSize(2000) @IsString({ each: true }) @MaxLength(200, { each: true }) codes!: string[];
  @IsOptional() @IsBoolean() finish?: boolean;
  @IsOptional() @ValidateNested() @Type(() => WhereInput) where?: WhereInput;
}
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

  /** Labels for all tracked stock at a branch that has none yet (up to 1000 per press). */
  @Post("labels/all") @RequirePermissions("GOODS_RECEIVING:CREATE")
  labelAll(@CurrentUser() u: AuthUser, @Body() dto: FoundDto) { return this.svc.labelAllAt(u, dto.branchId); }

  /** Print runs at a branch whose labels still wait to be stuck on and scanned. */
  @Get("stick") @RequirePermissions("GOODS_RECEIVING:READ", "GOODS_RECEIVING:CREATE", "INVENTORY:READ")
  openRuns(@CurrentUser() u: AuthUser, @Query("branchId") branchId: string) { return this.svc.openRuns(u, branchId); }

  @Get("stick/:ref") @RequirePermissions("GOODS_RECEIVING:READ", "GOODS_RECEIVING:CREATE", "INVENTORY:READ")
  stickRun(@CurrentUser() u: AuthUser, @Param("ref") ref: string) { return this.svc.stickRun(u, ref); }

  /** Labels stuck on and scanned become stock; with finish, the labels never scanned are cancelled. */
  @Post("stick/:ref") @RequirePermissions("GOODS_RECEIVING:CREATE")
  stick(@CurrentUser() u: AuthUser, @Param("ref") ref: string, @Body() dto: StickDto) { return this.svc.stick(u, ref, dto); }

  /** "Every item gets its own label" for the whole company. */
  @Get("track-all") @RequirePermissions("GOODS_RECEIVING:READ", "INVENTORY:READ", "ORGANIZATION:READ")
  trackAll(@CurrentUser() u: AuthUser) { return this.svc.trackAll(u); }

  /** Only the owner (and anyone else who may change the company settings) turns it on or off. */
  @Put("track-all") @RequirePermissions("ORGANIZATION:UPDATE")
  setTrackAll(@CurrentUser() u: AuthUser, @Body() dto: TrackAllDto) { return this.svc.setTrackAll(u, dto.on); }

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
