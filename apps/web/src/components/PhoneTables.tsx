"use client";

import { useEffect } from "react";

/**
 * On phones a wide table is hard to read, so each row is shown as a small card (see app-extra.css).
 * This copies every column heading onto its cells so each value can show its own label.
 * Tables that need to stay a grid can opt out with data-grid on the table.
 */
export default function PhoneTables() {
  useEffect(() => {
    const prep = (t: HTMLTableElement) => {
      if (t.hasAttribute("data-grid") || !t.tHead) return;
      const heads = Array.from(t.tHead.rows[0]?.cells ?? []).map(h => (h.textContent ?? "").trim());
      if (heads.length < 5) return;
      t.classList.add("stk");
      Array.from(t.tBodies).forEach(b => Array.from(b.rows).forEach(r => {
        Array.from(r.cells).forEach((c, i) => {
          if (c.colSpan > 1) { c.classList.add("stk-wide"); return; }
          const label = heads[i] ?? "";
          if (label) c.setAttribute("data-label", label); else c.removeAttribute("data-label");
          c.classList.toggle("stk-first", i === 0);
          const txt = (c.textContent ?? "").trim();
          const hasControl = !!c.querySelector("button,a,input,select");
          c.classList.toggle("stk-empty", !txt && !hasControl && i !== 0);
          c.classList.toggle("stk-dash", (txt === "—" || txt === "-") && !hasControl && i !== 0);
          c.classList.toggle("stk-act", !label && hasControl);
        });
      }));
    };
    const run = () => document.querySelectorAll<HTMLTableElement>(".table-wrap table").forEach(prep);
    run();
    let raf = 0;
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
