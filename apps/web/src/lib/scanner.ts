import { useEffect, useRef } from "react";

/** USB and Bluetooth barcode scanners act like a keyboard: they "type" the code very fast and press Enter.
 *  This listens for that burst anywhere on the page (except while someone is typing in a text field, which handles Enter itself)
 *  and hands over the code. Typing by hand is far slower, so it is never mistaken for a scan. */
export function useScanner(onScan: (code: string) => void, enabled = true) {
  const cb = useRef(onScan);
  cb.current = onScan;
  useEffect(() => {
    if (!enabled) return;
    let buf = "", last = 0, gaps: number[] = [];
    const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) && !(el as HTMLElement).dataset.scanPassthrough;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || typing(e.target)) return;
      const now = performance.now();
      if (now - last > 120) { buf = ""; gaps = []; } // a pause: start over
      else gaps.push(now - last);
      last = now;
      if (e.key === "Enter") {
        const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 999;
        if (buf.length >= 4 && avg < 50) { e.preventDefault(); cb.current(buf); }
        buf = ""; gaps = [];
        return;
      }
      if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}

/** A short beep and a buzz on a good scan, so the cashier knows without looking. */
export function scanFeedback(ok = true) {
  try { navigator.vibrate?.(ok ? 60 : [40, 60, 40]); } catch { /* not on this device */ }
  try {
    const W = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext || W.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(), o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = ok ? 1650 : 320; o.type = "square"; g.gain.value = 0.04;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (ok ? 0.08 : 0.22));
    setTimeout(() => ctx.close().catch(() => undefined), 400);
  } catch { /* sound is a nice-to-have */ }
}
