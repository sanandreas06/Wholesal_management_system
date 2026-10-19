/** Signing out after a quiet spell. Activity in any open tab counts, because the time is kept in localStorage, which all tabs share.
 *  The limit is NEXT_PUBLIC_IDLE_MINUTES (30 if not set). A one-minute warning comes first. */
export const IDLE_MINUTES = Math.max(2, Number(process.env.NEXT_PUBLIC_IDLE_MINUTES) || 30);
export const IDLE_MS = IDLE_MINUTES * 60_000;
export const WARN_MS = 60_000;
const KEY = "wms_last_active";

let lastWrite = 0;
/** Notes activity now (written at most every 10 seconds). */
export function markActive(force = false) {
  const now = Date.now();
  if (!force && now - lastWrite < 10_000) return;
  lastWrite = now;
  try { localStorage.setItem(KEY, String(now)); } catch { /* storage unavailable */ }
}

/** Milliseconds since anyone used the app in this browser; 0 if unknown. */
export function idleFor() {
  try { const t = Number(localStorage.getItem(KEY)); return t ? Math.max(0, Date.now() - t) : 0; } catch { return 0; }
}
