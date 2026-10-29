/**
 * Goods that are sold but not yet collected or delivered are still on the shelf (stock leaves only when they are released by scanning),
 * but they belong to a customer. This gives, per product, how many at a branch are owed to customers, so they cannot be sold
 * or sent to another branch a second time.
 */
type Db = { saleItem: { findMany(args: unknown): Promise<{ productId: string; quantity: number; releasedQuantity: number | null }[]> } };

export async function reservedAt(db: Db, organizationId: string, branchId: string, productIds?: string[]): Promise<Map<string, number>> {
  const rows = await db.saleItem.findMany({
    where: { ...(productIds ? { productId: { in: productIds } } : {}), sale: { organizationId, branchId, status: "COMPLETED", fulfilment: { in: ["AWAITING", "PARTLY"] } } },
    select: { productId: true, quantity: true, releasedQuantity: true },
  });
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.productId, (out.get(r.productId) ?? 0) + Math.max(0, r.quantity - (r.releasedQuantity ?? 0)));
  return out;
}
