'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/** One stop of the tour: the first of `sel` that is visible on screen is highlighted. */
export type Step = { sel: string[]; title: string; body: string };

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.right <= 0 || r.left >= window.innerWidth) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
}
function find(sel: string[]): HTMLElement | null {
  for (const s of sel) for (const el of Array.from(document.querySelectorAll(s))) if (visible(el)) return el as HTMLElement;
  return null;
}

/** A guided tour: dims the page, lights up one part at a time and explains it. Esc or Skip ends it; arrow keys move. */
export default function Tour({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  // only the stops that exist on this screen, each part shown once
  const stops = useMemo(() => {
    const seen = new Set<HTMLElement>(); const out: { step: Step; el: HTMLElement }[] = [];
    for (const step of steps) { const el = find(step.sel); if (el && !seen.has(el)) { seen.add(el); out.push({ step, el }); } }
    return out;
  }, [steps]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState({ w: 0, h: 0 });
  const cur = stops[i];

  const measure = useCallback(() => {
    if (!cur) return;
    setRect(cur.el.getBoundingClientRect());
    setVw({ w: window.innerWidth, h: window.innerHeight });
  }, [cur]);

  useLayoutEffect(() => {
    if (!cur) return;
    const r = cur.el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight - 40) cur.el.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    const t1 = setTimeout(measure, 320), t2 = setTimeout(measure, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cur, measure]);

  useEffect(() => {
    const on = () => measure();
    window.addEventListener("resize", on); window.addEventListener("scroll", on, true);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, stops.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("scroll", on, true); window.removeEventListener("keydown", key); };
  }, [measure, onClose, stops.length]);

  useEffect(() => { if (!stops.length) onClose(); }, [stops.length, onClose]);
  if (!cur || !rect) return null;

  const pad = 6;
  const hole = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const cardW = Math.min(340, vw.w - 32);
  const below = hole.top + hole.height + 14 + 190 < vw.h || hole.top < 210;
  const left = Math.max(16, Math.min(hole.left + hole.width / 2 - cardW / 2, vw.w - cardW - 16));
  const top = below ? Math.min(hole.top + hole.height + 14, vw.h - 200) : undefined;
  const bottom = below ? undefined : Math.max(16, vw.h - hole.top + 14);
  const last = i === stops.length - 1;

  return createPortal(
    <div className="tr" role="dialog" aria-modal="true" aria-labelledby="tr-title">
      <div className="tr-catch" onClick={onClose} />
      <div className="tr-hole" style={hole} />
      <div className="tr-card" style={{ width: cardW, left, top, bottom }}>
        <div className="tr-count">{i + 1} of {stops.length}</div>
        <h3 id="tr-title">{cur.step.title}</h3>
        <p>{cur.step.body}</p>
        <div className="tr-row">
          <button type="button" className="tr-skip" onClick={onClose}>{last ? "Close" : "Skip tour"}</button>
          <span>
            {i > 0 && <button type="button" className="tr-back" onClick={() => setI(i - 1)}>Back</button>}
            <button type="button" className="tr-next" autoFocus onClick={() => (last ? onClose() : setI(i + 1))}>{last ? "Finish" : "Next"}</button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const SITE_TOUR: Step[] = [
  { sel: [".lp-brand"], title: "Welcome to WHOLESTRA", body: "Stock, sales, purchasing and money for wholesalers with one or more branches, in one place. Here's a quick look around." },
  { sel: [".lp-links a[href='/features']"], title: "Features", body: "Everything WHOLESTRA does: stock in every branch, sales and invoices, purchase orders, expenses, Excel import and profit insights." },
  { sel: [".lp-links a[href='/security']"], title: "Security", body: "How your records are kept safe: codes at every sign-in, branch-level access and a sealed change log nobody can quietly rewrite." },
  { sel: [".lp-links a[href='/refer']"], title: "Refer & earn", body: "Introduce another business to WHOLESTRA and earn up to US$30 when it joins." },
  { sel: [".lp-links a[href='/contact']"], title: "Contact", body: "Send us a message, call, or chat on WhatsApp. We reply within one working day." },
  { sel: [".lp-burger"], title: "The menu", body: "On a phone, the pages (Features, Security, Refer & earn, About, Contact), Install app, Sign in and Get started are all in this menu." },
  { sel: [".lp-acct .lp-install"], title: "Install the app", body: "Put WHOLESTRA on your phone or computer like an app, with its own icon. No app store needed." },
  { sel: [".lp-acct a[href='/login']"], title: "Sign in", body: "Already have an account? Type your email, the code we send you, then your password." },
  { sel: [".lp-acct a[href='/get-started']", ".lp-acct a[href='/dashboard']"], title: "Get started", body: "Create your company's account in a few minutes with your email, Google, Facebook or LinkedIn." },
  { sel: ["[data-tour='demo']"], title: "Try the demo", body: "Look inside a sample company with three branches, no sign-up needed. It is read-only." },
  { sel: [".ast-fab"], title: "Ask me anything", body: "I'm here on every page. Ask about features, pricing or getting started, and I'll point you to the right place." },
];

export const APP_TOUR: Step[] = [
  { sel: [".sidebar-nav-scroll", ".menu-btn"], title: "Your menu", body: "Everything lives here: Inventory, Sales, Purchases, Finance and more. Each person only sees what their role allows." },
  { sel: ["[data-tour='nav-Inventory']"], title: "Inventory", body: "Products, stock levels per branch, adjustments, transfers between branches and stock counts." },
  { sel: ["[data-tour='nav-Sales']"], title: "Sales", body: "Record sales, print invoices, take payments and returns, and see what customers owe." },
  { sel: ["[data-tour='nav-Purchases']"], title: "Purchases", body: "Orders to suppliers, goods received, and reorder suggestions that tell you what to buy." },
  { sel: ["[data-tour='nav-/finance']"], title: "Finance", body: "Expenses (with approval limits), deposits, reconciliation and branch closings." },
  { sel: [".home-tabs"], title: "Home tabs", body: "Dashboard for the numbers, Products & tracking for what's selling and moving, and Getting started for your checklist." },
  { sel: [".search-bar"], title: "Search anything", body: "Find products, invoices, customers and suppliers, or jump to any page. Shortcut: Ctrl+K." },
  { sel: [".quick-btn"], title: "Create quickly", body: "The + button creates a sale, product, purchase order, expense and more from any screen." },
  { sel: [".topbar .bell"], title: "Needs your attention", body: "Low stock, expenses waiting for approval and shortages show up here." },
  { sel: [".user-chip"], title: "Your account", body: "Your profile, sign-in & security (authenticator app), install the app, and sign out." },
  { sel: [".topbar .gear"], title: "Settings", body: "Company profile, currency, branding for invoices, users and roles." },
  { sel: [".ast-fab"], title: "Ask me, or tell me what to do", body: "Type things like \"sales today\", \"what's running low?\" or \"sell 10 cement to Kofi, paid cash\". I'll always ask you to confirm before saving anything." },
];
