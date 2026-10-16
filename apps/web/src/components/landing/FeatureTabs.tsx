'use client';
import { useState, type KeyboardEvent } from "react";
import { StockMock, ApprovalMock, SealMock } from "./Mockups";

const TABS = [
  { id: "stock", label: "Stock", h: "Never be surprised by an empty shelf", p: "Every branch has its own stock count. WHOLESTRA flags what is out or running low and suggests what to reorder, so you buy before customers go elsewhere.", pts: ["Stock per branch, with clear Out, Low and OK labels", "Transfers between branches that both sides can see", "Stock counts and adjustments that always ask for a reason"], Mock: StockMock },
  { id: "control", label: "Control", h: "Let managers act, within limits you set", p: "Give each role exactly the screens it needs. Set how much a branch manager may approve, and anything bigger goes to the owner.", pts: ["Branch managers see only their own branch", "Cost price and profit hidden from anyone you choose", "Nobody approves their own expense"], Mock: ApprovalMock },
  { id: "log", label: "Accountability", h: "A record nobody can quietly rewrite", p: "Prices, stock changes, approvals and sign-ins are written to a sealed log. If any entry is altered or removed, WHOLESTRA tells you.", pts: ["Who did it, from which device, and when, in plain words", "A clear “the log is intact” check on the Audit page", "Built to answer one question: what happened, and who was it?"], Mock: SealMock },
] as const;

/** Three feature views behind tabs. Works with a mouse, touch or the arrow keys. */
export default function FeatureTabs() {
  const [i, setI] = useState(0);
  const t = TABS[i];
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setI((i + 1) % TABS.length);
    else if (e.key === "ArrowLeft") setI((i + TABS.length - 1) % TABS.length);
    else return;
    e.preventDefault();
    requestAnimationFrame(() => (document.getElementById(`lp-tab-${TABS[(e.key === "ArrowRight" ? i + 1 : i + TABS.length - 1) % TABS.length].id}`) as HTMLElement | null)?.focus());
  };
  return (
    <div>
      <div className="lp-tabs" role="tablist" aria-label="What WHOLESTRA does" onKeyDown={onKey}>
        {TABS.map((x, n) => (
          <button key={x.id} id={`lp-tab-${x.id}`} role="tab" aria-selected={n === i} aria-controls="lp-tabpanel" tabIndex={n === i ? 0 : -1} className={n === i ? "on" : ""} onClick={() => setI(n)}>{x.label}</button>
        ))}
      </div>
      <div className="lp-band lp-swap" id="lp-tabpanel" role="tabpanel" aria-labelledby={`lp-tab-${t.id}`} key={t.id}>
        <div className="lp-copy">
          <h2>{t.h}</h2>
          <p className="lp-sub">{t.p}</p>
          <ul>{t.pts.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <t.Mock />
      </div>
    </div>
  );
}
