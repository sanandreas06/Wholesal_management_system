import type { Metadata } from "next";
import GetStartedForm from "../../../components/landing/GetStartedForm";

export const metadata: Metadata = { title: "Get started | WHOLESTRA", description: "Tell us about your business and arrange a walkthrough of WHOLESTRA." };

export default function GetStarted() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>Get started with WHOLESTRA</h1><p className="lp-lead">Tell us a little about your business. We will reply to arrange a walkthrough.</p></div></section>
      <section className="lp-sec light">
        <div className="lp-wrap lp-split gs">
          <div>
            <h2 className="lp-h2">What happens next</h2>
            <ol className="lp-steps-list">
              <li><b>You send your details.</b><span>It takes about a minute.</span></li>
              <li><b>We reply to arrange a walkthrough.</b><span>You see WHOLESTRA with sample data, then with your kind of products.</span></li>
              <li><b>Your owner account is set up.</b><span>You add your branches and people, then start recording.</span></li>
            </ol>
          </div>
          <div className="gs-card"><GetStartedForm /></div>
        </div>
      </section>
    </>
  );
}
