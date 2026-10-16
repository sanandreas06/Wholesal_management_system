import { ForbiddenException, Global, Injectable, Module, NotFoundException } from "@nestjs/common";
import { AuthUser } from "../types/auth-user.type";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Branch limits. A role can be marked "limit to own branch"; a person with such a role sees and works with their own branch only.
 * The limit is put in the sign-in token as `branchScope`: a branch id, or NO_BRANCH when the role is limited but the person has no branch
 * (they then see nothing, which is the safe way to fail). No `branchScope` means every branch.
 */
export const NO_BRANCH = "__none__";

/** The one branch this person is limited to, or null when they may work with every branch. */
export const scopeOf = (u: Pick<AuthUser, "branchScope">): string | null => u.branchScope || null;

/**
 * The branch filter to apply to a list: their own branch when limited, otherwise whatever was asked for (or nothing = all).
 * Asking for another branch's data is refused rather than silently ignored.
 */
export function limitBranch(u: Pick<AuthUser, "branchScope">, requested?: string | null): string | undefined {
  const s = scopeOf(u);
  if (!s) return requested || undefined;
  if (requested && requested !== s) throw new ForbiddenException("You can only work with your own branch.");
  return s;
}

/** For a branch named in a request body: refuse anything outside the person's own branch. */
export function assertBranch(u: Pick<AuthUser, "branchScope">, branchId: string | null | undefined) {
  const s = scopeOf(u);
  if (s && branchId !== s) throw new ForbiddenException("You can only work with your own branch.");
}

type Kind = "sale" | "purchaseOrder" | "stockCount" | "stockTransfer" | "stockTransferFrom" | "stockTransferTo" | "varianceCase" | "branchClosing" | "importBatch" | "expense" | "deposit";
const KINDS: Record<Kind, [string, string[]]> = {
  sale: ["sale", ["branchId"]],
  purchaseOrder: ["purchaseOrder", ["branchId"]],
  stockCount: ["stockCount", ["branchId"]],
  stockTransfer: ["stockTransfer", ["fromBranchId", "toBranchId"]],   // seen by both ends
  stockTransferFrom: ["stockTransfer", ["fromBranchId"]],             // approved, dispatched or cancelled by the sending branch
  stockTransferTo: ["stockTransfer", ["toBranchId"]],                 // received by the receiving branch
  varianceCase: ["varianceCase", ["branchId"]],
  branchClosing: ["branchClosing", ["branchId"]],
  importBatch: ["importBatch", ["branchId"]],
  expense: ["expense", ["branchId"]],
  deposit: ["deposit", ["branchId"]],
};

@Global()
@Injectable()
export class BranchScopeService {
  constructor(private readonly prisma: PrismaService) {}
  scope = scopeOf;
  limit = limitBranch;
  assert = assertBranch;

  /** Stops a limited person from opening or changing a record that belongs to another branch (it looks like it does not exist). */
  async record(u: AuthUser, kind: Kind, id: string): Promise<void> {
    const s = scopeOf(u);
    if (!s) return;
    const [model, fields] = KINDS[kind];
    const delegate = (this.prisma as unknown as Record<string, { findFirst: (a: unknown) => Promise<Record<string, string> | null> }>)[model];
    const row = await delegate.findFirst({ where: { id, organizationId: u.organizationId }, select: Object.fromEntries(fields.map((f) => [f, true])) });
    if (!row || !fields.some((f) => row[f] === s)) throw new NotFoundException("Not found");
  }
}

@Global()
@Module({ providers: [BranchScopeService], exports: [BranchScopeService] })
export class BranchScopeModule {}
