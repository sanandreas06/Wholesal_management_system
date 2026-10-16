import Link from "next/link";
import Logo from "../components/Logo";
import AuthLink from "../components/landing/AuthLink";
import { HeroMock, StockMock, ApprovalMock, SealMock } from "../components/landing/Mockups";
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

export default function Home() {
  return (
    <div className="lp">
      <div className="lp-ribbon">Early access. Every figure on this page is sample data.</div>
      <div className="lp-kente" aria-hidden="true" />

      <header className="lp-hero">
        <div className="lp-wrap">
          <nav className="lp-nav" aria-label="Main">
            <Link href="/" className="lp-brand" aria-label="WHOLESTRA home"><Logo size={42} /></Link>
            <div className="lp-links">
              <a href="#features">Features</a>
              <a href="#control">Control</a>
              <a href="#how">How it works</a>
            </div>
            <div className="lp-nav-cta"><AuthLink className="lp-btn solid">Sign in</AuthLink></div>
          </nav>

          <div className="lp-hero-grid">
            <div>
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
            <HeroMock />
          </div>
        </div>
      </header>
      <div className="lp-kente" aria-hidden="true" />

      <section className="lp-section" id="features">
        <div className="lp-wrap">
          <div className="lp-head">
            <p className="lp-eyebrow">Why WHOLESTRA</p>
            <h2>Built for businesses that run more than one shop</h2>
            <p>Most tools are made for a single store. WHOLESTRA starts from the harder question: how do you stay in control when stock, cash and people are spread across branches?</p>
          </div>
          <div className="lp-cards">
            {VALUES.map((v) => (
              <article className="lp-feature" key={v.t}>
                <span className="ico"><Ico d={v.d} /></span>
                <h3>{v.t}</h3>
                <p>{v.p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section alt">
        <div className="lp-wrap">
          <div className="lp-band">
            <div className="lp-copy">
              <p className="lp-eyebrow" style={{ color: "#8A5F00" }}>Stock</p>
              <h2>Never be surprised by an empty shelf</h2>
              <p className="lp-sub">Every branch has its own stock count. WHOLESTRA flags what is out or running low and suggests what to reorder, so you buy before customers go elsewhere.</p>
              <ul>
                <li>Stock per branch, with clear Out, Low and OK labels</li>
                <li>Transfers between branches that both sides can see</li>
                <li>Stock counts and adjustments that always ask for a reason</li>
              </ul>
            </div>
            <StockMock />
          </div>

          <div className="lp-band flip" id="control">
            <div className="lp-copy">
              <p className="lp-eyebrow" style={{ color: "#8A5F00" }}>Control</p>
              <h2>Let managers act, within limits you set</h2>
              <p className="lp-sub">Give each role exactly the screens it needs. Set how much a branch manager may approve, and anything bigger goes to the owner.</p>
              <ul>
                <li>Branch managers see only their own branch</li>
                <li>Cost price and profit hidden from anyone you choose</li>
                <li>Nobody approves their own expense</li>
              </ul>
            </div>
            <ApprovalMock />
          </div>

          <div className="lp-band">
            <div className="lp-copy">
              <p className="lp-eyebrow" style={{ color: "#8A5F00" }}>Accountability</p>
              <h2>A record nobody can quietly rewrite</h2>
              <p className="lp-sub">Prices, stock changes, approvals and sign-ins are written to a sealed log. If any entry is altered or removed, WHOLESTRA tells you.</p>
              <ul>
                <li>Who did it, from which device, and when, in plain words</li>
                <li>A clear “the log is intact” check on the Audit page</li>
                <li>Built to answer the question: what happened, and who was it?</li>
              </ul>
            </div>
            <SealMock />
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
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
          <div className="lp-head">
            <p className="lp-eyebrow">How it works</p>
            <h2>From sign-in to a clear picture in three steps</h2>
          </div>
          <div className="lp-cards lp-steps">
            {[
              ["Set up your branches and people", "Add your branches, then give each person a role and a branch. They choose their own password the first time they sign in."],
              ["Bring in your products and stock", "Import from Excel or add items by hand. Opening stock is recorded per branch."],
              ["Run the day, see the whole business", "Record sales, purchases and expenses as they happen. The dashboard and the change log keep up automatically."],
            ].map(([t, p]) => (
              <article className="lp-feature lp-step" key={t}>
                <span className="ico" />
                <h3>{t}</h3>
                <p>{p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
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
        <div className="lp-wrap">
          <h2>See all your branches in one place</h2>
          <p>Sign in to open your workspace.</p>
          <div className="lp-cta"><AuthLink className="lp-btn solid">Sign in</AuthLink></div>
        </div>
      </section>
      <div className="lp-kente" aria-hidden="true" />

      <footer className="lp-foot">
        <div className="lp-wrap">
          <Link href="/" className="lp-brand" aria-label="WHOLESTRA home"><Logo size={32} /></Link>
          <span>© 2026 BOATENG. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
