"use client";
/** Where this phone or computer is, if the person allows it. Never blocks the work: after a few seconds it gives up quietly. */
export function here(timeoutMs = 6000): Promise<{ lat: number; lng: number; accuracy: number } | undefined> {
  return new Promise(resolve => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve(undefined); return; }
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(undefined); } }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      p => { if (done) return; done = true; clearTimeout(t); resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      () => { if (done) return; done = true; clearTimeout(t); resolve(undefined); },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: timeoutMs },
    );
  });
}

/** "just now", "4 min ago", "2 h ago" */
export function ago(iso: string | null | undefined) {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 45 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`;
}

/** 0244 123 456 -> 233244123456 (for WhatsApp links); null when it does not look like a phone number. */
export function waNumber(p: string | null | undefined) {
  if (!p) return null;
  let d = p.replace(/\D/g, "");
  if (d.startsWith("0")) d = "233" + d.slice(1);
  return d.length >= 11 ? d : null;
}

import { useEffect, useRef } from "react";
/** Asks for this device's location once when a scan screen opens (and every 2 minutes), so confirming never waits for GPS. */
export function useHere() {
  const at = useRef<{ lat: number; lng: number; accuracy: number } | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const get = () => { void here(10_000).then(p => { if (live && p) at.current = p; }); };
    get(); const t = setInterval(get, 120_000);
    return () => { live = false; clearInterval(t); };
  }, []);
  return at;
}
