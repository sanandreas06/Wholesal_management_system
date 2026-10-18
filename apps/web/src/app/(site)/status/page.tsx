import type { Metadata } from "next";
import StatusCheck from "../../../components/landing/StatusCheck";

export const metadata: Metadata = { title: "System status | WHOLESTRA", description: "Checks that sign-in, email codes and social sign-in are set up.", robots: { index: false } };

export default function Status() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>System status</h1><p className="lp-lead">A quick check of everything sign-in depends on. If something is not working, this page says what to fix.</p></div></section>
      <section className="lp-sec light"><div className="lp-wrap"><StatusCheck /></div></section>
    </>
  );
}
