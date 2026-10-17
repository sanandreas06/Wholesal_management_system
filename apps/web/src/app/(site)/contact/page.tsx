import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_HOURS, CONTACT_LOCATION, CONTACT_PHONE, CONTACT_WHATSAPP, telHref } from "../../../lib/contact";

export const metadata: Metadata = { title: "Contact | WHOLESTRA", description: "Questions about WHOLESTRA and how it would work for your business." };

const FAQ = [
  ["Who is WHOLESTRA for?", "Wholesale businesses with one or more branches that want stock, sales, purchasing and expenses in one place."],
  ["Can a branch manager see other branches?", "No. A role can be limited to its own branch, and the limit applies to every screen and report."],
  ["Does it work on phones?", "Yes. The menu slides out, tables scroll sideways and dialogs fit the screen."],
  ["Can we bring in our Excel sales?", "Yes. Upload .xlsx or .csv files by branch and period. Rows that were already imported are not counted twice."],
  ["What happens if someone changes a price?", "The change is written to the change log with who did it, when, and the old and new values."],
  ["Can I try it without signing up?", "Yes. “Try the demo” on the home or sign-in page opens a sample company. It is read-only and shared, so please do not try to enter real records there."],
  ["How do I create an account?", "Choose “Get started”, sign up with your email (we send a code to confirm it) or with Google, Facebook or LinkedIn, then fill in your company profile."],
  ["How is my account protected?", "Every sign-in starts with a code sent to your email, and you can add an authenticator app such as Google Authenticator for a second lock."],
  ["What is refer & earn?", "Introduce another business to WHOLESTRA. When it signs up with your link and our team confirms it, you earn up to US$30."],
];

export default function Contact() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>Ask us anything</h1><p className="lp-lead">Questions about how WHOLESTRA would work for your business are welcome.</p></div></section>
      <section className="lp-sec light">
        <div className="lp-wrap lp-split">
          <div>
            <h2 className="lp-h2">Reach us</h2>
            {CONTACT_WHATSAPP || CONTACT_EMAIL || CONTACT_PHONE ? (
              <div className="lp-contacts">
                {CONTACT_WHATSAPP && <a href={`https://wa.me/${CONTACT_WHATSAPP}`} target="_blank" rel="noreferrer"><b>WhatsApp</b><span>+{CONTACT_WHATSAPP}</span></a>}
                {CONTACT_PHONE && <a href={telHref(CONTACT_PHONE)}><b>Call us</b><span>{CONTACT_PHONE}</span></a>}
                {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}><b>Email</b><span>{CONTACT_EMAIL}</span></a>}
              </div>
            ) : <p className="lp-sub">Contact details are not published on this site yet. You can <Link href="/get-started">create an account</Link> or try the demo in the meantime.</p>}
            <p className="lp-sub">{CONTACT_HOURS}. {CONTACT_LOCATION}.</p>
          </div>
          <div className="lp-faq">
            <h2 className="lp-h2">Common questions</h2>
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </div>
      </section>
    </>
  );
}
