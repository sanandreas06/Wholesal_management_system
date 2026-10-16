/** Turns the technical facts stored with a Change-log entry into words a shop owner would use. */

export interface Line { label: string; value: string; note?: string }

/** Where a network address is, in plain words. The address itself goes in `note`, small and grey, for anyone who needs it. */
export function whereFrom(raw: unknown): { value: string; note?: string } {
  if (typeof raw !== "string" || !raw.trim()) return { value: "Not recorded" };
  const ip = raw.trim().replace(/^::ffff:/i, "");
  if (ip === "::1" || /^127\./.test(ip)) return { value: "The computer that runs the system", note: "Someone using the system directly on that machine" };
  const v4 = ip.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  const inside = v4 ? (+v4[1] === 10 || (+v4[1] === 192 && +v4[2] === 168) || (+v4[1] === 172 && +v4[2] >= 16 && +v4[2] <= 31)) : /^(fe80|fc|fd)/i.test(ip);
  return inside
    ? { value: "Inside your own network", note: `A computer or phone on your shop or office Wi-Fi (address ${ip})` }
    : { value: "Outside your network", note: `Over the internet (address ${ip})` };
}

const NICE: Record<string, string> = { device: "Device", ip: "Connected from" };
const words = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
function plain(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map(plain).join(", ");
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${words(k)}: ${plain(x)}`).join(" · ");
  return String(v);
}

/** The "Details" lines for an entry that has no before/after fields: who/where for sign-ins, plain label/value pairs for anything else. */
export function describeRequest(request: Record<string, unknown>): Line[] {
  return Object.entries(request).map(([k, v]) => {
    if (k === "ip") { const w = whereFrom(v); return { label: NICE.ip, ...w }; }
    return { label: NICE[k] ?? words(k), value: plain(v) };
  });
}

/** One line of advice for sign-in entries that someone may want to look at twice. */
export function signInAdvice(action: string): string | null {
  if (action === "FAILED SIGN-IN") return "Someone tried to sign in and was turned away. If you do not recognise the device or place, change that person's password in Users.";
  if (action === "SIGN IN") return "If you do not recognise this device or place, change that person's password in Users.";
  return null;
}
