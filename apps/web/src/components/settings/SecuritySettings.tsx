'use client';
import { FormEvent, useEffect, useState } from "react";
import SettingsPage from "./SettingsPage";
import AuthenticatorSetup from "../auth/AuthenticatorSetup";
import OtpBoxes from "../auth/OtpBoxes";
import { api, ApiError } from "../../lib/api";
import { getSessionUser, updateSessionUser } from "../../lib/session";
import { toast } from "../../lib/toast";
import "../auth/auth.css";

type Security = { email: string; emailVerified: boolean; passwordSet: boolean; authenticator: boolean; recoveryCodesLeft: number };

/** Settings → Sign-in and security: how this person signs in, the authenticator app (turn on, turn off, new recovery codes). */
export default function SecuritySettings() {
  const [s, setS] = useState<Security | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"" | "setup" | "off" | "codes">("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string[] | null>(null);
  const [demo, setDemo] = useState(false);
  // changing the sign-in email
  const [emailStep, setEmailStep] = useState<"" | "form" | "code">("");
  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [devCode, setDevCode] = useState("");

  function load() { api.get<Security>("/auth/security").then(setS).catch((e) => setError(e.message)); }
  useEffect(() => { setDemo(!!getSessionUser()?.demo); load(); }, []);

  function emailDone(email: string) {
    updateSessionUser({ email }); setEmailStep(""); setNewEmail(""); setEmailPw(""); setEmailCode(""); setDevCode("");
    toast.success(`Your sign-in email is now ${email}.`); load();
  }
  async function startEmail(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await api.post<{ changed: boolean; email: string; devCode?: string }>("/auth/email-change/start", { email: newEmail.trim(), password: emailPw || undefined });
      if (r.changed) emailDone(r.email); else { setDevCode(r.devCode ?? ""); setEmailStep("code"); }
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not change the email."); }
    finally { setBusy(false); }
  }
  async function verifyEmail(code = emailCode) {
    if (code.length < 6) return;
    setBusy(true); setError("");
    try { const r = await api.post<{ email: string }>("/auth/email-change/verify", { email: newEmail.trim(), code }); emailDone(r.email); }
    catch (e) { setError(e instanceof ApiError ? e.message : "That code did not work."); setEmailCode(""); }
    finally { setBusy(false); }
  }

  async function turnOff(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.post("/auth/totp/disable", { code, password: password || undefined }); updateSessionUser({ authenticator: false }); toast.success("Authenticator app turned off."); setMode(""); setCode(""); setPassword(""); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not turn it off."); setCode(""); }
    finally { setBusy(false); }
  }
  async function newCodes(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const r = await api.post<{ recoveryCodes: string[] }>("/auth/totp/recovery", { code }); setFresh(r.recoveryCodes); setMode(""); setCode(""); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not make new codes."); setCode(""); }
    finally { setBusy(false); }
  }

  return (
    <SettingsPage title="Sign-in and security" intro="How you sign in to WHOLESTRA, and the extra lock on your account.">
      {error && <div className="error">{error}</div>}
      {s && <>
        <article className="panel sec-row">
          <div className="sec-ic" aria-hidden="true">✉</div>
          <div className="sec-body"><h2>Email</h2><p><b>{s.email}</b></p><p className="muted fine">Every sign-in starts with a 6-digit code sent to this address (once email sending is switched on for this site), so it must be an inbox you can open.</p>
            {!demo && emailStep === "" && <div className="st-row"><button className="secondary" onClick={() => { setError(""); setEmailStep("form"); }}>Change email</button></div>}
            {emailStep === "form" && (
              <form className="sec-form" onSubmit={startEmail}>
                <label>New email address<input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" required autoFocus /></label>
                {s.passwordSet && <label>Your password<input type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} autoComplete="current-password" required /></label>}
                <div className="st-row"><button disabled={busy}>{busy ? "Please wait..." : "Continue"}</button><button type="button" className="secondary" onClick={() => setEmailStep("")}>Cancel</button></div>
              </form>
            )}
            {emailStep === "code" && (
              <form className="sec-form auth-embed" onSubmit={(e) => { e.preventDefault(); verifyEmail(); }}>
                <p className="fine">We sent a 6-digit code to <b>{newEmail}</b>. Type it here to confirm the new address.</p>
                {devCode && <p className="au-test">Test mode, no email is sent. The code is <b>{devCode}</b>.</p>}
                <OtpBoxes value={emailCode} onChange={setEmailCode} onComplete={(v) => verifyEmail(v)} disabled={busy} label="Code from your new email" />
                <div className="st-row"><button disabled={busy || emailCode.length < 6}>{busy ? "Checking..." : "Confirm"}</button><button type="button" className="secondary" onClick={() => setEmailStep("form")}>Back</button></div>
              </form>
            )}
          </div>
          <span className={"pill " + (s.emailVerified ? "ok" : "warn")}>{s.emailVerified ? "Confirmed" : "Not confirmed yet"}</span>
        </article>
        <article className="panel sec-row">
          <div className="sec-ic" aria-hidden="true">🔑</div>
          <div className="sec-body"><h2>Password</h2>
            <p className="muted fine">{s.passwordSet ? "Change it from My profile (top right). Forgot it? Use “Forgot password?” on the sign-in page after confirming your email." : "You sign in with Google, Facebook or LinkedIn. To also sign in with your email, sign out, enter your email on the sign-in page, and you will be asked to choose a password."}</p></div>
          <span className={"pill " + (s.passwordSet ? "ok" : "warn")}>{s.passwordSet ? "Set" : "Not set"}</span>
        </article>
        <article className="panel sec-row tall">
          <div className="sec-ic" aria-hidden="true">📱</div>
          <div className="sec-body">
            <h2>Authenticator app</h2>
            <p className="muted fine">A second lock: after your password, WHOLESTRA asks for a 6-digit code from an app on your phone (Google Authenticator, Microsoft Authenticator...). Someone who learns your password still cannot get in.</p>
            {s.authenticator && <p className="fine">Recovery codes left: <b>{s.recoveryCodesLeft}</b>{s.recoveryCodesLeft <= 2 && <span className="warn-text"> · make new ones soon</span>}</p>}

            {fresh && (
              <div className="sec-fresh">
                <p><b>Your new recovery codes.</b> The old ones no longer work. Keep these somewhere safe; you will not see them again.</p>
                <ul className="ta-codes">{fresh.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
                <div className="st-row"><button className="secondary" onClick={() => navigator.clipboard?.writeText(fresh.join("\n"))}>Copy</button><button onClick={() => setFresh(null)}>I have saved them</button></div>
              </div>
            )}

            {demo ? <p className="st-note">This is the demo account, so security settings cannot be changed.</p> : <>
              {mode === "" && !fresh && (
                <div className="st-row">
                  {!s.authenticator && <button onClick={() => { setError(""); setMode("setup"); }}>Turn on</button>}
                  {s.authenticator && <button className="secondary" onClick={() => { setError(""); setMode("codes"); }}>New recovery codes</button>}
                  {s.authenticator && <button className="secondary danger" onClick={() => { setError(""); setMode("off"); }}>Turn off</button>}
                </div>
              )}
              {mode === "setup" && <div className="sec-setup auth-embed"><AuthenticatorSetup onDone={() => { setMode(""); load(); toast.success("Authenticator app is on."); }} onSkip={() => setMode("")} skipLabel="Cancel" /></div>}
              {(mode === "off" || mode === "codes") && (
                <form className="sec-form auth-embed" onSubmit={mode === "off" ? turnOff : newCodes}>
                  <p className="fine">{mode === "off" ? "To turn it off, type the 6-digit code from the app (or, if you lost your phone, one of your recovery codes) and your password." : "Type a code from your authenticator app to make a new set of recovery codes."}</p>
                  {mode === "codes" ? <OtpBoxes value={code} onChange={setCode} label="Code from your authenticator app" autoFocus />
                    : <label>Code from the app, or one recovery code<input value={code} onChange={(e) => setCode(e.target.value.trim())} autoComplete="one-time-code" autoFocus required placeholder="123456 or xxxxx-xxxxx" /></label>}
                  {mode === "off" && s.passwordSet && <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>}
                  <div className="st-row">
                    <button disabled={busy || code.length < 6} className={mode === "off" ? "danger-solid" : ""}>{busy ? "Checking..." : mode === "off" ? "Turn off" : "Make new codes"}</button>
                    <button type="button" className="secondary" onClick={() => { setMode(""); setCode(""); setError(""); }}>Cancel</button>
                  </div>
                </form>
              )}
            </>}
          </div>
          <span className={"pill " + (s.authenticator ? "ok" : "bad")}>{s.authenticator ? "On" : "Off"}</span>
        </article>
      </>}
    </SettingsPage>
  );
}
