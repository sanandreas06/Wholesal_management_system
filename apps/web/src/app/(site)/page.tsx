import Link from "next/link";
import FloatField, { type FloatItem } from "../../components/landing/FloatField";
import ScanBoard from "../../components/landing/ScanBoard";
import BeforeAfter from "../../components/landing/BeforeAfter";
import FeatureTabs from "../../components/landing/FeatureTabs";
import SealChain from "../../components/landing/SealChain";

const HERO_ITEMS: FloatItem[] = [
  { art: "truck", x: "29%", y: "11%", w: 104, depth: 34, dur: 9 },
  { art: "scanner", x: "9%", y: "90%", w: 60, depth: 24, dur: 6.8, delay: 0.6 },
  { art: "boxes", x: "40%", y: "82%", w: 84, depth: 40, dur: 8, delay: 1.1 },
  { art: "clipboard", x: "94.5%", y: "88%", w: 62, depth: 28, dur: 7.4, delay: 0.3 },
];

const MODULES: [string, string, string][] = [
  ["Products", "Prices, units, brands and categories", "products"],
  ["Inventory", "Stock per branch, with low-stock alerts", "inventory"],
  ["Sales", "Invoices, payments and customer balances", "sales"],
  ["Purchasing", "Orders to suppliers and goods received", "purchasing"],
  ["Stock transfers", "Move stock between branches with a record", "inventory"],
  ["Stock counts", "Count, compare and correct, with a reason", "inventory"],
  ["Finance", "Expenses, approvals and reconciliation", "finance"],
  ["Excel import", "Bring in sales from spreadsheets", "import"],
  ["Users and roles", "Decide who sees which branch and screen", "people"],
  ["Change log", "A sealed record of every important change", "log"],
  ["Insights", "Trends, best sellers and reorder suggestions", "insights"],
  ["Notifications", "Be told when something needs a decision", "insights"],
];

export default function Home() {
  return (
    <>
      <section className="lp-hero">
        <div className="lp-glow" aria-hidden="true" />
        <FloatField items={HERO_ITEMS} />
        <div className="lp-hero-grid">
          <div className="lp-hero-copy">
            <h1>Every branch’s stock, on one screen.</h1>
            <p className="lp-lead">WHOLESTRA tracks stock, sales, purchasing and expenses across all your branches. Owners see everything. Branch managers see their own.</p>
            <div className="lp-cta">
              <Link href="/get-started" className="lp-btn kraft">Get started</Link>
              <a href="#tour" className="lp-btn line">See how it works</a>
            </div>
            <p className="lp-fine">Amounts are in cedis (GH₵). Works on phones, tablets and computers.</p>
          </div>
          <ScanBoard />
        </div>
      </section>

      <section className="lp-sec light" id="why">
        <div className="lp-wrap">
          <h2 className="lp-h2">Running several branches on phone calls and notebooks?</h2>
          <p className="lp-sub">See what changes.</p>
          <BeforeAfter />
        </div>
      </section>

      <section className="lp-sec dark" id="tour">
        <div className="lp-wrap">
          <h2 className="lp-h2">A quick tour</h2>
          <p className="lp-sub">Pick a topic to see the screen.</p>
          <FeatureTabs />
        </div>
      </section>

      <section className="lp-sec light" id="modules">
        <div className="lp-wrap">
          <h2 className="lp-h2">Everything a wholesale day needs</h2>
          <ul className="lp-index">
            {MODULES.map(([t, d, h]) => <li key={t}><Link href={`/features#${h}`}><b>{t}</b><span>{d}</span></Link></li>)}
          </ul>
          <p className="lp-more"><Link href="/features">See all features</Link></p>
        </div>
      </section>

      <section className="lp-sec ink" id="security">
        <div className="lp-wrap lp-split">
          <div>
            <h2 className="lp-h2">Try to change the record</h2>
            <p className="lp-sub">Every important change goes into a sealed log. Edit an entry and watch what happens to the ones after it.</p>
            <p className="lp-more"><Link href="/security">How WHOLESTRA keeps data safe</Link></p>
          </div>
          <SealChain />
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-wrap">
          <h2 className="lp-h2">See it with your own products</h2>
          <p className="lp-sub">Tell us about your business and we will arrange a walkthrough.</p>
          <div className="lp-cta center">
            <Link href="/get-started" className="lp-btn kraft">Get started</Link>
            <Link href="/login" className="lp-btn line">Sign in</Link>
          </div>
        </div>
      </section>
    </>
  );
}
