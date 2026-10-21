import { API_URL } from "./authApi";

/** Sends a website error to the Platform monitor. Quiet and cheap: the same error is sent once a minute at most,
 *  no more than 15 per page visit, and nothing typed into forms is ever included. */
const seen = new Map<string, number>();
let sent = 0;
const RELEASE = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || undefined;

// noise from browsers and extensions, not from WHOLESTRA
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /Non-Error promise rejection captured/i, /Load failed$/i, /Failed to fetch$/i, /NetworkError when attempting/i, /AbortError/i, /chrome-extension:|moz-extension:|safari-extension:/i];

export function reportError(err: unknown, where?: string) {
  if (typeof window === "undefined") return;
  try {
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err)?.slice(0, 300) ?? "Unknown error");
    const message = (e.message || String(e)).slice(0, 2000);
    const stack = (e.stack ?? "").slice(0, 8000);
    if (IGNORE.some(r => r.test(message) || r.test(stack))) return;
    const key = message + "|" + stack.split("\n")[1];
    const last = seen.get(key);
    if ((last && Date.now() - last < 60_000) || sent >= 15) return;
    seen.set(key, Date.now()); sent++;
    const path = where ?? window.location.pathname;
    fetch(`${API_URL}/monitor/client-error`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, stack, path, release: RELEASE }) }).catch(() => undefined);
  } catch { /* reporting must never cause another error */ }
}
