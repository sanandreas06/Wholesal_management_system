import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, Param, Put, Query, UseGuards } from "@nestjs/common";
import { IsObject, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { PrismaService } from "../prisma/prisma.service";

const MAX_PER_SCREEN = 30;

class SaveViewDto {
  @IsString() @Matches(/^[a-z][a-z0-9-]{1,30}$/, { message: "unknown screen" }) scope!: string;
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
  @IsObject() state!: Record<string, unknown>;
}

@Injectable()
export class SavedViewsService {
  constructor(private readonly prisma: PrismaService) {}

  list(u: AuthUser, scope: string) {
    return this.prisma.savedView.findMany({ where: { userId: u.sub, scope }, orderBy: { name: "asc" }, select: { id: true, name: true, state: true } });
  }

  /** Saving under a name that already exists replaces that view. */
  async save(u: AuthUser, dto: SaveViewDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Give the view a name.");
    // filters are flat: text and on/off values only, and small
    const state: Record<string, string | boolean> = {};
    for (const [k, v] of Object.entries(dto.state)) {
      if (typeof v !== "string" && typeof v !== "boolean") throw new BadRequestException("A saved view can only hold filter values.");
      if (typeof v === "string" && v.length > 200) throw new BadRequestException("A filter value is too long.");
      state[k] = v;
    }
    if (Object.keys(state).length > 20) throw new BadRequestException("Too many filters in one view.");
    const where = { userId_scope_name: { userId: u.sub, scope: dto.scope, name } };
    const exists = await this.prisma.savedView.findUnique({ where });
    if (!exists && (await this.prisma.savedView.count({ where: { userId: u.sub, scope: dto.scope } })) >= MAX_PER_SCREEN) throw new BadRequestException(`You can keep up to ${MAX_PER_SCREEN} views per screen. Delete one first.`);
    return this.prisma.savedView.upsert({ where, create: { userId: u.sub, scope: dto.scope, name, state }, update: { state }, select: { id: true, name: true, state: true } });
  }

  async remove(u: AuthUser, id: string) {
    await this.prisma.savedView.deleteMany({ where: { id, userId: u.sub } }); // only ever your own
    return { ok: true };
  }
}

/** Saved filter sets belong to the person who made them and follow them to any browser or device. */
@UseGuards(JwtAuthGuard)
@Controller("saved-views")
export class SavedViewsController {
  constructor(private readonly svc: SavedViewsService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query("scope") scope: string) { return this.svc.list(u, scope ?? ""); }
  @Put() save(@CurrentUser() u: AuthUser, @Body() dto: SaveViewDto) { return this.svc.save(u, dto); }
  @Delete(":id") remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.remove(u, id); }
}

@Module({ controllers: [SavedViewsController], providers: [SavedViewsService] })
export class SavedViewsModule {}
