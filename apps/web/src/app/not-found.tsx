import type { Metadata } from "next";
import StatusPage from "../components/status/StatusPage";

export const metadata: Metadata = { title: "Page not found | WHOLESTRA", robots: { index: false } };

/** Shown for any address that does not exist, such as a mistyped link or an old bookmark. */
export default function NotFound() {
  return (
    <StatusPage code="Error 404" art="missing" title="This shelf is empty"
      text={<>
        <p>We could not find the page you asked for. The link may be mistyped, the page may have moved, or it may be from an old bookmark.</p>
        <p>If someone sent you this link, ask them to check it. If you think it should work, tell us and we will look into it.</p>
      </>} />
  );
}
