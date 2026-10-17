'use client';
import SettingsPage from "./SettingsPage";
import { SOON } from "./catalog";
import { CONTACT_EMAIL, whatsappHref, CONTACT_WHATSAPP } from "../../lib/contact";

/** A planned setting that is not built yet. Says so plainly, explains what it will do, and lets the company ask for it. */
export default function ComingSoon({ slug }: { slug: string }) {
  const item = SOON[slug] ?? { title: "Coming soon", text: "This part of WHOLESTRA is planned but not available yet." };
  const ask = `Hello WHOLESTRA, we would like "${item.title}".`;
  return (
    <SettingsPage title={item.title}>
      <article className="panel st-soon-card">
        <span className="st-soon big">Coming soon</span>
        <p>{item.text}</p>
        <p className="muted">This is not available yet. If your business needs it, tell us: requests decide what we build next.</p>
        <div className="st-row">
          {CONTACT_WHATSAPP && <a className="btn-link" href={whatsappHref(ask)} target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a>}
          {CONTACT_EMAIL && <a className="btn-link secondary" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Request: ${item.title}`)}&body=${encodeURIComponent(ask)}`}>Ask by email</a>}
          {!CONTACT_EMAIL && !CONTACT_WHATSAPP && <a className="btn-link" href="/contact">Contact us</a>}
        </div>
      </article>
    </SettingsPage>
  );
}
