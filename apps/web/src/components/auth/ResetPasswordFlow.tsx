'use client';
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "./AuthShell";
import OtpBoxes from "./OtpBoxes";
import PasswordInput, { passwordProblem } from "./PasswordInput";
import { finishSignIn } from "./SignInFlow";
import { authApi, SessionResponse } from "../../lib/authApi";
import { ApiError } from "../../lib/api";

/** Opened from the reset email. The one-time link travels after # (so it never reaches a server log) and is removed from the address bar at once.
 *  The new password is only saved with a valid link, plus a code from the authenticator app when the account has one. */
export default function ResetPasswordFlow() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [info, setInfo] = useState<{ email: string; company: string; needsAuthenticator: boolean } | null>(null);
  const [dead, setDead] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; started.current = true;
    const t = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    history.replaceState(null, "", window.location.pathname);
    if (!t) { router.replace("/link-expired?why=reset"); return; }
    setToken(t);
    authApi.post<{ email: string; company: string; needsAuthenticator: boolean }>("/auth/password/reset-info", { token: t })
      .then(setInfo)
      .catch((e) => setDead(e instanceof ApiError ? e.message : "We could not check this link. Please try again."));
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const p = passwordProblem(password);
    if (p) { setError(p); return; }
    if (password !== confirm) { setError("The two passwords are not the same."); return; }
    if (info?.needsAuthenticator && !code.trim()) { setError("Type the code from your authenticator app."); return; }
    setBusy(true); setError("");
    try {
      const s = await authApi.post<SessionResponse>("/auth/password/reset-link", { token, password, ...(info?.needsAuthenticator ? { code: code.trim() } : {}) });
      finishSignIn(router, s);
    } catch (e) {
      const m = e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
      if (/expired|already used/i.test(m)) setDead(m); else { setError(m); setCode(""); }
    } finally { setBusy(false); }
  }

  return (
    <AuthShell>
      <section className="au-card" aria-labelledby="au-title" aria-live="polite">
        {dead ? <>
          <h1 id="au-title">This link no longer works</h1>
          <p className="au-sub">{dead} Reset links work once, for 30 minutes, and stop working as soon as the password is changed.</p>
          <Link href="/login" className="au-primary au-btnlink">Sign in to ask for a new link</Link>
        </> : !info ? <>
          <h1 id="au-title">Checking your link...</h1>
          <div className="au-spin" aria-hidden="true" />
        </> : <>
          <h1 id="au-title">Choose a new password</h1>
          <p className="au-sub">For <b>{info.email}</b> at <b>{info.company}</b>. Anyone signed in with the old password keeps their session until it ends.</p>
          <form onSubmit={submit}>
            <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" meter autoFocus id="rpw" />
            <PasswordInput label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" id="rpw2" />
            {info.needsAuthenticator && <div className="au-field">
              {recovery
                ? <><label htmlFor="rrc">Recovery code</label><input id="rrc" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="xxxxx-xxxxx" /></>
                : <><p className="au-note" style={{ margin: "4px 0 8px" }}>Your account uses an authenticator app. Type the 6-digit code it shows for WHOLESTRA.</p>
                    <OtpBoxes value={code} onChange={setCode} disabled={busy} invalid={!!error} label="Code from your authenticator app" /></>}
              <button type="button" className="au-link" style={{ marginTop: 8 }} onClick={() => { setRecovery(!recovery); setCode(""); }}>{recovery ? "Use the app instead" : "I can't use my authenticator app"}</button>
            </div>}
            {error && <div className="au-err" role="alert">{error}</div>}
            <button className="au-primary" disabled={busy}>{busy ? "Saving..." : "Save and sign in"}</button>
          </form>
        </>}
      </section>
    </AuthShell>
  );
}
