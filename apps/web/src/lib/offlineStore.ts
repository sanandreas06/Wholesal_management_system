/**
 * A small store on this device (IndexedDB) for the counter to keep working without internet:
 * the branch's products and prices, the customers, and sales made while offline that still have to be sent.
 * Everything here is per browser. Clearing the browser's data deletes it, so the counter warns while sales are waiting.
 */
const DB = "wholestra-offline", VERSION = 1, KV = "kv", QUEUE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no IndexedDB")); return; }
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "clientRef" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode), r = fn(tx.objectStore(store));
    tx.oncomplete = () => { resolve(r.result); db.close(); };
    tx.onerror = () => { reject(tx.error); db.close(); };
    tx.onabort = () => { reject(tx.error); db.close(); };
  });
}

/** Saved copies of things loaded from the server (products, branches, customers...). Failing quietly: it is a backup. */
export const offlineCache = {
  async get<T>(key: string): Promise<T | undefined> { try { return (await run<T | undefined>(KV, "readonly", s => s.get(key) as IDBRequest<T | undefined>)) ?? undefined; } catch { return undefined; } },
  async set(key: string, value: unknown) { try { await run(KV, "readwrite", s => s.put(value, key)); } catch { /* no room or private mode: the counter still works online */ } },
};

/** A sale made while the internet was down, waiting to be sent. */
export interface QueuedSale {
  clientRef: string;
  /** who made it: only that person can send it (the sale is recorded in their name) */
  userId: string;
  userName: string;
  orgId?: string;
  branchId: string;
  createdAt: string;
  /** what the receipt showed */
  offlineNumber: string;
  total: number;
  /** the request to send, exactly as it will go to the server */
  body: Record<string, unknown>;
  /** set when the server refused it, so a person can look at it */
  error?: string;
  tries?: number;
}

export const saleQueue = {
  async all(): Promise<QueuedSale[]> { try { return await run<QueuedSale[]>(QUEUE, "readonly", s => s.getAll() as IDBRequest<QueuedSale[]>); } catch { return []; } },
  async put(sale: QueuedSale) { await run(QUEUE, "readwrite", s => s.put(sale)); },
  async remove(clientRef: string) { await run(QUEUE, "readwrite", s => s.delete(clientRef)); },
};

/** A random id for a sale (the server uses it to never save the same sale twice). */
export function newClientRef(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (c.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16); c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The code for the receipt's confirmation QR, made on the device so an offline receipt can carry it too. */
export function newConfirmToken(): string {
  const A = "23456789ABCDEFGHJKMNPQRSTUVWXYZ", b = new Uint8Array(16); crypto.getRandomValues(b);
  return [...b].map(x => A[x % A.length]).join("");
}

/** True when an error means "could not reach the server" rather than "the server said no". */
export const isNetworkError = (e: unknown) => e instanceof TypeError || (typeof e === "object" && !!e && (e as { status?: number }).status === 0);
