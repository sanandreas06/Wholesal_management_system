/** Messages between the counter and the customer screen. Both run in the same browser (a POS with two displays, or a laptop
 *  with a second monitor), so they talk through a BroadcastChannel: instant, and nothing goes over the internet. */
export type Line = { id: string; name: string; price: number; qty: number; stock: number };
export type DisplayMsg =
  | { type: "hello" }
  | { type: "idle" }
  | { type: "cart"; lines: Line[]; total: number; customer: string | null; paying: string | null }
  | { type: "paid"; invoice: string; total: number; paid: number; change: number; method: string };

export const channelName = (branchId: string) => `wms-counter:${branchId}`;
