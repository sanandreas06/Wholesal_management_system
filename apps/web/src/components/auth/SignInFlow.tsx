'use client';
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "./AuthShell";
import OtpBoxes from "./OtpBoxes";
import PasswordInput, { passwordProblem } from "./PasswordInput";
import SocialButtons from "./SocialButtons";
import { useAuthOptions } from "./useAuthOptions";
import { authApi, OAUTH_ERRORS, SessionResponse } from "../../lib/authApi";
import { getTrust, saveSession, saveTrust } from "../../lib/session";
import DemoModal from "../landing/DemoModal";
import { ApiError } from "../../lib/api";

type Step = "email" | "code" | "mfa" | "password" | "reset";
type Verified = { ticket?: string; hasPassword?: boolean; needsAuthenticator?: boolean; mfa?: string; company?: string; device?: string };

/** Sends a freshly signed-in person to the right place: company set-up for a brand-new company, otherwise where they were going. */
export function finishSignIn(router: ReturnType<typeof useRouter>, s: SessionResponse & { device?: string }, next?: string | null) {
  saveSession(s.accessToken, s.user);
  if (s.device) saveTrust(s.user.email, s.device);
  try { sessionStorage.removeItem("wms_profile"); } catch { /* ignore */ }
  if (s.user.setupPending && !s.user.demo) router.replace("/setup");
  else router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

/** The sign-in screen, one step at a time:
 *  1. email only;  2. a 6-digit code sent to that email (or a code from the authenticator app);
 *  3. the password, with the email now locked and marked Confirmed.
 *  An account protected by an authenticator app also needs a code from it. "Forgot password" after step 2 simply lets the person choose a new one, because the email is already proven. */
export default function SignInFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { options, loading: optLoading, offline } = useAuthOptions();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<"email" | "sms" | "authenticator">("email");
  const [recovery, setRecovery] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [mfa, setMfa] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstPassword, setFirstPassword] = useState(false);
  const [error, setError] = useState(() => { const e = params.get("error"); return e ? OAUTH_ERRORS[e] ?? "Sign-in did not finish. Please try again." : ""; });
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const confirmed = !!ticket;
  const codesOn = options.emailCodes;

  useEffect(() => { if (!busy) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [busy]);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true); setError("");
    try { return await fn(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again."); return undefined; }
    finally { setBusy(false); }
  }

  function restart() { setCompany(""); setStep("email"); setCode(""); setTicket(""); setMfa(""); setPassword(""); setConfirm(""); setDevCode(""); setMethod("email"); setRecovery(false); setError(""); }

  /** Sends the sign-in code by email, or by text message to the number saved on the account. */
  async function sendCode(again = false, channel: "email" | "sms" = "email") {
    const r = await run(() => authApi.post<{ devCode?: string }>("/auth/email/start", { email, purpose: "signin", ...(channel === "sms" ? { channel } : {}) }));
    if (!r) return;
    setDevCode(r.devCode ?? ""); setCode(""); setCooldown(30);
    if (!again) { setMethod(channel); setStep("code"); }
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (codesOn) await sendCode();
    else { setError(""); setStep("password"); }
  }

  function afterVerified(r: Verified | (SessionResponse & { device?: string })) {
    setCode("");
    if ("company" in r && r.company) setCompany(r.company);
    if (r.device) saveTrust(email, r.device);
    if ("accessToken" in r) { finishSignIn(router, r, params.get("next")); return; }
    if (r.needsAuthenticator && r.mfa) { setMfa(r.mfa); setRecovery(false); setStep("mfa"); return; }
    if (r.ticket) {
      setTicket(r.ticket);
      if (r.hasPassword === false) { setFirstPassword(true); setStep("reset"); } else { setFirstPassword(false); setStep("password"); }
    }
  }

  async function verifyCode(value = code) {
    if (value.replace(/\s/g, "").length < 6) return;
    const r = await run(() => authApi.post<Verified>("/auth/email/verify", { email, purpose: "signin", method: method === "authenticator" ? "authenticator" : "email", code: value, device: getTrust(email) }));
    if (r) afterVerified(r); else setCode("");
  }

  async function verifyMfa(value = code) {
    if (!recovery && value.length < 6) return;
    const r = await run(() => authApi.post<Verified | SessionResponse>("/auth/authenticator", { mfa, code: value }));
    if (r) afterVerified(r); else setCode("");
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => authApi.post<SessionResponse | Verified>("/auth/login", ticket ? { ticket, password, device: getTrust(email) } : { email, password, device: getTrust(email) }));
    if (r) afterVerified(r);
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    const p = passwordProblem(password);
    if (p) { setError(p); return; }
    if (password !== confirm) { setError("The two passwords are not the same."); return; }
    const r = await run(() => authApi.post<SessionResponse>("/auth/password/reset", { ticket, password }));
    if (r) finishSignIn(router, r, params.get("next"));
  }

  const [demoOpen, setDemoOpen] = useState(false);
  const [company, setCompany] = useState("");

  const lockedEmail = (
    <div className="au-locked" aria-label={`Email ${email}${confirmed ? ", confirmed" : ""}`}>
      <span className="au-locked-mail" title={email}>{email}</span>
      {confirmed ? <span className="au-ok"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor" /><path d="M5.5 10.2l3 3 6-6.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>Confirmed</span> : null}
      <button type="button" className="au-link" onClick={restart}>Change</button>
    </div>
  );

  const stepNo = step === "email" ? 1 : step === "code" || step === "mfa" ? 2 : 3;

  return (
    <AuthShell>
      <section className="au-card" aria-labelledby="au-title">
        {codesOn && <ol className="au-progress" aria-label={`Step ${stepNo} of 3`}>{["Email", "Code", "Password"].map((s, i) => <li key={s} className={i + 1 < stepNo ? "done" : i + 1 === stepNo ? "now" : ""}><i>{i + 1 < stepNo ? "✓" : i + 1}</i>{s}</li>)}</ol>}

        {company && step !== "email" && <div className="au-company" role="status"><span aria-hidden="true">🏢</span><span>Signing in to <b>{company}</b></span></div>}

        {step === "email" && <>
          <h1 id="au-title">Sign in</h1>
          <p className="au-sub">to your WHOLESTRA account</p>
          <form onSubmit={submitEmail} noValidate={false}>
            <div className="au-field">
              <label htmlFor="em">Email address</label>
              <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus placeholder="you@company.com" />
            </div>
            {error && <div className="au-err" role="alert">{error}</div>}
            {slow && <p className="au-note" role="status">The server is waking up after being idle. This can take up to a minute the first time.</p>}
            <button className="au-primary" disabled={busy}>{busy ? "Please wait..." : "Next"}</button>
            <button type="button" className="au-totp" disabled={busy} onClick={() => {
              if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Type your email address first."); return; }
              setError(""); setCode(""); setMethod("authenticator"); setStep("code");
            }}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Sign in with Google Authenticator
            </button>
            {codesOn && options.smsCodes && <button type="button" className="au-totp" disabled={busy} onClick={() => {
              if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Type your email address first."); return; }
              void sendCode(false, "sms");
            }}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Get the code by text message
            </button>}
          </form>
          <div className="au-or"><span>or sign in with</span></div>
          <SocialButtons options={options} mode="signin" loading={optLoading} />
          <button type="button" className="au-demo" onClick={() => setDemoOpen(true)} disabled={busy}>
            <span className="au-demo-ic" aria-hidden="true">▶</span><span><b>Try the demo account</b><small>Look around a sample company. Read-only.</small></span>
          </button>
          <p className="au-alt">New to WHOLESTRA? <Link href="/get-started">Create an account</Link></p>
          {offline && <p className="au-note">We could not reach the server just now. You can still try to sign in.</p>}
          <p className="au-note au-center">Having trouble signing in? <Link href="/status">Check the system status</Link>.</p>
        </>}

        {step === "code" && <>
          <h1 id="au-title">{method === "email" ? "Check your email" : method === "sms" ? "Check your phone" : "Authenticator code"}</h1>
          {lockedEmail}
          <p className="au-sub">{method === "email" ? <>We sent a 6-digit code to your email. It works for 10 minutes. Check your spam folder if it is not there.</>
            : method === "sms" ? <>If your account has a mobile number saved, we have texted a 6-digit code to it. It works for 10 minutes. No text? Use the code from your email instead.</>
            : <>Open your authenticator app (Google Authenticator, Microsoft Authenticator...) and type the 6-digit code for WHOLESTRA.</>}</p>
          {devCode && method !== "authenticator" && <p className="au-test" role="status">Test mode, nothing is sent. Your code is <b>{devCode}</b>.</p>}
          <form onSubmit={(e) => { e.preventDefault(); verifyCode(); }}>
            <OtpBoxes value={code} onChange={setCode} onComplete={(v) => verifyCode(v)} disabled={busy} invalid={!!error} label={method === "email" ? "Code from your email" : method === "sms" ? "Code from the text message" : "Code from your authenticator app"} />
            {error && <div className="au-err" role="alert">{error}</div>}
            <button className="au-primary" disabled={busy || code.length < 6}>{busy ? "Checking..." : "Verify"}</button>
          </form>
          <div className="au-actions">
            {method === "email" || method === "sms"
              ? <><button type="button" className="au-link" disabled={busy || cooldown > 0} onClick={() => sendCode(true, method)}>{cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}</button>
                  {method === "email" && options.smsCodes && <button type="button" className="au-link" disabled={busy} onClick={() => sendCode(false, "sms")}>Text the code to my phone instead</button>}
                  {method === "sms" && <button type="button" className="au-link" disabled={busy} onClick={() => sendCode(false, "email")}>Email me the code instead</button>}
                  <button type="button" className="au-link" onClick={() => { setMethod("authenticator"); setCode(""); setError(""); }}>Use my authenticator app instead</button></>
              : codesOn ? <button type="button" className="au-link" onClick={() => { setMethod("email"); setCode(""); setError(""); }}>Use the code from my email instead</button>
              : <button type="button" className="au-link" onClick={() => { setCode(""); setError(""); setStep("password"); }}>I don&apos;t use an authenticator app</button>}
          </div>
        </>}

        {step === "mfa" && <>
          <h1 id="au-title">One more check</h1>
          {lockedEmail}
          <p className="au-sub">{recovery ? "Type one of the recovery codes you saved when you set up the authenticator app. Each one works once." : "This account is protected by an authenticator app. Type the 6-digit code it shows for WHOLESTRA."}</p>
          <form onSubmit={(e) => { e.preventDefault(); verifyMfa(); }}>
            {recovery
              ? <div className="au-field"><label htmlFor="rc">Recovery code</label><input id="rc" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoFocus placeholder="xxxxx-xxxxx" required /></div>
              : <OtpBoxes value={code} onChange={setCode} onComplete={(v) => verifyMfa(v)} disabled={busy} invalid={!!error} label="Code from your authenticator app" />}
            {error && <div className="au-err" role="alert">{error}</div>}
            <button className="au-primary" disabled={busy || (!recovery && code.length < 6) || (recovery && !code.trim())}>{busy ? "Checking..." : "Verify"}</button>
          </form>
          <div className="au-actions"><button type="button" className="au-link" onClick={() => { setRecovery(!recovery); setCode(""); setError(""); }}>{recovery ? "Use the authenticator app instead" : "I can't use my authenticator app"}</button></div>
        </>}

        {step === "password" && <>
          <h1 id="au-title">Enter your password</h1>
          {lockedEmail}
          <form onSubmit={submitPassword}>
            <input type="email" value={email} readOnly autoComplete="username" hidden />
            <PasswordInput value={password} onChange={setPassword} autoFocus />
            {error && <div className="au-err" role="alert">{error}</div>}
            {slow && <p className="au-note" role="status">The server is waking up after being idle. This can take up to a minute the first time.</p>}
            <button className="au-primary" disabled={busy || !password}>{busy ? "Signing in..." : "Sign in"}</button>
          </form>
          <div className="au-actions">
            {confirmed
              ? <button type="button" className="au-link" onClick={() => { setFirstPassword(false); setPassword(""); setConfirm(""); setError(""); setStep("reset"); }}>Forgot password?</button>
              : <span className="au-note">Forgot your password? Ask your owner or administrator to set a new one for you in Users.</span>}
          </div>
        </>}

        {step === "reset" && <>
          <h1 id="au-title">{firstPassword ? "Choose a password" : "Choose a new password"}</h1>
          {lockedEmail}
          <p className="au-sub">{firstPassword ? "You signed up with Google, Facebook or LinkedIn. Choose a password so you can also sign in with your email." : "Your email is confirmed, so you can set a new password now. Anyone signed in with the old one keeps their session until it ends."}</p>
          <form onSubmit={submitReset}>
            <input type="email" value={email} readOnly autoComplete="username" hidden />
            <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" meter autoFocus id="npw" />
            <PasswordInput label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" id="npw2" />
            {error && <div className="au-err" role="alert">{error}</div>}
            <button className="au-primary" disabled={busy}>{busy ? "Saving..." : "Save and sign in"}</button>
          </form>
          {!firstPassword && <div className="au-actions"><button type="button" className="au-link" onClick={() => { setError(""); setStep("password"); }}>Back to password</button></div>}
        </>}
      </section>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </AuthShell>
  );
}
