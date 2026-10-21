'use client';
import { useEffect } from "react";
import StatusPage from "../components/status/StatusPage";
import { reportError } from "../lib/report";

/** Shown when a page fails while loading. Trying again is usually enough; nothing the person saved is lost. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); reportError(error); }, [error]);
  return (
    <StatusPage code="Something went wrong" art="broken" title="This page did not load"
      text={<p>Something went wrong on our side while opening this page. Your saved work is safe. Try again, and if it keeps happening, contact us{error.digest ? <> and quote the reference <b>{error.digest}</b></> : null}.</p>}>
      <div className="ep-actions"><button type="button" className="ep-btn primary" onClick={reset}>Try again</button></div>
    </StatusPage>
  );
}
