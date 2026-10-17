import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Refer & earn | WHOLESTRA", description: "Introduce a business to WHOLESTRA and earn up to US$30 when it joins." };

const FAQ: [string, string][] = [
  ["Who can refer?", "Any company with a WHOLESTRA account. Your personal link and code are under Refer & earn inside the app."],
  ["Who counts as a referral?", "A business that is new to WHOLESTRA and signs up with your link or code. It must be a real, separate business: your own second account or a branch of your own company does not count."],
  ["How much do I earn?", "Up to US$30 for each company, decided when our team confirms the company. You can see each referral and its status inside the app."],
  ["When is it confirmed?", "After the company has signed up and set up its account. Our team checks it is a genuine new business, then marks it confirmed."],
  ["How am I paid?", "We contact you to arrange payment, usually by mobile money or bank transfer, in your local currency at the day's rate."],
  ["Is there a limit?", "No fixed limit on the number of companies you refer. We may change or end the programme; rewards already confirmed are still paid."],
];

export default function Refer() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>Refer a business, earn up to US$30</h1><p className="lp-lead">You know other wholesalers, distributors and shop owners. When one of them joins WHOLESTRA with your link, we say thank you.</p>
        <div className="lp-cta"><Link href="/get-started" className="lp-btn kraft">Create an account to get your link</Link><Link href="/login?next=/referrals" className="lp-btn line">I have an account</Link></div></div></section>
      <section className="lp-sec light">
        <div className="lp-wrap lp-refer">
          <div>
            <h2 className="lp-h2">How it works</h2>
            <p className="lp-sub">Three steps. You can follow every referral inside the app.</p>
            <div className="lp-refer-amt"><b>US$30</b><span>up to, per company</span></div>
          </div>
          <ol className="lp-refer-steps">
            <li><b>Get your link</b><span>Sign in and open Refer &amp; earn. Copy your link, or share it straight to WhatsApp or email.</span></li>
            <li><b>They sign up</b><span>The business creates its account with your link. Your code is already filled in for them.</span></li>
            <li><b>We confirm and reward you</b><span>Once our team confirms the company, your reward of up to US$30 is set and we contact you to pay it.</span></li>
          </ol>
        </div>
      </section>
      <section className="lp-sec tint">
        <div className="lp-wrap lp-faq">
          <h2 className="lp-h2">Questions</h2>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          <p className="lp-more"><Link href="/terms#referrals">Full refer &amp; earn terms</Link></p>
        </div>
      </section>
    </>
  );
}
