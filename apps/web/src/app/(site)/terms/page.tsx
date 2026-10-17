import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "../../../lib/contact";

export const metadata: Metadata = { title: "Terms of use | WHOLESTRA", description: "The terms for using WHOLESTRA." };

export default function Terms() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>Terms of use</h1><p className="lp-lead">The rules for using WHOLESTRA, in plain language.</p></div></section>
      <section className="lp-sec light">
        <div className="lp-wrap lp-legal">
          <p className="lp-updated">Last updated: October 2026</p>
          <h2>1. The service</h2>
          <p>WHOLESTRA is online software for recording stock, sales, purchases, expenses and related records for businesses with one or more branches. By creating an account or using the service, you agree to these terms on behalf of yourself and the business you represent.</p>
          <h2>2. Your account</h2>
          <ul>
            <li>Give us true details when you sign up, and keep your email address up to date: we use it to confirm sign-ins.</li>
            <li>Keep your password, authenticator app and recovery codes private. You are responsible for what is done with your account.</li>
            <li>The owner of a company account decides who else may use it and what each person can see. Remove people who no longer work with you.</li>
            <li>Tell us straight away if you think someone else has used your account.</li>
          </ul>
          <h2>3. Your data</h2>
          <p>The records you enter belong to your business. We store and process them only to run the service for you, as described in our <Link href="/privacy">privacy notice</Link>. Each company can only see its own records. You can ask us for a copy of your data or to close your account at any time.</p>
          <h2>4. Fair use</h2>
          <ul>
            <li>Do not use WHOLESTRA for anything unlawful, to record goods you are not allowed to trade, or to store other people&apos;s personal data without a right to do so.</li>
            <li>Do not try to reach other companies&apos; data, break the security, or overload the service.</li>
            <li>The demo company is shared and read-only. Do not try to enter real records into it.</li>
          </ul>
          <h2 id="referrals">5. Refer &amp; earn</h2>
          <ul>
            <li>A company with a WHOLESTRA account may share its referral link or code with other businesses.</li>
            <li>A referral counts when a business that is new to WHOLESTRA signs up with that link or code and our team confirms it is a genuine, separate business. Your own extra accounts, branches of your own company and duplicate sign-ups do not count.</li>
            <li>The reward is up to US$30 per confirmed company. The amount for each referral is set when it is confirmed and shown in the app. It is paid in your local currency at the day&apos;s rate, by a method we agree with you.</li>
            <li>We may refuse or reverse a reward where a referral breaks these terms or appears to be fraudulent.</li>
            <li>We may change or end the programme at any time. Rewards already confirmed before a change are still paid.</li>
          </ul>
          <h2>6. Availability and changes</h2>
          <p>We work to keep WHOLESTRA available and your records safe, but we cannot promise the service will never be interrupted. We may improve or change features over time and will tell you about important changes.</p>
          <h2>7. Plans and payment</h2>
          <p>No payment is taken inside the app. Any plan or price for your company is agreed with you in writing before you are charged.</p>
          <h2>8. Responsibility</h2>
          <p>WHOLESTRA helps you keep records; decisions you make with them are your own. To the extent the law allows, we are not responsible for indirect losses, such as lost profit, that arise from using or not being able to use the service.</p>
          <h2>9. Ending</h2>
          <p>You may stop using WHOLESTRA at any time. We may suspend an account that breaks these terms, after telling you why where we can.</p>
          <h2>10. Contact</h2>
          <p>Questions about these terms: {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <Link href="/contact">contact us</Link>}.</p>
        </div>
      </section>
    </>
  );
}
