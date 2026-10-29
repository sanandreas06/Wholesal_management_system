/** Messages between the counter and the customer screen. Both run in the same browser (a POS with two displays, or a laptop
 *  with a second monitor), so they talk through a BroadcastChannel: instant, and nothing goes over the internet. */
export type Line = {
  id: string; name: string; price: number; qty: number; stock: number;
  /** item labels scanned, for products with a label on each item */
  codes?: string[];
  /** how many of this line were scanned (tapping adds without scanning); goods leave only once scanned, or with a reason */
  scanned?: number;
  /** the product has a barcode or item labels, so it can (and should) be scanned */
  scannable?: boolean;
};
export type DisplayMsg =
  | { type: "hello" }
  | { type: "idle" }
  | { type: "cart"; lines: Line[]; total: number; customer: string | null; paying: string | null }
  | { type: "paid"; invoice: string; total: number; paid: number; change: number; method: string; /** the customer scans this to confirm what they received */ confirmUrl?: string; items?: number };

export const channelName = (branchId: string) => `wms-counter:${branchId}`;
