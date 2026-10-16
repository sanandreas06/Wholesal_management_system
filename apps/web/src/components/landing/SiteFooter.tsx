import Link from "next/link";
import Logo from "../Logo";

export default function SiteFooter() {
  return (
    <footer className="lp-foot">
      <div className="lp-foot-in">
        <div className="lp-foot-brand">
          <Link href="/" aria-label="WHOLESTRA home"><Logo size={40} /></Link>
          <p>Stock, sales and money for wholesalers with more than one branch.</p>
        </div>
        <nav aria-label="Product"><h2>Product</h2><Link href="/features">Features</Link><Link href="/security">Security</Link><Link href="/get-started">Get started</Link></nav>
        <nav aria-label="Company"><h2>Company</h2><Link href="/about">About</Link><Link href="/contact">Contact</Link></nav>
        <nav aria-label="Account"><h2>Account</h2><Link href="/login">Sign in</Link><Link href="/dashboard">Open dashboard</Link></nav>
      </div>
      <p className="lp-foot-end">© 2026 WHOLESTRA. Every figure on this site is sample data.</p>
    </footer>
  );
}
