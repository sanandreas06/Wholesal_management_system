import { CONTACT_EMAIL, CONTACT_HOURS, CONTACT_LOCATION, CONTACT_PHONES, CONTACT_WHATSAPP, telHref, whatsappHref } from "../lib/contact";

/** Our contact details. `variant="strip"` is one line (under the sign-in box); `"footer"` is the block at the bottom of every screen inside the app. Details that have not been set are left out. */
export default function ContactBlock({ variant = "strip" }: { variant?: "strip" | "footer" }) {
  const items = [
    CONTACT_EMAIL && <a key="e" href={`mailto:${CONTACT_EMAIL}`}><span aria-hidden="true">✉</span>{CONTACT_EMAIL}</a>,
    CONTACT_PHONES.length > 0 && <span key="p" className="contact-phones"><span aria-hidden="true">☎</span>{CONTACT_PHONES.map((n, i) => <span key={n}>{i ? " | " : ""}<a href={telHref(n)}>{n}</a></span>)}</span>,
    CONTACT_WHATSAPP && <a key="w" href={whatsappHref("Hello WHOLESTRA, I need help with")} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">💬</span>WhatsApp</a>,
  ].filter(Boolean);
  if (variant === "strip") {
    return (
      <div className="contact-strip">
        <span>Need help?</span>
        {items.length ? items : <a href="/contact">Contact us</a>}
      </div>
    );
  }
  return (
    <footer className="app-foot" aria-label="Contact and help">
      <div className="app-foot-in">
        <div>
          <h2>Need help?</h2>
          <p>Our team answers: {CONTACT_HOURS}.</p>
          <div className="app-foot-links">{items.length ? items : <a href="/contact">Contact us</a>}</div>
        </div>
        <div>
          <h2>Quick links</h2>
          <div className="app-foot-col"><a href="/dashboard?tab=start">Getting started</a><a href="/settings">Settings</a><a href="/referrals">Refer & earn</a><a href="/security">How we keep your data safe</a></div>
        </div>
        <div>
          <h2>WHOLESTRA</h2>
          <div className="app-foot-col"><span>{CONTACT_LOCATION}</span><a href="/terms">Terms of use</a><a href="/privacy">Privacy notice</a></div>
        </div>
      </div>
      <p className="app-foot-end">© {new Date().getFullYear()} WHOLESTRA</p>
    </footer>
  );
}
