'use client';
import { useEffect, useRef } from "react";
import { Box, Boxes, Scanner, Truck, Shelf, Clipboard, Barcode, Tag, Bars } from "./InventoryArt";

const ART = { box: Box, boxes: Boxes, scanner: Scanner, truck: Truck, shelf: Shelf, clipboard: Clipboard, barcode: Barcode, tag: Tag, bars: Bars };

export type FloatItem = {
  art?: keyof typeof ART;
  chip?: { text: string; tone?: "bad" | "ok" | "info" };
  x: string; y: string;
  /** size in px of the picture (ignored for chips) */
  w?: number;
  /** how far it drifts with the pointer, in px */
  depth?: number;
  /** seconds for one float cycle, and a start delay */
  dur?: number; delay?: number;
  /** hide on small screens */
  hideSm?: boolean;
};

/** Pictures and little status cards that float around the section they sit in and drift gently with the pointer. They are decorative, so they ignore clicks, are hidden from screen readers, and stand still when the visitor prefers less motion. */
export default function FloatField({ items }: { items: FloatItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, live = false;
    const move = (e: PointerEvent) => { const r = host.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; };
    const leave = () => { tx = 0; ty = 0; };
    const tick = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      host.style.setProperty("--mx", cx.toFixed(3)); host.style.setProperty("--my", cy.toFixed(3));
      raf = live ? requestAnimationFrame(tick) : 0;
    };
    const io = new IntersectionObserver(([en]) => { live = en.isIntersecting; if (live && !raf) raf = requestAnimationFrame(tick); });
    io.observe(host); host.addEventListener("pointermove", move); host.addEventListener("pointerleave", leave);
    return () => { io.disconnect(); host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="lp-field" ref={ref} aria-hidden="true">
      {items.map((it, i) => {
        const Art = it.art ? ART[it.art] : null;
        return (
          <div key={i} className={"lp-fl" + (it.hideSm ? " hide-sm" : "")} style={{ left: it.x, top: it.y, ["--d" as string]: `${it.depth ?? 20}px`, ["--w" as string]: `${it.w ?? 84}px` }}>
            <div className="lp-fl-in" style={{ animationDuration: `${it.dur ?? 7}s`, animationDelay: `${it.delay ?? 0}s` }}>
              {Art && <Art className="lp-art" />}
              {it.chip && <span className={`lp-fchip ${it.chip.tone ?? "info"}`}><i />{it.chip.text}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
