import type { Metadata } from "next";
import StatusPage from "../../components/status/StatusPage";
import DemoButton from "../../components/landing/DemoButton";

export const metadata: Metadata = { title: "Sign-up cancelled | WHOLESTRA", robots: { index: false } };

/** After someone presses Cancel on the sign-up review. Says plainly that nothing was created or kept. */
export default function SignupCancelled() {
  return (
    <StatusPage code="Sign-up cancelled" art="cancelled" title="No account was created"
      text={<>
        <p>You cancelled before your email was confirmed, so we did not create an account or a company. If we already sent you a code, it simply expires in a few minutes.</p>
        <p>You can start again whenever you are ready, or look around the demo company first. It needs no sign-up.</p>
      </>}
      actions={[{ label: "Start again", href: "/get-started", primary: true }, { label: "Home page", href: "/" }]}
      extra={<DemoButton className="ep-btn" />} />
  );
}
