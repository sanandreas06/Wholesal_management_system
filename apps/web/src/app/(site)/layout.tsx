import SiteHeader from "../../components/landing/SiteHeader";
import SiteFooter from "../../components/landing/SiteFooter";
import ReferBar from "../../components/landing/ReferBar";
import Assistant from "../../components/assistant/Assistant";
import "../../components/landing/landing.css";

/** Shared frame for every public page: the refer & earn strip, the header, the footer at the bottom, and the assistant. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp">
      <ReferBar />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <Assistant mode="site" />
    </div>
  );
}
