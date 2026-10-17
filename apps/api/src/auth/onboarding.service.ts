import { BadRequestException, ConflictException, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { randomInt } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditSealService } from "../audit/audit-seal";
import { ROLE_TEMPLATES } from "../roles/role-templates";
import { ADMIN_RESOURCES, ALL_PERMISSIONS, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_UNITS, ROLE_DEFS } from "./permission-catalog";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = (n: number) => Array.from({ length: n }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10);

export interface NewCompany {
  companyName: string;
  email: string;
  name: string;
  phone?: string | null;
  passwordHash: string;
  passwordSet: boolean;
  referralCode?: string | null;
  via: string;
}

/** Makes a new company with its owner, the standard roles and a few sensible starting records, in one step. */
@Injectable()
export class OnboardingService implements OnApplicationBootstrap {
  private readonly log = new Logger("Onboarding");
  private permissionsReady = false;
  constructor(private readonly prisma: PrismaService, private readonly seal: AuditSealService) {}

  async onApplicationBootstrap() {
    try { await this.ensurePermissions(true); } catch (e) { this.log.warn(`could not refresh the permission list: ${(e as Error).message}`); }
  }

  /** Makes sure every permission exists, and that owners (SUPER_ADMIN) hold all of them, including ones added by later versions. */
  async ensurePermissions(grantToOwners = false): Promise<Map<string, string>> {
    if (!this.permissionsReady) {
      await this.prisma.permission.createMany({ data: ALL_PERMISSIONS.map((k) => { const [resource, action] = k.split(":"); return { resource: resource as never, action: action as never, description: `${action} access to ${resource}` }; }), skipDuplicates: true });
      this.permissionsReady = true;
    }
    const rows = await this.prisma.permission.findMany({ select: { id: true, resource: true, action: true } });
    const ids = new Map<string, string>(rows.map((p): [string, string] => [`${p.resource}:${p.action}`, p.id]));
    if (grantToOwners) {
      const owners = await this.prisma.role.findMany({ where: { code: "SUPER_ADMIN" }, select: { id: true } });
      for (const o of owners) await this.prisma.rolePermission.createMany({ data: [...ids.values()].map((permissionId) => ({ roleId: o.id, permissionId })), skipDuplicates: true });
    }
    return ids;
  }

  async referrerFor(code?: string | null) {
    const c = (code ?? "").trim().toUpperCase();
    if (!c) return null;
    return this.prisma.organization.findFirst({ where: { referralCode: c, isDemo: false }, select: { id: true, name: true, referralCode: true } });
  }

  async emailTaken(email: string) { return !!(await this.prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } }, select: { id: true } })); }

  async createCompany(c: NewCompany) {
    if (await this.emailTaken(c.email)) throw new ConflictException("An account with this email already exists. Sign in instead.");
    const ids = await this.ensurePermissions();
    const referrer = await this.referrerFor(c.referralCode);
    let created: { organizationId: string; userId: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      try {
        created = await this.prisma.$transaction(async (tx) => {
          const org = await tx.organization.create({ data: { name: c.companyName, code: `${slug(c.companyName) || "CO"}-${randomCode(4)}`, setupPending: true, referralCode: `WS${randomCode(6)}`, referredByCode: referrer?.referralCode ?? null } });
          const idOf = (keys: string[]) => [...new Set(keys)].map((k) => ids.get(k)).filter((x): x is string => !!x);
          const grants: Record<string, { perms: string[]; restricted: boolean }> = {
            SUPER_ADMIN: { perms: ALL_PERMISSIONS, restricted: false },
            ORGANIZATION_ADMIN: { perms: ALL_PERMISSIONS.filter((k) => ADMIN_RESOURCES.includes(k.split(":")[0])), restricted: false },
            REGIONAL_MANAGER: { perms: [], restricted: false },
            ...Object.fromEntries(Object.entries(ROLE_TEMPLATES).map(([code, perms]) => [code, { perms, restricted: true }])),
          };
          let ownerRoleId = "";
          for (const def of ROLE_DEFS) {
            const g = grants[def.code] ?? { perms: [], restricted: false };
            const role = await tx.role.create({ data: { organizationId: org.id, name: def.name, code: def.code, description: def.description, branchRestricted: g.restricted } });
            if (def.code === "SUPER_ADMIN") ownerRoleId = role.id;
            await tx.rolePermission.createMany({ data: idOf(g.perms).map((permissionId) => ({ roleId: role.id, permissionId })), skipDuplicates: true });
          }
          const branch = await tx.branch.create({ data: { organizationId: org.id, name: "Main branch", code: "MAIN-001" } });
          await tx.unit.createMany({ data: DEFAULT_UNITS.map(([name, code]) => ({ organizationId: org.id, name, code })) });
          await tx.expenseCategory.createMany({ data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ organizationId: org.id, name })) });
          const user = await tx.user.create({ data: { organizationId: org.id, branchId: branch.id, email: c.email, name: c.name, phone: c.phone || null, passwordHash: c.passwordHash, passwordSet: c.passwordSet, emailVerifiedAt: new Date() } });
          await tx.userRole.create({ data: { userId: user.id, roleId: ownerRoleId } });
          if (referrer) await tx.referral.create({ data: { referrerOrgId: referrer.id, referredOrgId: org.id, code: referrer.referralCode as string } });
          return { organizationId: org.id, userId: user.id };
        });
      } catch (e) {
        const err = e as { code?: string; meta?: { target?: string[] | string } };
        if (err.code === "P2002") { const t = String(err.meta?.target ?? ""); if (t.includes("email")) throw new ConflictException("An account with this email already exists. Sign in instead."); continue; } // a clash on a generated code: try again with a new one
        throw e;
      }
    }
    if (!created) throw new BadRequestException("We could not create the account just now. Please try again.");
    try { await this.seal.append({ organizationId: created.organizationId, userId: created.userId, userName: c.email, action: "ACCOUNT CREATED", entityType: "Organization", entityId: created.organizationId, summary: `Company "${c.companyName}" was created (${c.via})`, changes: null }); }
    catch (e) { this.log.warn(`could not record the new company in the change log: ${(e as Error).message}`); }
    return created;
  }
}
