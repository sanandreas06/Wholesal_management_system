'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { CONTACT_EMAIL, CONTACT_HOURS, CONTACT_PHONE, CONTACT_WHATSAPP, telHref, whatsappHref } from "../../lib/contact";

type Progress = { profileDone: boolean; hasLogo: boolean; branches: number; products: number; customers: number; suppliers: number; sales: number; users: number; orders: number; imports: number; stockEntries: number; authenticator: boolean; createdAt: string | null; demo: boolean };
type Mine = { demo: boolean; code: string | null; maxUsd: number; totals: { registered: number } };

type Step = { title: string; text: string; href: string; cta: string; done: boolean; optional?: boolean };

/** What this release added, newest first. Kept short and in plain words. */
const NEWS: { tag: string; title: string; text: string }[] = [
  { tag: "New", title: "Safer sign-in", text: "Sign in with your email first, confirm a 6-digit code, then your password. Add an authenticator app for a second lock." },
  { tag: "New", title: "Sign up with Google, Facebook or LinkedIn", text: "New companies can create an account in a minute and set up their profile straight away." },
  { tag: "New", title: "Product pictures and tracking", text: "Add a picture to each product. The Products & tracking tab shows top sellers, goods on the road and stock by branch." },
  { tag: "New", title: "Refer & earn", text: "Invite another company. When they sign up and our team confirms them, you can earn up to US$30." },
  { tag: "New", title: "All settings in one place", text: "Company profile, branding, users, roles, security and more, grouped like the rest of the app." },
  { tag: "Improved", title: "Your own currency", text: "Choose your currency in the company profile and every amount in the app follows it." },
];

export default function GettingStarted() {
  const [p, setP] = useState<Progress | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api.get<Progress>("/home/getting-started").then(setP).catch((e) => setError(e.message));
    api.get<Mine>("/referrals/me").then(setMine).catch(() => {});
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!p) return <div className="ht-skel" aria-busy="true"><i /><i /></div>;

  const steps: Step[] = [
    { title: "Set up your company profile", text: "Name, location, currency, time zone and fiscal year.", href: "/settings/organization", cta: "Open profile", done: p.profileDone },
    { title: "Protect your account", text: "Turn on an authenticator app so a stolen password is not enough to get in.", href: "/settings/security", cta: "Turn on", done: p.authenticator },
    { title: "Add your products, with pictures", text: "One by one, or many at once from an Excel sheet.", href: "/products?new=1", cta: "Add a product", done: p.products > 0 },
    { title: "Record your opening stock", text: "How many of each product every branch has today.", href: "/inventory", cta: "Enter stock", done: p.stockEntries > 0 },
    { title: "Add your customers and suppliers", text: "So invoices, credit and purchase orders have names on them.", href: "/customers?new=1", cta: "Add a customer", done: p.customers > 0 && p.suppliers > 0 },
    { title: "Record your first sale", text: "Create an invoice and take payment by cash, mobile money or bank.", href: "/sales?new=1", cta: "New sale", done: p.sales > 0 },
    { title: "Add your other branches", text: "Skip this if you only have one shop or warehouse.", href: "/branches?new=1", cta: "Add a branch", done: p.branches > 1, optional: true },
    { title: "Invite your team", text: "Give each person a role, so they only see their branch and their work.", href: "/users?new=1", cta: "Add a person", done: p.users > 1, optional: true },
    { title: "Add your logo", text: "It appears on invoices and at the top of the app.", href: "/settings/branding", cta: "Upload logo", done: p.hasLogo, optional: true },
    { title: "Import weekly sales from Excel", text: "For branches that still keep sales in a spreadsheet.", href: "/imports", cta: "Import", done: p.imports > 0, optional: true },
  ];
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const pct = Math.round((doneCount / required.length) * 100);
  const next = steps.find((s) => !s.done);
  const link = mine?.code && typeof window !== "undefined" ? `${window.location.origin}/get-started?ref=${mine.code}` : "";

  return (
    <div className="gs2">
      <article className="card2 gs2-main">
        <div className="gs2-head">
          <div>
            <h3>{p.demo ? "How a new company gets going" : pct === 100 ? "You're all set up 🎉" : "Let's get your business running"}</h3>
            <p className="sub">{p.demo ? "In the demo these steps are already done for you. In your own account, each one takes a few minutes." : `${doneCount} of ${required.length} essential steps done`}</p>
          </div>
          <div className="gs2-ring" style={{ ["--p" as string]: pct }} role="img" aria-label={`${pct}% done`}><span>{pct}%</span></div>
        </div>
        <ol className="gs2-steps">
          {steps.map((s, i) => (
            <li key={s.title} className={(s.done ? "done" : "") + (s === next ? " next" : "")}>
              <span className="gs2-n" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
              <div><b>{s.title}{s.optional && <em>optional</em>}</b><small>{s.text}</small></div>
              {s.done ? <span className="gs2-done">Done</span> : !p.demo && <Link href={s.href} className={s === next ? "gs2-go primary" : "gs2-go"}>{s.cta}</Link>}
            </li>
          ))}
        </ol>
      </article>

      <aside className="gs2-side">
        <article className="card2 gs2-refer">
          <span className="gs2-gift" aria-hidden="true">🎁</span>
          <h3>Refer a company, earn up to US$30</h3>
          <p className="sub">Know another wholesaler? Share your link. When they sign up and our team confirms them, you earn up to US${mine?.maxUsd ?? 30}.</p>
          {link
            ? <div className="gs2-link"><code title={link}>{link.replace(/^https?:\/\//, "")}</code><button type="button" onClick={() => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {}); }}>{copied ? "Copied ✓" : "Copy"}</button></div>
            : mine?.demo ? <p className="sub"><b>Create your own account</b> to get a referral link.</p> : null}
          <Link href="/referrals" className="gs2-more">See your referrals →</Link>
        </article>

        <article className="card2 gs2-help">
          <h3>Need a hand?</h3>
          <p className="sub">We can set up your products and branches with you. Hours: {CONTACT_HOURS}.</p>
          <div className="gs2-help-actions">
            {CONTACT_WHATSAPP && <a href={whatsappHref("Hello WHOLESTRA, I would like help setting up my account.")} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}
            {CONTACT_PHONE && <a href={telHref(CONTACT_PHONE)}>☎ Call us</a>}
            {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Help setting up WHOLESTRA")}`}>✉ Email</a>}
            {!CONTACT_WHATSAPP && !CONTACT_PHONE && !CONTACT_EMAIL && <a href="/contact">Contact us</a>}
          </div>
        </article>

        <article className="card2 gs2-news">
          <h3>What&apos;s new</h3>
          <ul>{NEWS.map((n) => <li key={n.title}><span className={"gs2-tag " + n.tag.toLowerCase()}>{n.tag}</span><b>{n.title}</b><small>{n.text}</small></li>)}</ul>
        </article>
      </aside>
    </div>
  );
}
