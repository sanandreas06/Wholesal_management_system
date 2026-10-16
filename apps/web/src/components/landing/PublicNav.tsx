import Link from "next/link";
import Logo from "../Logo";
import AuthLink from "./AuthLink";

/** Top bar for the public pages (home and sign-in). "dark" sits on the navy hero; "light" sits on a plain bar. */
export default function PublicNav({ variant = "dark", signIn = true }: { variant?: "dark" | "light"; signIn?: boolean }) {
  return (
    <nav className={`lp-nav ${variant}`} aria-label="Main">
      <Link href="/" className="lp-brand" aria-label="WHOLESTRA home"><Logo size={40} /></Link>
      <div className="lp-links">
        <Link href="/">Home</Link>
        <Link href="/#features">Features</Link>
        <Link href="/#modules">Modules</Link>
        <Link href="/#how">How it works</Link>
        <Link href="/#safe">Security</Link>
      </div>
      <div className="lp-nav-cta">
        {signIn ? <AuthLink className="lp-btn solid">Sign in</AuthLink> : <Link href="/" className="lp-btn line">← Back to home</Link>}
      </div>
    </nav>
  );
}
