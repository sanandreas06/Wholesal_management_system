import { BadRequestException, Body, Controller, Get, Injectable, Module, Patch, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import * as bcrypt from "bcryptjs";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user.type";
import { PrismaService } from "../prisma/prisma.service";

// either one of the built-in looks ("preset:3") or a small photo already shrunk by the browser
const AVATAR = /^(preset:\d{1,2}|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/;

class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  /** empty string clears the picture */
  @IsOptional() @IsString() @MaxLength(90000) avatar?: string;
}
class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(100) newPassword!: string;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(u: AuthUser) {
    const row = await this.prisma.user.findUnique({ where: { id: u.sub }, select: { id: true, name: true, email: true, phone: true, avatar: true, mustChangePassword: true, branch: { select: { name: true } }, userRoles: { select: { role: { select: { name: true } } } } } });
    if (!row) throw new BadRequestException("User not found");
    return { id: row.id, name: row.name, email: row.email, phone: row.phone ?? "", avatar: row.avatar ?? "", mustChangePassword: row.mustChangePassword, branch: row.branch?.name ?? null, roles: row.userRoles.map((r: { role: { name: string } }) => r.role.name) };
  }

  async update(u: AuthUser, dto: UpdateProfileDto) {
    const data: { name?: string; phone?: string | null; avatar?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.avatar !== undefined) {
      if (dto.avatar === "") data.avatar = null;
      else if (!AVATAR.test(dto.avatar)) throw new BadRequestException("That picture is not supported. Use a PNG, JPEG or WebP photo.");
      else data.avatar = dto.avatar;
    }
    await this.prisma.user.update({ where: { id: u.sub }, data });
    return this.get(u);
  }

  async changePassword(u: AuthUser, dto: ChangePasswordDto) {
    const id = u.sub;
    const row = await this.prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
    if (!row || !(await bcrypt.compare(dto.currentPassword, row.passwordHash))) throw new BadRequestException("Your current password is not correct.");
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException("Choose a password you have not used just now.");
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 10), mustChangePassword: false } });
    return { ok: true };
  }
}

/** Every signed-in person can see and edit their own profile, and nobody else's. */
@UseGuards(JwtAuthGuard)
@Controller("profile")
export class ProfileController {
  constructor(private readonly svc: ProfileService) {}
  @Get() get(@CurrentUser() u: AuthUser) { return this.svc.get(u); }
  @Patch() update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) { return this.svc.update(u, dto); }
  @Post("password") password(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto) { return this.svc.changePassword(u, dto); }
}

@Module({ controllers: [ProfileController], providers: [ProfileService] })
export class ProfileModule {}
