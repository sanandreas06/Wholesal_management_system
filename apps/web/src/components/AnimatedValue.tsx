'use client';
import { useEffect, useRef, useState } from "react";

/** Counts a number up to its value, keeping any prefix or suffix ("12,450.00", "38%"). Skips the animation for reduced-motion users. */
export default function AnimatedValue({ value }: { value: string }) {
  const m = value.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  const target = m ? Number(m[2].replace(/,/g, "")) : NaN;
  const decimals = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
  const [shown, setShown] = useState(target);
  const from = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(target); return; }
    const start = performance.now(), a = from.current, dur = 700;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3);
      setShown(a + (target - a) * e);
      if (t < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (!m || !Number.isFinite(target)) return <>{value}</>;
  return <>{m[1]}{shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{m[3]}</>;
}
