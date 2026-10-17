import type { Metadata } from "next";
import ContactForm from "../../../components/landing/ContactForm";
import { CONTACT_EMAIL, CONTACT_HOURS, CONTACT_LOCATION, CONTACT_PHONES, CONTACT_WHATSAPP, telHref, whatsappHref } from "../../../lib/contact";

export const metadata: Metadata = { title: "Contact | WHOLESTRA", description: "Send WHOLESTRA a message, call us or chat on WhatsApp." };

const FAQS = [
  ["Who is WHOLESTRA for?", "Wholesale businesses with one or more branches that want stock, sales, purchasing and expenses in one place."],
  ["Can I try it without signing up?", "Yes. “Try the demo” on the home or sign-in page opens a sample company. It is read-only and shared, so please do not enter real records there."],
  ["How do I create an account?", "Choose “Get started”, sign up with your email (we send a code to confirm it) or with Google, Facebook or LinkedIn, then fill in your company profile."],
  ["How is my account protected?", "Every sign-in starts with a code sent to your email, and you can add Google Authenticator for a second lock."],
  ["Can a branch manager see other branches?", "No. A role can be limited to its own branch, and the limit applies to every screen and report."],
  ["Does it work on phones?", "Yes. The menu slides out, tables scroll sideways and forms fit the screen."],
  ["Can we bring in our Excel sales?", "Yes. Upload .xlsx or .csv files by branch and period. Rows already imported are not counted twice."],
  ["What is refer & earn?", "Introduce another business to WHOLESTRA. When it signs up with your link and our team confirms it, you earn up to US$30."],
];

export default function Contact() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>Talk to us</h1><p className="lp-lead">Questions, a demo for your team, or help with your account. Send us a message and we reply within one working day.</p></div></section>
      <section className="lp-sec light">
        <div className="lp-wrap cf-layout">
          <div className="cf-card">
            <h2 className="cf-h">Send us a message</h2>
            <ContactForm />
          </div>
          <aside className="cf-side">
            <h2 className="cf-h">Other ways to reach us</h2>
            <div className="lp-contacts">
              {CONTACT_WHATSAPP && <a href={whatsappHref("Hello WHOLESTRA")} target="_blank" rel="noreferrer"><b>WhatsApp</b><span>Chat with us</span></a>}
              {CONTACT_PHONES.length > 0 && <div className="lp-contact-box"><b>Call us</b><span>{CONTACT_PHONES.map((n, i) => <span key={n}>{i ? " | " : ""}<a href={telHref(n)}>{n}</a></span>)}</span></div>}
              {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}><b>Email</b><span>{CONTACT_EMAIL}</span></a>}
            </div>
            <p className="cf-hours">{CONTACT_HOURS}<br />{CONTACT_LOCATION}</p>
          </aside>
        </div>
      </section>
      <section className="lp-sec tint" id="faqs">
        <div className="lp-wrap lp-faq">
          <h2 className="lp-h2">FAQs</h2>
          {FAQS.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </section>
    </>
  );
}
