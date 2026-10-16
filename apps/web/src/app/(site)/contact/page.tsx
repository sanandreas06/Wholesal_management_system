import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "../../../lib/contact";

export const metadata: Metadata = { title: "Contact | WHOLESTRA", description: "Questions about WHOLESTRA and how it would work for your business." };

const FAQ = [
  ["Who is WHOLESTRA for?", "Wholesale businesses with one or more branches that want stock, sales, purchasing and expenses in one place."],
  ["Can a branch manager see other branches?", "No. A role can be limited to its own branch, and the limit applies to every screen and report."],
  ["Does it work on phones?", "Yes. The menu slides out, tables scroll sideways and dialogs fit the screen."],
  ["Can we bring in our Excel sales?", "Yes. Upload .xlsx or .csv files by branch and period. Rows that were already imported are not counted twice."],
  ["What happens if someone changes a price?", "The change is written to the change log with who did it, when, and the old and new values."],
  ["Is my data safe on this demo?", "The demo uses sample data on free hosting. Please do not enter real customer or shop records."],
];

export default function Contact() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>Ask us anything</h1><p className="lp-lead">Questions about how WHOLESTRA would work for your business are welcome.</p></div></section>
      <section className="lp-sec light">
        <div className="lp-wrap lp-split">
          <div>
            <h2 className="lp-h2">Reach us</h2>
            {CONTACT_WHATSAPP || CONTACT_EMAIL ? (
              <div className="lp-contacts">
                {CONTACT_WHATSAPP && <a href={`https://wa.me/${CONTACT_WHATSAPP}`} target="_blank" rel="noreferrer"><b>WhatsApp</b><span>+{CONTACT_WHATSAPP}</span></a>}
                {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}><b>Email</b><span>{CONTACT_EMAIL}</span></a>}
              </div>
            ) : <p className="lp-sub">Contact details are not published on this site yet. The quickest way is to prepare a message on the <Link href="/get-started">Get started</Link> page and send it to the person who shared this site with you.</p>}
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
