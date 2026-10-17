import SiteHeader from "../../components/landing/SiteHeader";
import SiteFooter from "../../components/landing/SiteFooter";
import ReferBar from "../../components/landing/ReferBar";
import "../../components/landing/landing.css";

/** Shared frame for every public page: the refer & earn strip, the header, and the footer at the bottom. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp">
      <ReferBar />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
