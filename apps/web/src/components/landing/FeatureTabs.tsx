'use client';
import { useState, type KeyboardEvent } from "react";
import { HeroMock, StockMock, ApprovalMock, SealMock } from "./Mockups";

const TABS = [
  { id: "dash", label: "Dashboard", sub: "Sales, profit and what needs attention", h: "Open it and know how the day is going", p: "Sales, gross profit and the items that need attention, for one branch or all of them. Click through from any figure to the records behind it.", Mock: HeroMock },
  { id: "stock", label: "Stock", sub: "Every branch, with clear Out, Low and OK", h: "Never be surprised by an empty shelf", p: "Each branch has its own count. WHOLESTRA flags what is out or running low and suggests what to reorder.", Mock: StockMock },
  { id: "control", label: "Approvals", sub: "Limits that match each person’s role", h: "Let managers act, within limits you set", p: "Set how much a branch manager may approve. Anything bigger goes to the owner, and nobody approves their own expense.", Mock: ApprovalMock },
  { id: "log", label: "Change log", sub: "Sealed, with who, when and from where", h: "A record nobody can quietly rewrite", p: "Prices, stock changes, approvals and sign-ins go into a sealed log. If an entry is altered or removed, WHOLESTRA says so.", Mock: SealMock },
] as const;

/** A tour of the product. The list on the left switches the picture on the right; works with a mouse, touch or the arrow keys. */
export default function FeatureTabs() {
  const [i, setI] = useState(0);
  const t = TABS[i];
  const go = (n: number) => { setI(n); requestAnimationFrame(() => document.getElementById(`lp-tab-${TABS[n].id}`)?.focus()); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); go((i + 1) % TABS.length); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); go((i + TABS.length - 1) % TABS.length); }
  };
  return (
    <div className="ft">
      <div className="ft-list" role="tablist" aria-label="Tour of WHOLESTRA" aria-orientation="vertical" onKeyDown={onKey}>
        {TABS.map((x, n) => (
          <button key={x.id} id={`lp-tab-${x.id}`} role="tab" aria-selected={n === i} aria-controls="lp-tabpanel" tabIndex={n === i ? 0 : -1} className={n === i ? "on" : ""} onClick={() => setI(n)}>
            <b>{x.label}</b><span>{x.sub}</span>
          </button>
        ))}
      </div>
      <div className="ft-panel lp-swap" id="lp-tabpanel" role="tabpanel" aria-labelledby={`lp-tab-${t.id}`} key={t.id}>
        <h3>{t.h}</h3>
        <p>{t.p}</p>
        <t.Mock />
      </div>
    </div>
  );
}
