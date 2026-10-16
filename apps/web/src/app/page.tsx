import Link from "next/link";
import Logo from "../components/Logo";
import AuthLink from "../components/landing/AuthLink";
import PublicNav from "../components/landing/PublicNav";
import FloatField, { type FloatItem } from "../components/landing/FloatField";
import FeatureTabs from "../components/landing/FeatureTabs";
import { HeroMock } from "../components/landing/Mockups";
import "../components/landing/landing.css";

/** Public home page. Anyone visiting the site lands here; signing in is one click away. All pictures use sample data and say so. No customer names, quotes or prices are shown. */

function Ico({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

const VALUES = [
  { d: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8", t: "Know your stock everywhere", p: "See what is on the shelf in every branch, what is running low, and what to reorder, without phoning around." },
  { d: "M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9.2 9.6 12 10.5s5 1.9 5 4-2.2 3.5-5 3.5-5-1.1-5-3", t: "Keep every cedi accounted for", p: "Sales, purchases, expenses and payments in one place, with profit and margin visible only to the people you choose." },
  { d: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3zM9 12l2 2 4-4", t: "Trust the record", p: "Every change is written to a log that shows if anyone tampers with it. You can always see who did what, and when." },
];

const MODULES: [string, string][] = [
  ["Products", "Prices, units, brands and categories"],
  ["Inventory", "Stock per branch, with low-stock alerts"],
  ["Sales", "Invoices, payments and customer balances"],
  ["Purchasing", "Orders to suppliers and goods received"],
  ["Stock transfers", "Move stock between branches with a paper trail"],
  ["Stock counts", "Count, compare and correct with a reason"],
  ["Finance", "Expenses, approvals and reconciliation"],
  ["Excel import", "Bring in products and stock from spreadsheets"],
  ["Users and roles", "Decide who sees which branch and which screens"],
  ["Change log", "A sealed record of every important change"],
  ["Insights", "Trends, best sellers and reorder suggestions"],
  ["Notifications", "Be told when something needs a decision"],
];

const HERO_ITEMS: FloatItem[] = [
  { art: "boxes", x: "4%", y: "22%", w: 104, depth: 34, dur: 8 },
  { art: "scanner", x: "15%", y: "52%", w: 72, depth: 22, dur: 6.5, delay: 0.8 },
  { art: "truck", x: "84%", y: "20%", w: 120, depth: 30, dur: 9, delay: 0.4 },
  { art: "clipboard", x: "89%", y: "50%", w: 76, depth: 20, dur: 7, delay: 1.2, hideSm: true },
  { art: "tag", x: "26%", y: "8%", w: 56, depth: 40, dur: 6, delay: 0.3, hideSm: true },
  { art: "barcode", x: "72%", y: "6%", w: 72, depth: 38, dur: 7.5, delay: 1.6, hideSm: true },
  { art: "shelf", x: "2%", y: "56%", w: 84, depth: 26, dur: 9, delay: 0.6, hideSm: true },
  { chip: { text: "Cement 50kg · Out of stock", tone: "bad" }, x: "10%", y: "40%", depth: 50, dur: 6.8, hideSm: true },
  { chip: { text: "Transfer Tema → Accra · Sent", tone: "info" }, x: "72%", y: "31%", depth: 46, dur: 7.4, delay: 0.9, hideSm: true },
  { chip: { text: "Order #1042 delivered", tone: "ok" }, x: "73%", y: "47%", depth: 52, dur: 6.2, delay: 1.4, hideSm: true },
];
const FINAL_ITEMS: FloatItem[] = [
  { art: "box", x: "8%", y: "24%", w: 84, depth: 30, dur: 7 },
  { art: "bars", x: "80%", y: "18%", w: 84, depth: 28, dur: 8, delay: 0.5 },
  { art: "boxes", x: "86%", y: "58%", w: 76, depth: 24, dur: 6.5, delay: 1, hideSm: true },
  { art: "scanner", x: "3%", y: "62%", w: 60, depth: 24, dur: 7.6, delay: 0.7, hideSm: true },
];

export default function Home() {
  return (
    <div className="lp">
      <header className="lp-hero">
        <div className="lp-glow" aria-hidden="true" />
        <FloatField items={HERO_ITEMS} />
        <div className="lp-wrap">
          <PublicNav variant="dark" />
          <div className="lp-hero-in">
            <p className="lp-eyebrow">Wholesale management for every branch</p>
            <h1>Every branch. <span>One clear picture.</span></h1>
            <p className="lp-lead">WHOLESTRA brings stock, sales, purchasing and money from all your branches into one place, so owners see the truth and branch managers get on with the day.</p>
            <div className="lp-cta">
              <AuthLink className="lp-btn solid">Sign in</AuthLink>
              <a href="#features" className="lp-btn line">See what it does</a>
            </div>
            <ul className="lp-chips">
              <li>Cedis (GH₵)</li><li>Stock by branch</li><li>Tamper-evident change log</li><li>Works on phones</li>
            </ul>
          </div>
          <div className="lp-stage"><HeroMock /></div>
        </div>
      </header>

      <section className="lp-section first" id="why">
        <div className="lp-wrap">
          <div className="lp-head lp-reveal">
            <p className="lp-eyebrow">Why WHOLESTRA</p>
            <h2>Built for businesses that run more than one shop</h2>
            <p>Most tools are made for a single store. WHOLESTRA starts from the harder question: how do you stay in control when stock, cash and people are spread across branches?</p>
          </div>
          <div className="lp-cards">
            {VALUES.map((v) => (
              <article className="lp-feature lp-reveal" key={v.t}>
                <span className="ico"><Ico d={v.d} /></span>
                <h3>{v.t}</h3>
                <p>{v.p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section alt" id="features">
        <div className="lp-wrap">
          <div className="lp-head lp-reveal">
            <p className="lp-eyebrow">What it does</p>
            <h2>Pick a topic and see it in action</h2>
          </div>
          <FeatureTabs />
        </div>
      </section>

      <section className="lp-section" id="modules">
        <div className="lp-wrap">
          <div className="lp-head lp-reveal">
            <p className="lp-eyebrow">Everything in one system</p>
            <h2>The whole wholesale day, covered</h2>
          </div>
          <ul className="lp-grid">
            {MODULES.map(([t, d]) => <li key={t}><div><b>{t}</b><span>{d}</span></div></li>)}
          </ul>
        </div>
      </section>

      <section className="lp-section alt" id="how">
        <div className="lp-wrap">
          <div className="lp-head lp-reveal">
            <p className="lp-eyebrow">How it works</p>
            <h2>From sign-in to a clear picture in three steps</h2>
          </div>
          <div className="lp-cards lp-steps">
            {[
              ["Set up your branches and people", "Add your branches, then give each person a role and a branch. They choose their own password the first time they sign in."],
              ["Bring in your products and stock", "Import from Excel or add items by hand. Opening stock is recorded per branch."],
              ["Run the day, see the whole business", "Record sales, purchases and expenses as they happen. The dashboard and the change log keep up automatically."],
            ].map(([t, p]) => (
              <article className="lp-feature lp-step lp-reveal" key={t}>
                <span className="ico" />
                <h3>{t}</h3>
                <p>{p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="safe">
        <div className="lp-wrap">
          <div className="lp-head lp-reveal">
            <p className="lp-eyebrow">Safe by design</p>
            <h2>Made so that one mistake, or one bad actor, cannot sink the business</h2>
          </div>
          <div className="lp-trust">
            <div><h3>Branch-level access</h3><p>People see only the branch and screens their role allows.</p></div>
            <div><h3>Approval limits</h3><p>Expenses above a manager’s limit wait for the owner.</p></div>
            <div><h3>Sealed change log</h3><p>Every important change is chained, so tampering shows up.</p></div>
            <div><h3>Your own password</h3><p>New users must choose a private password before they start.</p></div>
          </div>
        </div>
      </section>

      <section className="lp-final">
        <FloatField items={FINAL_ITEMS} />
        <div className="lp-wrap">
          <h2>See all your branches in one place</h2>
          <p>Sign in to open your workspace.</p>
          <div className="lp-cta"><AuthLink className="lp-btn solid">Sign in</AuthLink></div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <Link href="/" className="lp-brand" aria-label="WHOLESTRA home"><Logo size={32} /></Link>
          <span>© 2026 WHOLESTRA. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
