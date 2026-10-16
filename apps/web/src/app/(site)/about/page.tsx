import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About | WHOLESTRA", description: "Why WHOLESTRA exists and what it is built around." };

export default function About() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>Why WHOLESTRA exists</h1><p className="lp-lead">Wholesale trade with more than one branch breaks in the gaps: between branches, between what was approved and what was spent, and between what happened and what anyone remembers.</p></div></section>
      <section className="lp-sec light">
        <div className="lp-wrap lp-prose">
          <h2 className="lp-h2">What it is built around</h2>
          <div className="lp-trio">
            <div><h3>One picture</h3><p>Stock, sales, purchases and expenses from every branch in one place, in cedis, without phoning around.</p></div>
            <div><h3>The right access</h3><p>Owners see everything. Each manager sees their own branch, and only what their role allows.</p></div>
            <div><h3>Evidence</h3><p>Important changes are recorded and sealed, so the question “who did this?” has an answer.</p></div>
          </div>
        </div>
      </section>
      <section className="lp-sec tint">
        <div className="lp-wrap lp-prose">
          <h2 className="lp-h2">Where it stands</h2>
          <p className="lp-sub">WHOLESTRA is in early access. The core is built: products, inventory, sales, purchasing, expenses and approvals, Excel import, roles, insights and the sealed change log. A public demo with sample data is online so you can look around. It is being tested before it holds real shop records.</p>
          <p className="lp-sub">Next comes hosting with regular backups, a trial with a real branch, and more reports.</p>
        </div>
      </section>
      <section className="lp-final"><div className="lp-wrap"><h2 className="lp-h2">Want to be one of the first?</h2><div className="lp-cta center"><Link href="/get-started" className="lp-btn kraft">Get started</Link><Link href="/features" className="lp-btn line">See features</Link></div></div></section>
    </>
  );
}
