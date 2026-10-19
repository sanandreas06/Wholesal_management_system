import Link from "next/link";
import StatusArt from "./StatusArt";
import "./status.css";

/** Shown inside the app instead of a page the signed-in person's role does not include, for example when a colleague sends them a link.
 *  Nothing from that page is loaded. */
export default function AccessNotice({ page, company }: { page: string; company?: string }) {
  return (
    <section className="ep-inapp" aria-labelledby="ep-denied">
      <StatusArt kind="locked" label="A locked carton on a shelf" />
      <div className="ep-copy">
        <p className="ep-code">No access</p>
        <h1 id="ep-denied">You don&apos;t have access to {page}</h1>
        <div className="ep-text">
          <p>Your role{company ? <> at <b>{company}</b></> : null} does not include this page. If someone sent you this link, they can see it, but you can&apos;t yet.</p>
          <p>If you need it for your work, ask your owner or administrator to add it to your role.</p>
        </div>
        <div className="ep-actions">
          <Link href="/dashboard" className="ep-btn primary">Go to my dashboard</Link>
          <Link href="/settings" className="ep-btn">My settings</Link>
        </div>
      </div>
    </section>
  );
}
