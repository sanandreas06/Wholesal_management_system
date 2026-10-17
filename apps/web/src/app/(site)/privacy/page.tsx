import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "../../../lib/contact";

export const metadata: Metadata = { title: "Privacy notice | WHOLESTRA", description: "What personal data WHOLESTRA keeps, why, and your choices." };

export default function Privacy() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>Privacy notice</h1><p className="lp-lead">What we keep about you, why we keep it, and what you can ask us to do.</p></div></section>
      <section className="lp-sec light">
        <div className="lp-wrap lp-legal">
          <p className="lp-updated">Last updated: October 2026</p>
          <h2>What we keep</h2>
          <ul>
            <li><b>Your account:</b> your name, email address, optional phone number, and your password stored in a scrambled form that cannot be read back.</li>
            <li><b>If you sign in with Google, Facebook or LinkedIn:</b> your name, email address and that service&apos;s account number for you. We never see your password for those services.</li>
            <li><b>Security:</b> one-time email codes (stored scrambled and deleted after use or expiry), your authenticator app key (stored encrypted), scrambled recovery codes, and a record of sign-ins with the time, approximate device and network.</li>
            <li><b>Your company&apos;s records:</b> the products, stock, sales, customers, suppliers, expenses and other records your team enters.</li>
            <li><b>Refer &amp; earn:</b> which company referred which, and the reward status.</li>
          </ul>
          <h2>Why we keep it</h2>
          <ul>
            <li>To run the service you signed up for and show each person only what their role allows.</li>
            <li>To keep accounts safe: confirming sign-ins by email, checking authenticator codes, and spotting repeated wrong attempts.</li>
            <li>To keep the change log, so your business can see who changed what and when.</li>
            <li>To contact you about your account, and about referral rewards.</li>
          </ul>
          <p>We do not sell personal data, and we do not use your company&apos;s records for advertising.</p>
          <h2>Who else handles it</h2>
          <p>We use trusted providers to host the database and the app, and to send emails (such as sign-in codes). They handle data only to provide those services to us. If you choose Google, Facebook or LinkedIn sign-in, that service confirms who you are.</p>
          <h2>How long we keep it</h2>
          <p>Account and company records are kept while your account is open. Sign-in codes expire after 10 minutes. When a company closes its account, we delete or anonymise its records within a reasonable time, unless the law requires us to keep some of them longer.</p>
          <h2>Your choices</h2>
          <p>You can ask to see, correct, export or delete your personal data, or to close your account. Your company&apos;s owner can also correct or remove people&apos;s details. We handle personal data in line with the data protection law that applies to us, including Ghana&apos;s Data Protection Act, 2012 (Act 843).</p>
          <h2>Cookies and storage</h2>
          <p>WHOLESTRA keeps your sign-in and a few settings (such as light or dark mode) in your browser. A short-lived cookie is used only while you sign in with Google, Facebook or LinkedIn, to protect that step. We do not use advertising cookies.</p>
          <h2>Contact</h2>
          <p>Privacy questions and requests: {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <Link href="/contact">contact us</Link>}.</p>
        </div>
      </section>
    </>
  );
}
