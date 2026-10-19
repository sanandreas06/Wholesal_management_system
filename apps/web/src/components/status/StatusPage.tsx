'use client';
import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "../landing/SiteHeader";
import ContactBlock from "../ContactBlock";
import StatusArt, { ArtKind } from "./StatusArt";
import { getSessionUser } from "../../lib/session";
import "../landing/landing.css";
import "../auth/auth.css";
import "./status.css";

export type StatusAction = { label: string; href: string; primary?: boolean };

/** One frame for every "you can't go here" moment: page not found, no access, an expired or cancelled link, or an error.
 *  When no actions are given it offers the right way back: the dashboard for someone signed in, otherwise the home page and sign in. */
export default function StatusPage({ code, art, title, text, actions, extra, children }: {
  code?: string; art: ArtKind; title: string; text: React.ReactNode; actions?: StatusAction[]; extra?: React.ReactNode; children?: React.ReactNode;
}) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setSignedIn(!!getSessionUser()); }, []);
  const list: StatusAction[] = actions ?? (signedIn
    ? [{ label: "Go to my dashboard", href: "/dashboard", primary: true }, { label: "Home page", href: "/" }]
    : [{ label: "Go to the home page", href: "/", primary: true }, { label: "Sign in", href: "/login" }]);

  return (
    <div className="ep">
      <SiteHeader />
      <main className="ep-main">
        <div className="ep-card">
          <StatusArt kind={art} />
          <div className="ep-copy">
            {code && <p className="ep-code">{code}</p>}
            <h1>{title}</h1>
            <div className="ep-text">{text}</div>
            <div className="ep-actions">
              {list.map(a => <Link key={a.href + a.label} href={a.href} className={a.primary ? "ep-btn primary" : "ep-btn"}>{a.label}</Link>)}
              {extra}
            </div>
            {children}
          </div>
        </div>
        <nav className="ep-more" aria-label="Popular pages">
          <span>Or try:</span>
          <Link href="/features">Features</Link>
          <Link href="/security">How we keep your data safe</Link>
          <Link href="/contact">Contact us</Link>
          <Link href="/status">Service status</Link>
        </nav>
        <ContactBlock />
      </main>
    </div>
  );
}
