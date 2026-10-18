'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "../Logo";
import InstallApp from "../InstallApp";
import { clearSession, getSessionUser } from "../../lib/session";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/security", label: "Security" },
  { href: "/refer", label: "Refer & earn" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/** Top bar for every public page. Logo sits at the far left, the account buttons at the far right. Visitors see "Sign in" and "Get started"; someone who is signed in sees "Open dashboard" and "Sign out". */
export default function SiteHeader() {
  const path = usePathname();
  const [user, setUser] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [raised, setRaised] = useState(false);

  useEffect(() => {
    const u = getSessionUser(); setUser(u ? u.name : null);
    try { const t = localStorage.getItem("wms_theme"); if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const on = () => setRaised(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  function signOut() {
    let theme: string | null = null;
    try { theme = localStorage.getItem("wms_theme"); } catch { /* ignore */ }
    clearSession();
    try { if (theme) localStorage.setItem("wms_theme", theme); } catch { /* ignore */ }
    setUser(null); setOpen(false);
  }

  const account = user ? (
    <>
      <Link href="/dashboard" className="lp-btn solid sm">Open dashboard</Link>
      <button type="button" className="lp-btn ghost sm" onClick={signOut}>Sign out</button>
    </>
  ) : (
    <>
      <Link href="/login" className="lp-btn ghost sm">Sign in</Link>
      <Link href="/get-started" className="lp-btn kraft sm">Get started</Link>
    </>
  );

  return (
    <header className={"lp-top" + (raised ? " raised" : "")}>
      <Link href="/" className="lp-brand" aria-label="WHOLESTRA home"><Logo size={44} tone="dark" /></Link>
      <nav className="lp-links" aria-label="Main">
        {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>)}
      </nav>
      <div className="lp-acct"><InstallApp className="lp-btn ghost sm lp-install" />{account}</div>
      <button type="button" className="lp-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="lp-menu" onClick={() => setOpen(!open)}><i /><i /><i /></button>
      <div id="lp-menu" className={"lp-menu" + (open ? " open" : "")}>
        {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>)}
        <div className="lp-menu-acct"><InstallApp className="lp-btn ghost sm lp-install" onOpen={() => setOpen(false)} />{account}</div>
      </div>
    </header>
  );
}
