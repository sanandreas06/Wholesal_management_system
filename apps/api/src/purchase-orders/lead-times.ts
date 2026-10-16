import { PrismaService } from "../prisma/prisma.service";

export interface LearnedLead { days: number; samples: number }

/**
 * How long each supplier really takes: days from the order date to the first delivery recorded against that order.
 * The middle value of the supplier's last 10 delivered orders, and only once there are at least 2 of them (one delivery proves nothing).
 */
export async function learnedLeadTimes(prisma: PrismaService, organizationId: string): Promise<Map<string, LearnedLead>> {
  const receipts: { receivedAt: Date; purchaseOrder: { id: string; supplierId: string; orderDate: Date } }[] = await prisma.goodsReceipt.findMany({
    where: { organizationId, receivedAt: { gte: new Date(Date.now() - 730 * 86_400_000) } },
    orderBy: { receivedAt: "asc" },
    select: { receivedAt: true, purchaseOrder: { select: { id: true, supplierId: true, orderDate: true } } },
  });
  const firstDelivery = new Map<string, { supplierId: string; ordered: number; days: number }>();
  for (const r of receipts) {
    if (firstDelivery.has(r.purchaseOrder.id)) continue; // receipts are oldest first, so the first one seen is the first delivery
    const days = (r.receivedAt.getTime() - r.purchaseOrder.orderDate.getTime()) / 86_400_000;
    if (days < 0 || days > 180) continue; // back-dated or forgotten orders say nothing about the supplier
    firstDelivery.set(r.purchaseOrder.id, { supplierId: r.purchaseOrder.supplierId, ordered: r.purchaseOrder.orderDate.getTime(), days });
  }
  const bySupplier = new Map<string, { ordered: number; days: number }[]>();
  for (const d of firstDelivery.values()) bySupplier.set(d.supplierId, [...(bySupplier.get(d.supplierId) ?? []), d]);
  const out = new Map<string, LearnedLead>();
  for (const [id, list] of bySupplier) {
    const recent = list.sort((a, b) => b.ordered - a.ordered).slice(0, 10).map((x) => x.days).sort((a, b) => a - b);
    if (recent.length < 2) continue;
    const mid = recent.length % 2 ? recent[(recent.length - 1) / 2] : (recent[recent.length / 2 - 1] + recent[recent.length / 2]) / 2;
    out.set(id, { days: Math.max(1, Math.round(mid)), samples: recent.length });
  }
  return out;
}
