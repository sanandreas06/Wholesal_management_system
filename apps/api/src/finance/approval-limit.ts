/**
 * Who may approve which expense. Pure rules, so they can be tested without a database.
 * A role that may approve expenses can have a limit ("up to 500"); no limit means any amount.
 * A person with several roles gets the most generous one. Nobody approves an expense they entered themselves.
 */
export interface ApproverRole { canApprove: boolean; limit: number | null }

/** `null` = any amount, a number = up to and including that amount, `undefined` = may not approve at all. */
export function limitFor(roles: ApproverRole[]): number | null | undefined {
  const can = roles.filter((r) => r.canApprove);
  if (!can.length) return undefined;
  if (can.some((r) => r.limit === null)) return null;
  return Math.max(...can.map((r) => r.limit as number));
}

export interface ReviewCheck { ok: boolean; reason?: string }

export function mayReview(e: { amount: number; createdByUserId: string }, userId: string, limit: number | null | undefined, money: (n: number) => string = (n) => String(n)): ReviewCheck {
  if (limit === undefined) return { ok: false, reason: "You are not allowed to approve expenses." };
  if (e.createdByUserId === userId) return { ok: false, reason: "You entered this one, so someone else has to review it." };
  if (limit !== null && e.amount > limit) return { ok: false, reason: `Above your limit of ${money(limit)}. The owner needs to approve this one.` };
  return { ok: true };
}
