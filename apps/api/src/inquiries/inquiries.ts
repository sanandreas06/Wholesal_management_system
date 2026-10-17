import { Body, Controller, Get, Headers, HttpCode, HttpException, HttpStatus, Injectable, Logger, Module, NotFoundException, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { MailerService } from "../auth/mailer";
import { adminOnly } from "../referrals/referrals";

export const SUBJECTS = ["A demo of WHOLESTRA", "Prices and plans", "Help with my account", "Partnership", "Something else"];
export const BRANCH_COUNTS = ["1", "2 to 5", "6 to 20", "More than 20"];

class InquiryDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsEmail() @MaxLength(160) email!: string;
  @IsString() @Matches(/^[+()\d\s-]{7,24}$/, { message: "Please type a valid phone number." }) phone!: string;
  @IsString() @MinLength(2) @MaxLength(120) company!: string;
  @IsOptional() @IsIn(BRANCH_COUNTS) branches?: string;
  @IsIn(SUBJECTS) subject!: string;
  @IsString() @MinLength(10, { message: "Please tell us a little more (at least 10 characters)." }) @MaxLength(3000) message!: string;
  /** a field people never see; robots fill it in */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
class StatusDto { @IsIn(["NEW", "REPLIED", "CLOSED"]) status!: string; }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

@Injectable()
export class InquiriesService {
  private readonly log = new Logger("Inquiries");
  constructor(private readonly prisma: PrismaService, private readonly mailer: MailerService) {}

  async create(dto: InquiryDto, ip?: string) {
    if (dto.website) return { ok: true }; // a robot: say thanks, keep nothing
    const email = dto.email.trim().toLowerCase();
    const hour = new Date(Date.now() - 3600_000);
    const [byIp, byEmail] = await Promise.all([
      ip ? this.prisma.inquiry.count({ where: { ip, createdAt: { gte: hour } } }) : Promise.resolve(0),
      this.prisma.inquiry.count({ where: { email, createdAt: { gte: hour } } }),
    ]);
    if (byIp >= 5 || byEmail >= 3) throw new HttpException("You have sent several messages already. We will reply soon, or reach us on WhatsApp.", HttpStatus.TOO_MANY_REQUESTS);
    const row = await this.prisma.inquiry.create({ data: { name: dto.name.trim(), email, phone: dto.phone.trim(), company: dto.company.trim(), branches: dto.branches ?? null, subject: dto.subject, message: dto.message.trim(), ip: ip ?? null } });
    if (this.mailer.configured) void this.notify(row).catch((e) => this.log.error(`inquiry email failed: ${(e as Error).message}`));
    return { ok: true, emailed: this.mailer.configured };
  }

  /** Tells the WHOLESTRA team (INQUIRY_TO, else the sender address) and thanks the person who wrote. */
  private async notify(r: { name: string; email: string; phone: string; company: string; branches: string | null; subject: string; message: string; createdAt: Date }) {
    const to = (process.env.INQUIRY_TO || process.env.MAIL_FROM || "").trim();
    const lines: [string, string][] = [["Name", r.name], ["Email", r.email], ["Phone", r.phone], ["Company", r.company], ["Branches", r.branches ?? "not given"], ["About", r.subject]];
    if (to) await this.mailer.send({
      to, replyTo: r.email, subject: `New enquiry: ${r.subject} (${r.company})`,
      text: `${lines.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${r.message}\n\nReply to this email to answer ${r.name}.`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1A2332"><h2 style="margin:0 0 12px">New enquiry from the WHOLESTRA website</h2><table cellpadding="6" style="border-collapse:collapse">${lines.map(([k, v]) => `<tr><td style="color:#55627F">${k}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table><p style="white-space:pre-wrap;border-left:3px solid #0B1B3E;padding-left:12px">${esc(r.message)}</p><p style="color:#55627F">Reply to this email to answer ${esc(r.name)}.</p></div>`,
    });
    await this.mailer.send({
      to: r.email, subject: "We received your message - WHOLESTRA",
      text: `Hello ${r.name},\n\nThank you for contacting WHOLESTRA about "${r.subject}". Our team will reply within one working day.\n\nWHOLESTRA`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1A2332;font-size:15px;line-height:1.6"><p>Hello ${esc(r.name)},</p><p>Thank you for contacting WHOLESTRA about <b>${esc(r.subject)}</b>. Our team will reply within one working day.</p><p>WHOLESTRA</p></div>`,
    });
  }

  list(status?: string) { return this.prisma.inquiry.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 }); }
  async setStatus(id: string, status: string) {
    const r = await this.prisma.inquiry.findUnique({ where: { id } });
    if (!r) throw new NotFoundException("Enquiry not found");
    return this.prisma.inquiry.update({ where: { id }, data: { status } });
  }
}

@Controller("inquiries")
export class InquiriesController {
  constructor(private readonly svc: InquiriesService) {}
  /** The Contact page form. Open to everyone, limited per address and per email. */
  @Post() @HttpCode(201) create(@Body() dto: InquiryDto, @Req() req: { ip?: string }) { return this.svc.create(dto, req.ip); }
  @Get("options") options() { return { subjects: SUBJECTS, branches: BRANCH_COUNTS }; }
}

@Controller("admin/inquiries")
export class InquiriesAdminController {
  constructor(private readonly svc: InquiriesService) {}
  @Get() list(@Headers("x-admin-key") key?: string, @Query("status") status?: string) { adminOnly(key); return this.svc.list(status); }
  @Patch(":id") update(@Headers("x-admin-key") key: string | undefined, @Param("id") id: string, @Body() dto: StatusDto) { adminOnly(key); return this.svc.setStatus(id, dto.status); }
}

@Module({ imports: [AuthModule], controllers: [InquiriesController, InquiriesAdminController], providers: [InquiriesService] })
export class InquiriesModule {}
