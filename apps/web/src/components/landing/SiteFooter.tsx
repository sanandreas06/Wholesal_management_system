import Link from "next/link";
import Logo from "../Logo";
import { CONTACT_EMAIL, CONTACT_HOURS, CONTACT_LOCATION, CONTACT_PHONES, CONTACT_WHATSAPP, telHref, whatsappHref } from "../../lib/contact";

export default function SiteFooter() {
  return (
    <footer className="lp-foot">
      <div className="lp-foot-in">
        <div className="lp-foot-brand">
          <Link href="/" aria-label="WHOLESTRA home"><Logo size={40} /></Link>
          <p>Stock, sales and money for wholesalers with more than one branch.</p>
        </div>
        <nav aria-label="Product"><h2>Product</h2><Link href="/features">Features</Link><Link href="/security">Security</Link><Link href="/get-started">Create an account</Link><Link href="/login">Sign in</Link></nav>
        <nav aria-label="Company"><h2>Company</h2><Link href="/about">About</Link><Link href="/refer">Refer &amp; earn</Link><Link href="/terms">Terms of use</Link><Link href="/privacy">Privacy notice</Link><Link href="/status">System status</Link></nav>
        <div className="lp-foot-contact"><h2>Contact</h2>
          {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>}
          {CONTACT_PHONES.map((n) => <a key={n} href={telHref(n)}>{n}</a>)}
          {CONTACT_WHATSAPP && <a href={whatsappHref()} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {!CONTACT_EMAIL && !CONTACT_PHONES.length && !CONTACT_WHATSAPP && <Link href="/contact">Contact us</Link>}
          <span>{CONTACT_HOURS}</span>
          <span>{CONTACT_LOCATION}</span>
        </div>
      </div>
      <p className="lp-foot-end">© {new Date().getFullYear()} WHOLESTRA. Figures shown on this site are sample data.</p>
    </footer>
  );
}
