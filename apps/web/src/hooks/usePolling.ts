'use client';
import { useEffect, useRef } from "react";

/**
 * Calls `callback` immediately, then repeatedly every `intervalMs`.
 * Pauses automatically when the browser tab isn't visible, so it
 * doesn't keep polling in the background wasting requests.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled: boolean = true) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const tick = () => { if (document.visibilityState === "visible") savedCallback.current(); };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
