'use client';
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "./AuthShell";
import OtpBoxes from "./OtpBoxes";
import { finishSignIn } from "./SignInFlow";
import { authApi, SessionResponse } from "../../lib/authApi";
import { ApiError } from "../../lib/api";

/** Where Google, Facebook and LinkedIn send people back. The one-time note travels in the part of the address after #, which never reaches any server log; it is swapped for a session here.
 *  An account with an authenticator app is asked for its code first. */
export default function OAuthComplete() {
  const router = useRouter();
  const [kind, setKind] = useState<"oauth" | "mfa" | "">("");
  const [ticket, setTicket] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; started.current = true;
    const h = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, "", window.location.pathname);
    const k = h.get("kind"), t = h.get("ticket") ?? "";
    if (!t || (k !== "oauth" && k !== "mfa")) { setError("This sign-in link is not complete. Please start again."); return; }
    setKind(k); setTicket(t);
    if (k === "oauth") {
      setBusy(true);
      authApi.post<SessionResponse>("/auth/oauth/exchange", { ticket: t })
        .then((s) => finishSignIn(router, s))
        .catch((e) => setError(e instanceof ApiError ? e.message : "Could not finish signing you in."))
        .finally(() => setBusy(false));
    }
  }, [router]);

  async function verify(v = code) {
    if (!recovery && v.length < 6) return;
    setBusy(true); setError("");
    try { finishSignIn(router, await authApi.post<SessionResponse>("/auth/authenticator", { mfa: ticket, code: v })); }
    catch (e) { setError(e instanceof ApiError ? e.message : "That code did not work."); setCode(""); }
    finally { setBusy(false); }
  }

  return (
    <AuthShell>
      <section className="au-card" aria-live="polite">
        {kind === "mfa" ? <>
          <h1>One more check</h1>
          <p className="au-sub">{recovery ? "Type one of your recovery codes." : "Type the 6-digit code from your authenticator app."}</p>
          <form onSubmit={(e) => { e.preventDefault(); verify(); }}>
            {recovery ? <div className="au-field"><label htmlFor="rc">Recovery code</label><input id="rc" value={code} onChange={(e) => setCode(e.target.value)} autoFocus placeholder="xxxxx-xxxxx" /></div>
              : <OtpBoxes value={code} onChange={setCode} onComplete={(v) => verify(v)} disabled={busy} invalid={!!error} label="Code from your authenticator app" />}
            {error && <div className="au-err" role="alert">{error}</div>}
            <button className="au-primary" disabled={busy}>{busy ? "Checking..." : "Verify"}</button>
          </form>
          <div className="au-actions"><button type="button" className="au-link" onClick={() => { setRecovery(!recovery); setCode(""); }}>{recovery ? "Use the authenticator app" : "I can't use my authenticator app"}</button></div>
        </> : error ? <>
          <h1>Sign-in did not finish</h1>
          <div className="au-err" role="alert">{error}</div>
          <p className="au-alt"><Link href="/login">Back to sign in</Link> · <Link href="/get-started">Create an account</Link></p>
        </> : <>
          <h1>Signing you in...</h1>
          <div className="au-spin" aria-hidden="true" />
          <p className="au-sub">One moment while we open your account.</p>
        </>}
      </section>
    </AuthShell>
  );
}
