import SiteHeader from "../../components/landing/SiteHeader";
import SiteFooter from "../../components/landing/SiteFooter";
import "../../components/landing/landing.css";

/** Shared frame for every public page: header on top, footer at the bottom. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
