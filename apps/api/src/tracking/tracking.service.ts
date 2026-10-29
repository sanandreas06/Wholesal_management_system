import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { AuthUser } from "../common/types/auth-user.type";
import { assertBranch, scopeOf } from "../common/branch/branch-scope";
import { cleanCodes, newItemCode } from "./codes";

type Tx = Prisma.TransactionClient;

export interface IssueInput {
  organizationId: string; branchId: string; otherBranchId?: string | null; kind: string; title: string; detail: string;
  productId?: string | null; quantity?: number | null; itemCodes?: string[]; referenceType?: string; referenceId?: string; referenceNumber?: string; userId?: string | null;
}

/** One line of a scanned handover (goods in, sending, receiving, releasing). */
export interface ScanLine { productId: string; quantity: number; scanned: number; codes?: string[] }

const OUTCOMES = ["CLEARED", "AT_FAULT", "RECOVERED"] as const;

/**
 * Item tracking. Everyday goods are counted by the maker's barcode at every handover; products set to "track each item"
 * also get a WHOLESTRA label per item, so each one has its own history and last known place.
 * Any handover that was not confirmed by scanning, or where fewer items arrived than left, becomes a handover issue
 * that the branch must explain and the owner (or administrator) closes.
 */
@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  // ------------------------------------------------------------------ building blocks used by receiving and transfers

  /** Creates `count` new labelled items for a product at a branch, inside the caller's transaction. Returns the codes. */
  async labelItems(tx: Tx, p: { organizationId: string; productId: string; branchId: string; count: number; userId?: string; referenceType: string; referenceId: string; note?: string }) {
    const codes: string[] = [];
    while (codes.length < p.count) { const c = newItemCode(); if (!codes.includes(c)) codes.push(c); }
    if (!codes.length) return codes;
    await tx.stockItem.createMany({ data: codes.map((code) => ({ organizationId: p.organizationId, productId: p.productId, code, branchId: p.branchId })) });
    const items = await tx.stockItem.findMany({ where: { code: { in: codes } }, select: { id: true } });
    await tx.stockItemEvent.createMany({ data: items.map((i) => ({ organizationId: p.organizationId, itemId: i.id, type: "LABELLED", branchId: p.branchId, userId: p.userId, referenceType: p.referenceType, referenceId: p.referenceId, note: p.note })) });
    return codes;
  }

  /** Writes events for a set of items in one go. */
  async events(tx: Tx, organizationId: string, itemIds: string[], e: { type: string; branchId?: string | null; userId?: string; referenceType?: string; referenceId?: string; note?: string }) {
    if (!itemIds.length) return;
    await tx.stockItemEvent.createMany({ data: itemIds.map((itemId) => ({ organizationId, itemId, type: e.type, branchId: e.branchId ?? null, userId: e.userId, referenceType: e.referenceType, referenceId: e.referenceId, note: e.note })) });
  }

  async raise(tx: Tx, i: IssueInput) {
    return tx.handoverIssue.create({ data: { ...i, itemCodes: i.itemCodes ?? [] } });
  }

  /** Checks the scanned item labels for one product: real, this company's, this product, in the expected state and place, no repeats. */
  async checkItemCodes(tx: Tx, organizationId: string, productName: string, productId: string, codes: string[], where: { status: "IN_STOCK" | "IN_TRANSIT"; branchId?: string; transferId?: string }) {
    const dup = codes.find((c, i) => codes.indexOf(c) !== i);
    if (dup) throw new BadRequestException(`Label ${dup} was scanned twice for "${productName}". Each item is scanned once.`);
    if (!codes.length) return [] as { id: string; code: string }[];
    const found = await tx.stockItem.findMany({ where: { organizationId, code: { in: codes } }, select: { id: true, code: true, productId: true, status: true, branchId: true, transferId: true } });
    for (const c of codes) {
      const it = found.find((f) => f.code === c);
      if (!it) throw new BadRequestException(`Label ${c} is not a WHOLESTRA item of this company.`);
      if (it.productId !== productId) throw new BadRequestException(`Label ${c} belongs to a different product, not "${productName}".`);
      if (it.status !== where.status) throw new BadRequestException(`Label ${c} is ${it.status.replace("_", " ").toLowerCase()}, so it cannot be used here.`);
      if (where.branchId && it.branchId !== where.branchId) throw new BadRequestException(`Label ${c} is recorded at another branch.`);
      if (where.transferId && it.transferId !== where.transferId) throw new BadRequestException(`Label ${c} is not on this transfer.`);
    }
    return found.map((f) => ({ id: f.id, code: f.code }));
  }

  /** Validates scanned counts against stated counts. Returns true when everything was scanned. Throws on impossible numbers. */
  static scannedAll(lines: { name: string; quantity: number; scanned: number; exempt?: boolean }[]) {
    for (const l of lines) if (l.scanned > l.quantity) throw new BadRequestException(`"${l.name}": ${l.scanned} were scanned but you said ${l.quantity}. Fix the number or remove the extra scans.`);
    // a product with no barcode at all cannot be scanned, so it is not held against anyone (the Scan page asks for barcodes instead)
    return lines.every((l) => l.exempt || l.scanned === l.quantity);
  }

  /** Lines that should have been scanned but were not, for the question's text. */
  static missed(lines: { name: string; quantity: number; scanned: number; exempt?: boolean }[]) {
    return lines.filter((l) => !l.exempt && l.scanned < l.quantity).map((l) => `${l.quantity - l.scanned} × ${l.name}`);
  }

  static needReason(reason: string | undefined) {
    const r = (reason ?? "").trim();
    if (r.length < 5) throw new BadRequestException("Some items were not scanned. Say why (for example, \"barcode torn\") so the manager can check it.");
    return r;
  }

  // ------------------------------------------------------------------ goods in without a purchase order

  async goodsIn(user: AuthUser, dto: { branchId: string; lines: ScanLine[]; reason?: string; note?: string; supplierName?: string }) {
    const org = user.organizationId;
    assertBranch(user, dto.branchId);
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId: org }, select: { id: true, name: true } });
    if (!branch) throw new NotFoundException("Branch not found");
    const ids = [...new Set(dto.lines.map((l) => l.productId))];
    if (ids.length !== dto.lines.length) throw new BadRequestException("Each product should appear once.");
    const products = await this.prisma.product.findMany({ where: { id: { in: ids }, organizationId: org }, select: { id: true, name: true, trackItems: true, barcodes: true } });
    if (products.length !== ids.length) throw new NotFoundException("One or more products were not found");
    const byId = new Map(products.map((p) => [p.id, p]));
    const counted = dto.lines.map((l) => { const p = byId.get(l.productId)!; return { name: p.name, quantity: l.quantity, scanned: l.scanned, exempt: !p.barcodes.length && !p.trackItems }; });
    const all = TrackingService.scannedAll(counted);
    const reason = all ? undefined : TrackingService.needReason(dto.reason);
    const ref = randomUUID(), number = `GI-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${ref.slice(0, 4).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const labels: Record<string, string[]> = {};
      for (const l of dto.lines) {
        const p = byId.get(l.productId)!;
        await this.inventory.adjustStock(tx, { organizationId: org, productId: p.id, branchId: branch.id, type: "RECEIPT", quantityDelta: l.quantity, referenceType: "GoodsIn", referenceId: ref, userId: user.sub,
          notes: `Goods in ${number}${dto.supplierName ? ` from ${dto.supplierName}` : ""}${all ? " (scanned)" : " (typed by hand)"}${dto.note ? `: ${dto.note}` : ""}` });
        if (p.trackItems) labels[p.id] = await this.labelItems(tx, { organizationId: org, productId: p.id, branchId: branch.id, count: l.quantity, userId: user.sub, referenceType: "GoodsIn", referenceId: ref, note: number });
      }
      if (!all) {
        const missed = TrackingService.missed(counted);
        await this.raise(tx, { organizationId: org, branchId: branch.id, kind: "NOT_SCANNED_RECEIPT", title: `Goods in ${number} not fully scanned`, detail: `${missed.join(", ")} were counted by hand at ${branch.name}. Reason given: ${reason}`, referenceType: "GoodsIn", referenceId: ref, referenceNumber: number, userId: user.sub });
      }
      return { reference: ref, number, byScan: all, labels };
    });
  }

  // ------------------------------------------------------------------ labels for stock already on the shelf

  async labelExisting(user: AuthUser, dto: { productId: string; branchId: string; quantity: number }) {
    const org = user.organizationId;
    assertBranch(user, dto.branchId);
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, organizationId: org }, select: { id: true, name: true, trackItems: true } });
    if (!product) throw new NotFoundException("Product not found");
    if (!product.trackItems) throw new BadRequestException(`Turn on "Track each item" for "${product.name}" first.`);
    const inv = await this.prisma.inventory.findUnique({ where: { productId_branchId: { productId: product.id, branchId: dto.branchId } } });
    const labelled = await this.prisma.stockItem.count({ where: { organizationId: org, productId: product.id, branchId: dto.branchId, status: "IN_STOCK" } });
    const room = Math.max(0, (inv?.quantity ?? 0) - labelled);
    if (dto.quantity > room) throw new BadRequestException(room ? `Only ${room} of "${product.name}" at this branch still need labels.` : `Every "${product.name}" at this branch already has a label.`);
    const ref = randomUUID();
    const codes = await this.prisma.$transaction((tx) => this.labelItems(tx, { organizationId: org, productId: product.id, branchId: dto.branchId, count: dto.quantity, userId: user.sub, referenceType: "LabelRun", referenceId: ref, note: "Labels for stock already on the shelf" }));
    return { reference: ref, codes };
  }

  /** How many of each tracked product at a branch still have no label (to offer a "print labels" button). */
  async unlabelled(user: AuthUser, branchId: string) {
    assertBranch(user, branchId);
    const org = user.organizationId;
    const inv = await this.prisma.inventory.findMany({ where: { organizationId: org, branchId, quantity: { gt: 0 }, product: { trackItems: true } }, select: { quantity: true, product: { select: { id: true, name: true, sku: true } } } });
    if (!inv.length) return [];
    const counts = await this.prisma.stockItem.groupBy({ by: ["productId"], where: { organizationId: org, branchId, status: "IN_STOCK" }, _count: { _all: true } });
    const have = new Map(counts.map((c) => [c.productId, c._count._all]));
    return inv.map((i) => ({ productId: i.product.id, name: i.product.name, sku: i.product.sku, onHand: i.quantity, labelled: have.get(i.product.id) ?? 0 }))
      .map((r) => ({ ...r, missing: Math.max(0, r.onHand - r.labelled) })).filter((r) => r.missing > 0);
  }

  /** The labels to print: those made by one run (goods in, purchase order receipt, label run), or chosen item codes. */
  async labels(user: AuthUser, q: { reference?: string; codes?: string[] }) {
    const org = user.organizationId;
    let ids: string[] | undefined;
    if (q.reference) ids = (await this.prisma.stockItemEvent.findMany({ where: { organizationId: org, referenceId: q.reference, type: "LABELLED" }, select: { itemId: true } })).map((e) => e.itemId);
    const items = await this.prisma.stockItem.findMany({
      where: { organizationId: org, ...(ids ? { id: { in: ids } } : { code: { in: cleanCodes(q.codes).slice(0, 2000) } }), ...(scopeOf(user) ? { branchId: scopeOf(user)! } : {}) },
      orderBy: [{ productId: "asc" }, { createdAt: "asc" }], select: { code: true, product: { select: { name: true, sku: true, unitPrice: true } } },
    });
    const org_ = await this.prisma.organization.findUnique({ where: { id: org }, select: { name: true } });
    return { company: org_?.name ?? "", labels: items.map((i) => ({ code: i.code, name: i.product.name, sku: i.product.sku, price: Number(i.product.unitPrice) })) };
  }

  /** The labelled items on the shelf at a branch, so the counter can recognise item labels while the internet is down. */
  async codesAt(user: AuthUser, branchId: string) {
    assertBranch(user, branchId);
    const rows = await this.prisma.stockItem.findMany({ where: { organizationId: user.organizationId, branchId, status: "IN_STOCK" }, select: { code: true, productId: true }, take: 20000 });
    return rows.map((r) => [r.code, r.productId] as [string, string]);
  }

  // ------------------------------------------------------------------ finding things

  /** Scan or type any code: an item label shows that item's story; a product barcode shows where that product is right now. */
  async find(user: AuthUser, raw: string) {
    const org = user.organizationId, code = cleanCodes([raw])[0];
    if (!code) throw new BadRequestException("Scan or type a code.");
    const item = await this.prisma.stockItem.findFirst({ where: { organizationId: org, code }, include: { product: { select: { id: true, name: true, sku: true } }, events: { orderBy: { createdAt: "asc" } } } });
    if (item) {
      const mine = scopeOf(user);
      if (mine && item.branchId !== mine && !item.events.some((e) => e.branchId === mine)) throw new NotFoundException("This label is not one of your branch's items.");
      const branchIds = [...new Set([item.branchId, ...item.events.map((e) => e.branchId)].filter((x): x is string => !!x))];
      const userIds = [...new Set(item.events.map((e) => e.userId).filter((x): x is string => !!x))];
      const [branches, users, transfer] = await Promise.all([
        this.prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }),
        this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
        item.transferId ? this.prisma.stockTransfer.findUnique({ where: { id: item.transferId }, select: { transferNumber: true, fromBranch: { select: { name: true } }, toBranch: { select: { name: true } } } }) : null,
      ]);
      const bn = new Map(branches.map((b) => [b.id, b.name])), un = new Map(users.map((u) => [u.id, u.name]));
      const last = [...item.events].reverse().find((e) => e.branchId);
      const where = item.status === "IN_STOCK" ? `In stock at ${bn.get(item.branchId!) ?? "a branch"}`
        : item.status === "IN_TRANSIT" ? `On the way ${transfer ? `from ${transfer.fromBranch.name} to ${transfer.toBranch.name} (${transfer.transferNumber})` : ""}`
        : item.status === "MISSING" ? `Missing. Last confirmed ${last ? `at ${bn.get(last.branchId!)}` : ""}${transfer ? `, then sent on ${transfer.transferNumber} from ${transfer.fromBranch.name} to ${transfer.toBranch.name}, where it was not scanned in` : ""}`
        : item.status === "SOLD" ? "Sold" : "Written off";
      return {
        kind: "item" as const, code: item.code, status: item.status, where, product: item.product, branch: item.branchId ? bn.get(item.branchId) ?? null : null,
        history: item.events.map((e) => ({ type: e.type, at: e.createdAt, branch: e.branchId ? bn.get(e.branchId) ?? null : null, by: e.userId ? un.get(e.userId) ?? null : null, note: e.note, referenceType: e.referenceType, referenceId: e.referenceId })),
      };
    }
    const product = await this.prisma.product.findFirst({ where: { organizationId: org, OR: [{ barcodes: { has: code } }, { sku: { equals: code, mode: "insensitive" } }] }, select: { id: true, name: true, sku: true, trackItems: true } });
    if (!product) throw new NotFoundException(`Nothing in WHOLESTRA has the code ${code}.`);
    const mine = scopeOf(user);
    const [stock, moving, missing] = await Promise.all([
      this.prisma.inventory.findMany({ where: { organizationId: org, productId: product.id, ...(mine ? { branchId: mine } : {}) }, select: { quantity: true, branch: { select: { name: true } } }, orderBy: { quantity: "desc" } }),
      this.prisma.stockTransferItem.findMany({ where: { productId: product.id, stockTransfer: { organizationId: org, status: "DISPATCHED", ...(mine ? { OR: [{ fromBranchId: mine }, { toBranchId: mine }] } : {}) } },
        select: { quantity: true, sentQuantity: true, stockTransfer: { select: { id: true, transferNumber: true, dispatchedAt: true, fromBranch: { select: { name: true } }, toBranch: { select: { name: true } } } } } }),
      product.trackItems ? this.prisma.stockItem.count({ where: { organizationId: org, productId: product.id, status: "MISSING" } }) : Promise.resolve(0),
    ]);
    return {
      kind: "product" as const, product,
      branches: stock.map((s) => ({ branch: s.branch.name, quantity: s.quantity })),
      inTransit: moving.map((m) => ({ transferId: m.stockTransfer.id, transferNumber: m.stockTransfer.transferNumber, from: m.stockTransfer.fromBranch.name, to: m.stockTransfer.toBranch.name, quantity: m.sentQuantity ?? m.quantity, since: m.stockTransfer.dispatchedAt })),
      missingItems: missing,
    };
  }

  /** A missing labelled item turned up: it goes back into stock where it was scanned, and its story says so. */
  async found(user: AuthUser, raw: string, branchId: string) {
    const org = user.organizationId, code = cleanCodes([raw])[0];
    assertBranch(user, branchId);
    const item = await this.prisma.stockItem.findFirst({ where: { organizationId: org, code }, include: { product: { select: { name: true } } } });
    if (!item) throw new NotFoundException("No item has this label.");
    if (item.status !== "MISSING") throw new ConflictException(`This item is not missing: it is ${item.status.replace("_", " ").toLowerCase()}.`);
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: org }, select: { name: true } });
    if (!branch) throw new NotFoundException("Branch not found");
    await this.prisma.$transaction(async (tx) => {
      await this.inventory.adjustStock(tx, { organizationId: org, productId: item.productId, branchId, type: "ADJUSTMENT", quantityDelta: 1, referenceType: "StockItem", referenceId: item.id, userId: user.sub, notes: `Missing item ${item.code} found and scanned at ${branch.name}` });
      await tx.stockItem.update({ where: { id: item.id }, data: { status: "IN_STOCK", branchId, transferId: null } });
      await this.events(tx, org, [item.id], { type: "FOUND", branchId, userId: user.sub, note: `Found at ${branch.name}` });
      const open = await tx.handoverIssue.findMany({ where: { organizationId: org, itemCodes: { has: item.code }, status: { not: "CLOSED" } }, select: { id: true, detail: true } });
      for (const o of open) await tx.handoverIssue.update({ where: { id: o.id }, data: { detail: `${o.detail}\nUpdate: ${item.code} was found at ${branch.name} on ${new Date().toLocaleDateString("en-GB")}.` } });
    });
    return { ok: true, message: `${item.product.name} (${item.code}) is back in stock at ${branch.name}.` };
  }

  // ------------------------------------------------------------------ handover issues: question, explain, close

  async issues(user: AuthUser, status?: string) {
    const org = user.organizationId, mine = scopeOf(user);
    const where: Prisma.HandoverIssueWhereInput = { organizationId: org, ...(status === "OPEN" ? { status: { in: ["OPEN", "EXPLAINED"] } } : status === "CLOSED" ? { status: "CLOSED" } : {}), ...(mine ? { OR: [{ branchId: mine }, { otherBranchId: mine }] } : {}) };
    const rows = await this.prisma.handoverIssue.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
    const branchIds = [...new Set(rows.flatMap((r) => [r.branchId, r.otherBranchId]).filter((x): x is string => !!x))];
    const userIds = [...new Set(rows.flatMap((r) => [r.userId, r.explainedByUserId, r.resolvedByUserId]).filter((x): x is string => !!x))];
    const productIds = [...new Set(rows.map((r) => r.productId).filter((x): x is string => !!x))];
    const [b, u, p] = await Promise.all([
      this.prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }),
    ]);
    const bn = new Map(b.map((x) => [x.id, x.name])), un = new Map(u.map((x) => [x.id, x.name])), pn = new Map(p.map((x) => [x.id, x.name]));
    return rows.map((r) => ({
      ...r, branch: bn.get(r.branchId) ?? "", otherBranch: r.otherBranchId ? bn.get(r.otherBranchId) ?? "" : null, product: r.productId ? pn.get(r.productId) ?? null : null,
      by: r.userId ? un.get(r.userId) ?? null : null, explainedBy: r.explainedByUserId ? un.get(r.explainedByUserId) ?? null : null, resolvedBy: r.resolvedByUserId ? un.get(r.resolvedByUserId) ?? null : null,
    }));
  }

  private async issueFor(user: AuthUser, id: string) {
    const i = await this.prisma.handoverIssue.findFirst({ where: { id, organizationId: user.organizationId } });
    const mine = scopeOf(user);
    if (!i || (mine && i.branchId !== mine && i.otherBranchId !== mine)) throw new NotFoundException("Issue not found");
    return i;
  }

  async explain(user: AuthUser, id: string, text: string) {
    const i = await this.issueFor(user, id);
    if (i.status === "CLOSED") throw new ConflictException("This issue is already closed.");
    const t = (text ?? "").trim();
    if (t.length < 5) throw new BadRequestException("Write what happened (at least a few words).");
    const stamp = `${new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" })}`;
    return this.prisma.handoverIssue.update({ where: { id }, data: { explanation: i.explanation ? `${i.explanation}\n[${stamp}] ${t}` : `[${stamp}] ${t}`, explainedByUserId: user.sub, explainedAt: new Date(), status: "EXPLAINED" } });
  }

  async close(user: AuthUser, id: string, outcome: string, resolution: string) {
    const i = await this.issueFor(user, id);
    if (i.status === "CLOSED") throw new ConflictException("This issue is already closed.");
    if (i.userId && i.userId === user.sub) throw new ForbiddenException("You did this handover, so someone else has to close the issue.");
    if (!(OUTCOMES as readonly string[]).includes(outcome)) throw new BadRequestException("Choose an outcome.");
    const r = (resolution ?? "").trim();
    if (r.length < 3) throw new BadRequestException("Write the decision, so there is a record of it.");
    return this.prisma.handoverIssue.update({ where: { id }, data: { status: "CLOSED", outcome, resolution: r, resolvedByUserId: user.sub, resolvedAt: new Date() } });
  }
}
