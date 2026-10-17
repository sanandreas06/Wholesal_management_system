import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, from, switchMap } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/types/auth-user.type";
import { AuditSealService } from "./audit-seal";

/**
 * Records who changed what, and when, for the business data that is NOT already covered by a
 * ledger of its own (stock has the movement ledger, sales have their audit trail).
 * It never blocks or fails a request: if logging fails, the request still succeeds.
 */

// URL segment -> [prisma model delegate, label]
const WATCHED: Record<string, [string, string]> = {
  products: ["product", "Product"],
  customers: ["customer", "Customer"],
  suppliers: ["supplier", "Supplier"],
  users: ["user", "User"],
  roles: ["role", "Role"],
  branches: ["branch", "Branch"],
  regions: ["region", "Region"],
  categories: ["category", "Category"],
  brands: ["brand", "Brand"],
  units: ["unit", "Unit"],
  "product-aliases": ["productAlias", "Product alias"],
  organization: ["organization", "Organization"],
  expenses: ["expense", "Expense"],
  "expense-categories": ["expenseCategory", "Expense category"],
  "variance-cases": ["varianceCase", "Variance case"],
};
// pictures are left out of the log: they are large and the log is for who-changed-what, not for storing images
const HIDDEN = new Set(["passwordHash", "password", "createdAt", "updatedAt", "refreshToken", "logo", "imageUrl", "imageThumb", "avatar", "totpSecret", "recoveryCodes"]);
const SUB_ACTIONS: Record<string, string> = {
  permissions: "PERMISSIONS CHANGED", roles: "ROLES CHANGED", activate: "ACTIVATED", deactivate: "DEACTIVATED",
  approve: "APPROVED", reject: "REJECTED", status: "STATUS CHANGED",
};

function plain(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && typeof (v as { toString?: unknown }).toString === "function" && (v as { constructor?: { name?: string } }).constructor?.name === "Decimal") return String(v);
  if (typeof v === "bigint") return String(v);
  return v;
}
function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (HIDDEN.has(k)) continue;
    const a = plain(before?.[k]), b = plain(after?.[k]);
    if (typeof a === "object" && a !== null) continue; // skip nested relations
    if (typeof b === "object" && b !== null) continue;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a, to: b };
  }
  return out;
}
function cleanBody(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) { if (!HIDDEN.has(k)) o[k] = v; }
  return Object.keys(o).length ? o : undefined;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly log = new Logger("AuditLog");
  constructor(private readonly prisma: PrismaService, private readonly seal: AuditSealService) {}

  private async fetchOne(model: string, id: string, organizationId: string) {
    try {
      const delegate = (this.prisma as unknown as Record<string, { findFirst: (a: unknown) => Promise<Record<string, unknown> | null> }>)[model];
      if (!delegate) return null;
      return model === "organization" ? await delegate.findFirst({ where: { id } }) : await delegate.findFirst({ where: { id, organizationId } });
    } catch { return null; }
  }

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const method: string = req.method;
    const user: AuthUser | undefined = req.user;
    if (!user || !["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next.handle();

    const segs = String(req.originalUrl ?? "").split("?")[0].split("/").filter(Boolean);
    const apiAt = segs.indexOf("api");
    const [resource, second, third] = segs.slice(apiAt + 1);
    const watched = WATCHED[resource];
    if (!watched) return next.handle();
    const [model, label] = watched;

    // organization has no id in the URL; everything else uses :id when present
    const entityId = resource === "organization" ? user.organizationId : second && /^[0-9a-f-]{36}$/i.test(second) ? second : undefined;
    const sub = entityId ? (third ?? "").toLowerCase() : (second ?? "").toLowerCase();
    const body = cleanBody(req.body);

    return from(entityId ? this.fetchOne(model, entityId, user.organizationId) : Promise.resolve(null)).pipe(
      switchMap((before) =>
        next.handle().pipe(
          switchMap((result) =>
            from((async () => {
              try {
                const resId = entityId ?? (result && typeof result === "object" ? (result as { id?: string }).id : undefined);
                const after = method === "DELETE" ? null : resId && entityId ? await this.fetchOne(model, resId, user.organizationId) : (result as Record<string, unknown> | null);
                const changes = method === "POST" && !entityId ? undefined : diff(before, after);
                const name = (after ?? before) as Record<string, unknown> | null;
                const nm = String(name?.name ?? name?.sku ?? name?.email ?? name?.orderNumber ?? resId ?? "");
                const action = SUB_ACTIONS[sub] ?? (method === "POST" ? "CREATED" : method === "DELETE" ? "DELETED" : "UPDATED");
                const hasChanges = changes && Object.keys(changes).length > 0;
                await this.seal.append({
                  organizationId: user.organizationId, userId: user.sub, userName: user.email,
                  action, entityType: label, entityId: resId ?? null,
                  summary: `${label} ${nm ? `"${nm}" ` : ""}${action.toLowerCase()}`,
                  // pass it through JSON once, so what is sealed is exactly what the database will hand back later
                  changes: JSON.parse(JSON.stringify(hasChanges ? { fields: changes, ...(body && SUB_ACTIONS[sub] ? { request: body } : {}) } : body ? { request: body } : null)),
                });
              } catch (e) { this.log.warn(`could not record audit entry: ${(e as Error).message}`); }
              return result;
            })()),
          ),
        ),
      ),
    );
  }
}
