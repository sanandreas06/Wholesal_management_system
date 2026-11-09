import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { AuthUser } from "../common/types/auth-user.type";
import { assertBranch, scopeOf } from "../common/branch/branch-scope";
import { cleanCodes, newItemCode } from "./codes";
import { codeFromScan } from "../products/own-code";
import { place } from "../trips/geo";

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
  async labelItems(tx: Tx, p: { organizationId: string; productId: string; branchId: string; count: number; userId?: string; referenceType: string; referenceId: string; note?: string; where?: { lat: number; lng: number } | null }) {
    const codes: string[] = [];
    while (codes.length < p.count) { const c = newItemCode(); if (!codes.includes(c)) codes.push(c); }
    if (!codes.length) return codes;
    // a new label is only "waiting": it becomes stock when it has been stuck on an item and scanned (see stick())
    await tx.stockItem.createMany({ data: codes.map((code) => ({ organizationId: p.organizationId, productId: p.productId, code, branchId: p.branchId, status: "PENDING" as const, labelRef: p.referenceId })) });
    const items = await tx.stockItem.findMany({ where: { code: { in: codes } }, select: { id: true } });
    await tx.stockItemEvent.createMany({ data: items.map((i) => ({ organizationId: p.organizationId, itemId: i.id, type: "LABELLED", branchId: p.branchId, userId: p.userId, referenceType: p.referenceType, referenceId: p.referenceId, note: p.note, lat: p.where?.lat ?? null, lng: p.where?.lng ?? null })) });
    return codes;
  }

  /** Writes events for a set of items in one go. */
  async events(tx: Tx, organizationId: string, itemIds: string[], e: { type: string; branchId?: string | null; userId?: string; referenceType?: string; referenceId?: string; note?: string; where?: { lat: number; lng: number } | null }) {
    if (!itemIds.length) return;
    await tx.stockItemEvent.createMany({ data: itemIds.map((itemId) => ({ organizationId, itemId, type: e.type, branchId: e.branchId ?? null, userId: e.userId, referenceType: e.referenceType, referenceId: e.referenceId, note: e.note, lat: e.where?.lat ?? null, lng: e.where?.lng ?? null })) });
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

  /**
   * Goods arriving from a supplier are new: they cannot already carry a WHOLESTRA item label. A label that WHOLESTRA already knows
   * (on the shelf, sold, on the road) scanned at goods in is someone counting old stock as new, so it is refused.
   */
  async assertNewGoods(organizationId: string, raw: string[]) {
    const codes = cleanCodes(raw).filter((c, i, a) => a.indexOf(c) === i);
    if (!codes.length) return;
    const known = await this.prisma.stockItem.findFirst({ where: { organizationId, code: { in: codes } }, select: { code: true, status: true, branchId: true, product: { select: { name: true } } } });
    if (!known) return;
    const at = known.branchId ? (await this.prisma.branch.findUnique({ where: { id: known.branchId }, select: { name: true } }))?.name : null;
    const state = known.status === "PENDING" ? `a label already printed${at ? ` at ${at}` : ""} and waiting to be stuck on an item` : known.status === "VOID" ? "a cancelled label" : known.status === "IN_STOCK" ? `already in stock${at ? ` at ${at}` : ""}` : known.status === "SOLD" ? "already sold" : known.status === "IN_TRANSIT" ? "on the road on a transfer" : known.status === "MISSING" ? "recorded as missing (use Find, then \"It is here\")" : "written off";
    throw new BadRequestException(`${known.product.name} (${known.code}) is ${state}. It is not new stock, so it cannot be received as goods in.`);
  }

  // ------------------------------------------------------------------ goods in without a purchase order

  async goodsIn(user: AuthUser, dto: { branchId: string; lines: ScanLine[]; reason?: string; note?: string; supplierName?: string; where?: { lat: number; lng: number; accuracy?: number } }) {
    const org = user.organizationId;
    assertBranch(user, dto.branchId);
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId: org }, select: { id: true, name: true } });
    if (!branch) throw new NotFoundException("Branch not found");
    const ids = [...new Set(dto.lines.map((l) => l.productId))];
    if (ids.length !== dto.lines.length) throw new BadRequestException("Each product should appear once.");
    const products = await this.prisma.product.findMany({ where: { id: { in: ids }, organizationId: org }, select: { id: true, name: true, trackItems: true, barcodes: true, ownCode: true } });
    if (products.length !== ids.length) throw new NotFoundException("One or more products were not found");
    const byId = new Map(products.map((p) => [p.id, p]));
    await this.assertNewGoods(org, dto.lines.flatMap((l) => l.codes ?? []));
    const counted = dto.lines.map((l) => { const p = byId.get(l.productId)!; return { name: p.name, quantity: l.quantity, scanned: l.scanned, exempt: !p.barcodes.some((b) => b !== p.ownCode) && !p.trackItems }; }); // arriving goods carry no WHOLESTRA label yet: only the maker's barcode can be scanned
    const all = TrackingService.scannedAll(counted);
    const reason = all ? undefined : TrackingService.needReason(dto.reason);
    const ref = randomUUID(), number = `GI-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${ref.slice(0, 4).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const labels: Record<string, string[]> = {};
      for (const l of dto.lines) {
        const p = byId.get(l.productId)!;
        await this.inventory.adjustStock(tx, { organizationId: org, productId: p.id, branchId: branch.id, type: "RECEIPT", quantityDelta: l.quantity, referenceType: "GoodsIn", referenceId: ref, userId: user.sub,
          notes: `Goods in ${number}${dto.supplierName ? ` from ${dto.supplierName}` : ""}${all ? " (scanned)" : " (typed by hand)"}${dto.note ? `: ${dto.note}` : ""}` });
        if (p.trackItems) labels[p.id] = await this.labelItems(tx, { organizationId: org, productId: p.id, branchId: branch.id, count: l.quantity, userId: user.sub, referenceType: "GoodsIn", referenceId: ref, note: number, where: place(dto.where) });
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
    const labelled = await this.prisma.stockItem.count({ where: { organizationId: org, productId: product.id, branchId: dto.branchId, status: { in: ["IN_STOCK", "PENDING"] } } });
    const room = Math.max(0, (inv?.quantity ?? 0) - labelled);
    if (dto.quantity > room) throw new BadRequestException(room ? `Only ${room} of "${product.name}" at this branch still need labels.` : `Every "${product.name}" at this branch already has a label.`);
    const ref = randomUUID();
    const codes = await this.prisma.$transaction((tx) => this.labelItems(tx, { organizationId: org, productId: product.id, branchId: dto.branchId, count: dto.quantity, userId: user.sub, referenceType: "LabelRun", referenceId: ref, note: "Labels for stock already on the shelf" }));
    return { reference: ref, codes };
  }

  /**
   * Labels for every tracked item on the shelf at a branch that has none yet, in one go (up to 1000 per press, so a print run stays
   * manageable). Returns one reference for the label page.
   */
  async labelAllAt(user: AuthUser, branchId: string) {
    const rows = await this.unlabelled(user, branchId);
    if (!rows.length) throw new BadRequestException("Every item at this branch already has its own label.");
    const ref = randomUUID(); let left = 1000, made = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const r of rows) {
        if (left <= 0) break;
        const n = Math.min(r.missing, left);
        made += (await this.labelItems(tx, { organizationId: user.organizationId, productId: r.productId, branchId, count: n, userId: user.sub, referenceType: "LabelRun", referenceId: ref, note: "Labels for stock already on the shelf" })).length;
        left -= n;
      }
    }, { timeout: 60_000 });
    const remaining = rows.reduce((t, r) => t + r.missing, 0) - made;
    return { reference: ref, made, remaining };
  }

  // ------------------------------------------------------------------ stick and scan: a label only counts once it is on an item

  /** What a print run's labels are for, from the first label's story. */
  private async runInfo(org: string, ref: string) {
    const ev = await this.prisma.stockItemEvent.findFirst({ where: { organizationId: org, referenceId: ref, type: "LABELLED" }, orderBy: { createdAt: "asc" }, select: { referenceType: true, note: true, createdAt: true, branchId: true } });
    if (!ev) throw new NotFoundException("These labels were not found.");
    let number = ev.note ?? "";
    if (ev.referenceType === "GoodsReceipt") number = (await this.prisma.goodsReceipt.findUnique({ where: { id: ref }, select: { purchaseOrder: { select: { orderNumber: true } } } }))?.purchaseOrder.orderNumber ?? number;
    const kind = ev.referenceType === "LabelRun" ? "SHELF" : "GOODS_IN";
    return { kind, referenceType: ev.referenceType ?? "LabelRun", number: kind === "SHELF" ? "Labels for stock on the shelf" : number, createdAt: ev.createdAt, branchId: ev.branchId! };
  }

  /** A print run: every label, which are stuck and scanned, which are still waiting. */
  async stickRun(user: AuthUser, ref: string) {
    const org = user.organizationId, info = await this.runInfo(org, ref);
    assertBranch(user, info.branchId);
    const items = await this.prisma.stockItem.findMany({ where: { organizationId: org, labelRef: ref }, select: { code: true, status: true, productId: true, product: { select: { name: true, sku: true } } }, orderBy: [{ productId: "asc" }, { createdAt: "asc" }] });
    const branch = await this.prisma.branch.findUnique({ where: { id: info.branchId }, select: { name: true } });
    const lines = new Map<string, { productId: string; name: string; sku: string; total: number; waiting: string[]; stuck: number; cancelled: number }>();
    for (const i of items) {
      const l = lines.get(i.productId) ?? { productId: i.productId, name: i.product.name, sku: i.product.sku, total: 0, waiting: [], stuck: 0, cancelled: 0 };
      l.total++; if (i.status === "PENDING") l.waiting.push(i.code); else if (i.status === "VOID") l.cancelled++; else l.stuck++;
      lines.set(i.productId, l);
    }
    const all = [...lines.values()];
    return { reference: ref, ...info, branch: branch?.name ?? "", lines: all, waiting: all.reduce((t, l) => t + l.waiting.length, 0), open: all.some((l) => l.waiting.length > 0) };
  }

  /** Print runs at a branch with labels still waiting to be stuck and scanned. */
  async openRuns(user: AuthUser, branchId: string) {
    assertBranch(user, branchId);
    const org = user.organizationId;
    const groups = await this.prisma.stockItem.groupBy({ by: ["labelRef"], where: { organizationId: org, branchId, status: "PENDING", labelRef: { not: null } }, _count: { _all: true } });
    const out = [];
    for (const g of groups) { const info = await this.runInfo(org, g.labelRef!).catch(() => null); if (info) out.push({ reference: g.labelRef!, kind: info.kind, number: info.number, createdAt: info.createdAt, waiting: g._count._all }); }
    return out.sort((a, b) => +a.createdAt - +b.createdAt);
  }

  /**
   * The labels scanned after being stuck on the items become stock. Each label counts once. With `finish`, every label of the run
   * that was not scanned is cancelled: there was no item for it, so the stock is lowered to what was really labelled (and on a
   * purchase order, the supplier still owes it), and the owner gets a question.
   */
  async stick(user: AuthUser, ref: string, dto: { codes: string[]; finish?: boolean; where?: { lat: number; lng: number; accuracy?: number } }) {
    const org = user.organizationId, info = await this.runInfo(org, ref);
    assertBranch(user, info.branchId);
    const codes = cleanCodes(dto.codes);
    const dup = codes.find((c, i) => codes.indexOf(c) !== i);
    if (dup) throw new BadRequestException(`Label ${dup} was scanned twice. Each label counts once.`);
    const items = codes.length ? await this.prisma.stockItem.findMany({ where: { organizationId: org, code: { in: codes } }, select: { id: true, code: true, status: true, labelRef: true, productId: true } }) : [];
    for (const c of codes) {
      const it = items.find((i) => i.code === c);
      if (!it || it.labelRef !== ref) throw new BadRequestException(`Label ${c} is not from this print run. Put that item aside and tell the manager.`);
      if (it.status !== "PENDING") throw new BadRequestException(it.status === "VOID" ? `Label ${c} was cancelled when this run was finished.` : `Label ${c} was already scanned. Each label counts once.`);
    }
    const branch = await this.prisma.branch.findUnique({ where: { id: info.branchId }, select: { name: true } });
    const bName = branch?.name ?? "the branch";
    return this.prisma.$transaction(async (tx) => {
      if (items.length) {
        const n = await tx.stockItem.updateMany({ where: { id: { in: items.map((i) => i.id) }, status: "PENDING" }, data: { status: "IN_STOCK" } });
        if (n.count !== items.length) throw new ConflictException("Some of these labels were just scanned on another device. Open the list again.");
        await this.events(tx, org, items.map((i) => i.id), { type: "STUCK", branchId: info.branchId, userId: user.sub, referenceType: info.referenceType, referenceId: ref, note: "Label stuck on and scanned", where: place(dto.where) });
      }
      let cancelled = 0;
      if (dto.finish) {
        const left = await tx.stockItem.findMany({ where: { organizationId: org, labelRef: ref, status: "PENDING" }, select: { id: true, code: true, productId: true, product: { select: { name: true } } } });
        if (left.length) {
          await tx.stockItem.updateMany({ where: { id: { in: left.map((i) => i.id) } }, data: { status: "VOID", branchId: null } });
          await this.events(tx, org, left.map((i) => i.id), { type: "CANCELLED", branchId: info.branchId, userId: user.sub, referenceType: info.referenceType, referenceId: ref, note: "Label never stuck on an item" });
          const per = new Map<string, { name: string; n: number }>();
          for (const i of left) per.set(i.productId, { name: i.product.name, n: (per.get(i.productId)?.n ?? 0) + 1 });
          for (const [productId, p] of per) {
            await this.inventory.adjustStock(tx, { organizationId: org, productId, branchId: info.branchId, type: "ADJUSTMENT", quantityDelta: -p.n, referenceType: info.referenceType, referenceId: ref, userId: user.sub,
              notes: info.kind === "SHELF" ? `${p.n} label${p.n === 1 ? "" : "s"} had no item on the shelf to go on` : `${info.number}: ${p.n} label${p.n === 1 ? "" : "s"} never stuck on an item (fewer arrived than were counted)` });
            if (info.referenceType === "GoodsReceipt") {
              // the supplier did not deliver these: the purchase order and the receipt show what was really labelled
              const gri = await tx.goodsReceiptItem.findFirst({ where: { goodsReceiptId: ref, productId }, select: { id: true, purchaseOrderItemId: true } });
              if (gri) {
                await tx.goodsReceiptItem.update({ where: { id: gri.id }, data: { quantityReceived: { decrement: p.n } } });
                await tx.purchaseOrderItem.update({ where: { id: gri.purchaseOrderItemId }, data: { quantityReceived: { decrement: p.n } } });
              }
            }
          }
          if (info.referenceType === "GoodsReceipt") {
            const r = await tx.goodsReceipt.findUnique({ where: { id: ref }, select: { purchaseOrderId: true } });
            if (r) {
              const all = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: r.purchaseOrderId } });
              await tx.purchaseOrder.update({ where: { id: r.purchaseOrderId }, data: { status: all.every((i) => i.quantityReceived >= i.quantityOrdered) ? "RECEIVED" : all.some((i) => i.quantityReceived > 0) ? "PARTIALLY_RECEIVED" : "SENT" } });
            }
          }
          const list = [...per.values()].map((p) => `${p.n} × ${p.name}`).join(", ");
          const were = left.length === 1 ? "was" : "were";
          await this.raise(tx, { organizationId: org, branchId: info.branchId, kind: info.kind === "SHELF" ? "NOT_ON_SHELF" : "LABELS_LEFT_OVER", userId: user.sub, referenceType: info.referenceType, referenceId: ref, referenceNumber: info.kind === "SHELF" ? undefined : info.number, itemCodes: left.map((i) => i.code),
            title: info.kind === "SHELF" ? `Items not on the shelf at ${bName}` : `${info.number}: fewer items than were counted`,
            detail: info.kind === "SHELF"
              ? `Labels were printed for every item WHOLESTRA had on record at ${bName}, but ${list} had no item to go on. The stock was lowered to what was really labelled. Say where these items went.`
              : `At ${bName}, ${list} ${were} counted at goods in but never got a label stuck on and scanned. ${left.length === 1 ? "That label was" : "Those labels were"} cancelled and the stock was lowered to what was labelled. Either fewer arrived than were counted (one scanned twice), or items were taken before labelling.` });
          cancelled = left.length;
        }
      }
      const waiting = await tx.stockItem.count({ where: { organizationId: org, labelRef: ref, status: "PENDING" } });
      return { stuck: items.length, cancelled, waiting };
    }, { timeout: 60_000 });
  }

  /** The company switch "every item gets its own label", and how far the products are from it. */
  async trackAll(user: AuthUser) {
    const org = user.organizationId;
    const [o, total, tracked] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: org }, select: { trackAllItems: true } }),
      this.prisma.product.count({ where: { organizationId: org } }),
      this.prisma.product.count({ where: { organizationId: org, trackItems: true } }),
    ]);
    return { on: o?.trackAllItems ?? false, products: total, tracked };
  }

  /**
   * Switching it on gives every product "Track each item", so every single item needs its own label and no item can be scanned
   * twice to cover for one that was not. New products follow it. Switching it off only stops new products from being tracked:
   * products already tracked stay tracked (an owner can untick one on the product), so labels already printed keep working.
   */
  async setTrackAll(user: AuthUser, on: boolean) {
    const org = user.organizationId;
    const changed = await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: org }, data: { trackAllItems: on } });
      return on ? (await tx.product.updateMany({ where: { organizationId: org, trackItems: false }, data: { trackItems: true } })).count : 0;
    });
    return { ...await this.trackAll(user), changed };
  }

  /** How many of each tracked product at a branch still have no label (to offer a "print labels" button). */
  async unlabelled(user: AuthUser, branchId: string) {
    assertBranch(user, branchId);
    const org = user.organizationId;
    const inv = await this.prisma.inventory.findMany({ where: { organizationId: org, branchId, quantity: { gt: 0 }, product: { trackItems: true } }, select: { quantity: true, product: { select: { id: true, name: true, sku: true } } } });
    if (!inv.length) return [];
    const counts = await this.prisma.stockItem.groupBy({ by: ["productId"], where: { organizationId: org, branchId, status: { in: ["IN_STOCK", "PENDING"] } }, _count: { _all: true } });
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

  /** The newest trip of a transfer, in short (the map loads the route itself). */
  private async liveTrip(org: string, transferId: string) {
    const t = await this.prisma.trip.findFirst({ where: { organizationId: org, transferId }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, driverName: true, vehicle: true, lastAt: true, lastLat: true, lastLng: true } });
    return t ? { id: t.id, status: t.status, driverName: t.driverName, vehicle: t.vehicle, lastAt: t.lastAt, live: t.status !== "ENDED" && !!t.lastAt && t.lastAt.getTime() > Date.now() - 48 * 3600_000 } : null;
  }

  // ------------------------------------------------------------------ finding things

  /** Scan or type any code: an item label shows that item's story; a product barcode shows where that product is right now. */
  async find(user: AuthUser, raw: string) {
    const org = user.organizationId, code = cleanCodes([codeFromScan(raw)])[0];
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
        : item.status === "SOLD" ? "Sold"
        : item.status === "PENDING" ? `Label printed at ${bn.get(item.branchId!) ?? "a branch"}, not yet stuck on an item and scanned, so it is not stock yet`
        : item.status === "VOID" ? "Cancelled label: it was printed but never stuck on an item, so it never counted"
        : "Written off";
      return {
        kind: "item" as const, code: item.code, status: item.status, where, product: item.product, branch: item.branchId ? bn.get(item.branchId) ?? null : null,
        history: item.events.map((e) => ({ type: e.type, at: e.createdAt, branch: e.branchId ? bn.get(e.branchId) ?? null : null, by: e.userId ? un.get(e.userId) ?? null : null, note: e.note, referenceType: e.referenceType, referenceId: e.referenceId, lat: e.lat, lng: e.lng })),
        // on the road: the trip carrying it, so the map can show where the vehicle is now
        trip: item.status === "IN_TRANSIT" && item.transferId ? await this.liveTrip(org, item.transferId) : null,
      };
    }
    const product = await this.prisma.product.findFirst({ where: { organizationId: org, OR: [{ barcodes: { has: code } }, { sku: { equals: code, mode: "insensitive" } }] }, select: { id: true, name: true, sku: true, trackItems: true, ownCode: true } });
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
      inTransit: await Promise.all(moving.map(async (m) => ({ transferId: m.stockTransfer.id, transferNumber: m.stockTransfer.transferNumber, from: m.stockTransfer.fromBranch.name, to: m.stockTransfer.toBranch.name, quantity: m.sentQuantity ?? m.quantity, since: m.stockTransfer.dispatchedAt, trip: await this.liveTrip(org, m.stockTransfer.id) }))),
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
