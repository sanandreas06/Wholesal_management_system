import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditFlag {
  id: string;
  severity: "high" | "medium" | "low";
  type: string;
  title: string;
  description: string;
  branchName?: string;
  userName?: string;
  productName?: string;
  occurredAt: Date;
}

const LARGE_REDUCTION_RATIO = 0.4; // a single adjustment removing 40%+ of stock in one go
const LARGE_REDUCTION_ABSOLUTE = 50; // or removing 50+ units outright, regardless of ratio
const FREQUENT_ADJUSTMENTS_THRESHOLD = 3; // same user, negative adjustments, within the window
const FREQUENT_ADJUSTMENTS_WINDOW_DAYS = 7;
const RECURRING_SHORTAGE_WINDOW_DAYS = 30;
const RECURRING_SHORTAGE_MIN_COUNTS = 2; // separate stock counts showing a shortage at the same branch
const OFF_HOURS_START = 22; // 10pm
const OFF_HOURS_END = 5; // 5am

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getFlags(organizationId: string): Promise<AuditFlag[]> {
    const [largeReductions, frequentAdjusters, recurringShortages, offHours] = await Promise.all([
      this.detectLargeReductions(organizationId),
      this.detectFrequentAdjusters(organizationId),
      this.detectRecurringShortages(organizationId),
      this.detectOffHoursActivity(organizationId),
    ]);

    const all = [...largeReductions, ...frequentAdjusters, ...recurringShortages, ...offHours];
    const severityRank = { high: 0, medium: 1, low: 2 };
    return all.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 50);
  }

  private async detectLargeReductions(organizationId: string): Promise<AuditFlag[]> {
    const movements = await this.prisma.stockMovement.findMany({
      where: { organizationId, type: "ADJUSTMENT", quantityDelta: { lt: 0 } },
      include: { product: { select: { name: true } }, branch: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const flags: AuditFlag[] = [];
    for (const m of movements) {
      const previousQty = m.resultingQuantity - m.quantityDelta;
      const removed = Math.abs(m.quantityDelta);
      const ratio = previousQty > 0 ? removed / previousQty : 0;
      if (removed >= LARGE_REDUCTION_ABSOLUTE || ratio >= LARGE_REDUCTION_RATIO) {
        flags.push({
          id: `large-reduction-${m.id}`,
          severity: removed >= LARGE_REDUCTION_ABSOLUTE * 2 || ratio >= 0.7 ? "high" : "medium",
          type: "LARGE_REDUCTION",
          title: "Large single stock reduction",
          description: `${m.user?.name ?? "Someone"} reduced "${m.product.name}" at ${m.branch.name} by ${removed} units in one adjustment (${previousQty > 0 ? Math.round(ratio * 100) : "?"}% of stock on hand).`,
          branchName: m.branch.name, userName: m.user?.name, productName: m.product.name,
          occurredAt: m.createdAt,
        });
      }
    }
    return flags;
  }

  private async detectFrequentAdjusters(organizationId: string): Promise<AuditFlag[]> {
    const since = new Date(Date.now() - FREQUENT_ADJUSTMENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const movements = await this.prisma.stockMovement.findMany({
      where: { organizationId, type: "ADJUSTMENT", quantityDelta: { lt: 0 }, userId: { not: null }, createdAt: { gte: since } },
      include: { user: { select: { name: true } }, branch: { select: { name: true } } },
    });

    const byUser = new Map<string, { name: string; count: number; branches: Set<string>; latest: Date }>();
    for (const m of movements) {
      if (!m.userId) continue;
      const entry = byUser.get(m.userId) ?? { name: m.user?.name ?? "Unknown user", count: 0, branches: new Set(), latest: m.createdAt };
      entry.count += 1;
      entry.branches.add(m.branch.name);
      if (m.createdAt > entry.latest) entry.latest = m.createdAt;
      byUser.set(m.userId, entry);
    }

    const flags: AuditFlag[] = [];
    for (const [userId, entry] of byUser) {
      if (entry.count >= FREQUENT_ADJUSTMENTS_THRESHOLD) {
        flags.push({
          id: `frequent-adjuster-${userId}`,
          severity: entry.count >= FREQUENT_ADJUSTMENTS_THRESHOLD * 2 ? "high" : "medium",
          type: "FREQUENT_REDUCTIONS",
          title: "Frequent stock reductions by one user",
          description: `${entry.name} recorded ${entry.count} separate stock reductions across ${entry.branches.size} branch(es) in the last ${FREQUENT_ADJUSTMENTS_WINDOW_DAYS} days.`,
          userName: entry.name,
          occurredAt: entry.latest,
        });
      }
    }
    return flags;
  }

  private async detectRecurringShortages(organizationId: string): Promise<AuditFlag[]> {
    const since = new Date(Date.now() - RECURRING_SHORTAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const movements = await this.prisma.stockMovement.findMany({
      where: { organizationId, type: "COUNT_VARIANCE", quantityDelta: { lt: 0 }, createdAt: { gte: since } },
      include: { branch: { select: { name: true } } },
    });

    const byBranch = new Map<string, { name: string; referenceIds: Set<string>; latest: Date }>();
    for (const m of movements) {
      const entry = byBranch.get(m.branchId) ?? { name: m.branch.name, referenceIds: new Set(), latest: m.createdAt };
      if (m.referenceId) entry.referenceIds.add(m.referenceId);
      if (m.createdAt > entry.latest) entry.latest = m.createdAt;
      byBranch.set(m.branchId, entry);
    }

    const flags: AuditFlag[] = [];
    for (const [branchId, entry] of byBranch) {
      if (entry.referenceIds.size >= RECURRING_SHORTAGE_MIN_COUNTS) {
        flags.push({
          id: `recurring-shortage-${branchId}`,
          severity: "high",
          type: "RECURRING_SHORTAGE",
          title: "Recurring inventory shortages at a branch",
          description: `${entry.name} has shown a stock shortfall in ${entry.referenceIds.size} separate physical counts over the last ${RECURRING_SHORTAGE_WINDOW_DAYS} days — worth investigating for a pattern.`,
          branchName: entry.name,
          occurredAt: entry.latest,
        });
      }
    }
    return flags;
  }

  private async detectOffHoursActivity(organizationId: string): Promise<AuditFlag[]> {
    const movements = await this.prisma.stockMovement.findMany({
      where: { organizationId, type: { in: ["ADJUSTMENT", "COUNT_VARIANCE"] }, quantityDelta: { lt: 0 } },
      include: { product: { select: { name: true } }, branch: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const flags: AuditFlag[] = [];
    for (const m of movements) {
      const hour = m.createdAt.getHours();
      if (hour >= OFF_HOURS_START || hour < OFF_HOURS_END) {
        flags.push({
          id: `off-hours-${m.id}`,
          severity: "low",
          type: "OFF_HOURS",
          title: "Stock reduction recorded outside business hours",
          description: `${m.user?.name ?? "Someone"} reduced "${m.product.name}" at ${m.branch.name} at ${m.createdAt.toLocaleTimeString()} — outside typical working hours.`,
          branchName: m.branch.name, userName: m.user?.name, productName: m.product.name,
          occurredAt: m.createdAt,
        });
      }
    }
    return flags;
  }
}
