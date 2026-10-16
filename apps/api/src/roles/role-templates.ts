import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const R = (resource: string, ...actions: string[]) => actions.map((a) => `${resource}:${a}`);

/**
 * Starting permissions for the three branch-level roles that come with the system. Applied only to a role that has NO permissions yet,
 * so anything an administrator has already set up (or later changes on the Roles screen) is never touched. Each is limited to its own branch.
 * Deliberately left out: profit and cost, the audit log, users and roles, settings, and approving expenses. Those stay with the owner.
 */
export const ROLE_TEMPLATES: Record<string, string[]> = {
  BRANCH_MANAGER: [
    ...R("DASHBOARD", "READ"), ...R("BRANCHES", "READ"), ...R("PRODUCTS", "READ"), ...R("CATEGORIES", "READ"), ...R("BRANDS", "READ"), ...R("UNITS", "READ"),
    ...R("CUSTOMERS", "READ", "CREATE", "UPDATE"), ...R("SUPPLIERS", "READ"), ...R("INVENTORY", "READ"),
    ...R("SALES", "READ", "CREATE", "UPDATE"), ...R("PAYMENTS", "READ", "CREATE"), ...R("RETURNS", "READ", "CREATE"),
    ...R("PURCHASING", "READ", "CREATE", "UPDATE"), ...R("GOODS_RECEIVING", "READ", "CREATE"),
    ...R("STOCK_COUNTS", "READ", "CREATE", "UPDATE"), ...R("STOCK_TRANSFERS", "READ", "CREATE", "UPDATE"), ...R("STOCK_ADJUSTMENTS", "READ", "CREATE"),
    ...R("EXPENSES", "READ", "CREATE"), ...R("DEPOSITS", "READ", "CREATE"), ...R("RECONCILIATION", "READ"), ...R("VARIANCE_CASES", "READ"), ...R("BRANCH_CLOSING", "READ", "CREATE"),
    ...R("EXCEL_IMPORT", "READ", "CREATE"),
  ],
  SALES_USER: [
    ...R("DASHBOARD", "READ"), ...R("BRANCHES", "READ"), ...R("PRODUCTS", "READ"), ...R("INVENTORY", "READ"),
    ...R("CUSTOMERS", "READ", "CREATE"), ...R("SALES", "READ", "CREATE"), ...R("PAYMENTS", "READ", "CREATE"), ...R("RETURNS", "READ", "CREATE"),
  ],
  INVENTORY_USER: [
    ...R("BRANCHES", "READ"), ...R("PRODUCTS", "READ"), ...R("CATEGORIES", "READ"), ...R("INVENTORY", "READ"), ...R("PURCHASING", "READ"), ...R("GOODS_RECEIVING", "READ", "CREATE"),
    ...R("STOCK_COUNTS", "READ", "CREATE", "UPDATE"), ...R("STOCK_TRANSFERS", "READ", "CREATE", "UPDATE"), ...R("STOCK_ADJUSTMENTS", "READ", "CREATE"),
  ],
};

@Injectable()
export class RoleTemplates implements OnApplicationBootstrap {
  private readonly log = new Logger("RoleTemplates");
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      const roles: { id: string; code: string; _count: { permissions: number } }[] = await this.prisma.role.findMany({
        where: { code: { in: Object.keys(ROLE_TEMPLATES) } }, select: { id: true, code: true, _count: { select: { permissions: true } } },
      });
      const empty = roles.filter((r) => r._count.permissions === 0);
      if (!empty.length) return;
      const all: { id: string; resource: string; action: string }[] = await this.prisma.permission.findMany({ select: { id: true, resource: true, action: true } });
      const idOf = new Map<string, string>(all.map((p): [string, string] => [`${p.resource}:${p.action}`, p.id]));
      for (const r of empty) {
        const ids = [...new Set(ROLE_TEMPLATES[r.code])].map((k) => idOf.get(k)).filter((x): x is string => !!x);
        await this.prisma.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: r.id, permissionId })), skipDuplicates: true });
        await this.prisma.role.update({ where: { id: r.id }, data: { branchRestricted: true } });
        this.log.log(`${r.code}: gave it ${ids.length} starting permissions and limited it to the person's own branch`);
      }
    } catch (e) { this.log.warn(`could not apply role templates: ${(e as Error).message}`); }
  }
}
