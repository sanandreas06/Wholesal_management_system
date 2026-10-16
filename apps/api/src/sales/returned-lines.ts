import { PrismaService } from "../prisma/prisma.service";

/** A sold line, as profit calculations see it. Returned goods are the same shape with a NEGATIVE quantity. */
export interface ProfitLine { productId: string; quantity: number; unitPrice: unknown; unitCost: unknown; sale: { branchId: string } }

/**
 * Goods customers brought back between `from` and `to` (by the date the return was recorded), shaped as negative sale lines
 * at the price and cost they were originally sold at. Adding them to the sold lines nets returns out of revenue, units and profit.
 */
export async function returnedLines(prisma: PrismaService, organizationId: string, from: Date, to: Date | null, branchId?: string): Promise<ProfitLine[]> {
  const rows: { quantity: number; saleItem: { productId: string; unitPrice: unknown; unitCost: unknown; sale: { branchId: string } } }[] = await prisma.saleReturnItem.findMany({
    where: { saleReturn: { organizationId, createdAt: to ? { gte: from, lt: to } : { gte: from }, ...(branchId ? { sale: { branchId } } : {}) } },
    select: { quantity: true, saleItem: { select: { productId: true, unitPrice: true, unitCost: true, sale: { select: { branchId: true } } } } },
  });
  return rows.map((r) => ({ productId: r.saleItem.productId, quantity: -r.quantity, unitPrice: r.saleItem.unitPrice, unitCost: r.saleItem.unitCost, sale: r.saleItem.sale }));
}
