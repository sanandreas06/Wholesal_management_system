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
import { IDLE_MINUTES } from "../../lib/idle";
import { emailProblem } from "../../lib/emailCheck";

type Step = "email" | "code" | "mfa" | "password" | "reset" | "forgot" | "forgot-app" | "sent";
type Verified = { ticket?: string; hasPassword?: boolean; authenticator?: boolean; needsAuthenticator?: boolean; mfa?: string; company?: string; device?: string };

/** Sends a freshly signed-in person to the right place: company set-up for a brand-new company, otherwise where they were going. */
export function finishSignIn(router: ReturnType<typeof useRouter>, s: SessionResponse & { device?: string }, next?: string | null) {
  saveSession(s.accessToken, s.user);
  if (s.device) saveTrust(s.user.email, s.device);
  try { sessionStorage.removeItem("wms_profile"); } catch { /* ignore */ }
  if (s.user.setupPending && !s.user.demo) router.replace("/setup");
  // staff whose only role is selling start at the counter; store staff start at Scan
  else router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : s.user.roles?.length === 1 && s.user.roles[0] === "SALES_USER" ? "/counter" : s.user.roles?.length === 1 && s.user.roles[0] === "INVENTORY_USER" ? "/scan" : "/dashboard");
}

/** "/purchase-orders?x=1" -> "Purchase orders". */
function pageName(path: string) {
  const seg = path.split(/[?#]/)[0].replace(/^\/w\/[^/]+/i, "").split("/").filter(Boolean)[0] ?? "dashboard";
  const known: Record<string, string> = { dashboard: "your dashboard", audit: "Audit & fraud signals", imports: "Excel import", insights: "Investment insights" };
  if (known[seg]) return known[seg];
  const w = seg.replace(/-/g, " ");
  return w ? w[0].toUpperCase() + w.slice(1) : "";
}

/** The sign-in screen, one step at a time:
 *  1. email only;  2. a 6-digit code sent to that email (or a code from the authenticator app);
 *  3. the password, with the email now locked and marked Confirmed.
 *  An account protected by an authenticator app also needs a code from it.
 *  "Forgot password" never changes the password on the spot: it emails a one-time reset link, or (for accounts with an authenticator app) lets the person sign in with the app instead. */
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
  const [suggest, setSuggest] = useState("");
  const [warned, setWarned] = useState("");
  const [missing, setMissing] = useState("");
  // Someone who opened a page from a link (or whose session ended) is told why they are here and where they will land.
  const nextPath = params.get("next") ?? "";
  const nextName = /^\/[a-z]/.test(nextPath) ? pageName(nextPath) : "";
  const back = nextName ? ` to go back to ${nextName}` : "";
  const gate = params.get("why") === "idle" ? { icon: "⏱", text: `You were signed out after ${IDLE_MINUTES} minutes without activity, to keep your company's data safe. Sign in again${back}.` }
    : params.get("why") === "elsewhere" ? { icon: "🔒", text: `You signed out in another tab or window. Sign in again${back}.` }
    : params.get("expired") ? { icon: "⏱", text: `Your session ended, so you were signed out to keep your account safe. Sign in again${back}.` }
    : nextName ? { icon: "🔒", text: `Sign in to open ${nextName}. If someone sent you this link, you will only see it if your account is allowed to.` } : null;
  const codesOn = options.emailCodes;

  useEffect(() => { if (!busy) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [busy]);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true); setError(""); setMissing("");
    try { return await fn(); }
    catch (e) {
      // an email with no account: offer to create one instead of a plain error
      if (e instanceof ApiError && e.status === 404 && step === "email") { setMissing(email.trim()); return undefined; }
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again."); return undefined; }
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
    const bad = emailProblem(email);
    if (bad && !(bad.soft && warned === email.trim().toLowerCase())) { setMissing(""); setError(bad.message); setSuggest(bad.suggestion ?? ""); setWarned(email.trim().toLowerCase()); return; }
    setSuggest("");
    if (codesOn) { await sendCode(); return; }
    // The page may not know yet whether codes are on (a sleeping server, or the options call failed),
    // so ask the server: it says plainly when the email has no account, and whether a code is needed first.
    const r = await run(() => authApi.post<{ ok: boolean; codes?: boolean }>("/auth/email/check", { email }));
    if (!r) return;
    if (r.codes) await sendCode();
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
      setHasApp(!!r.authenticator);
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
    let needCode = false;
    const r = await run(async () => {
      try { return await authApi.post<SessionResponse | Verified>("/auth/login", ticket ? { ticket, password, device: getTrust(email) } : { email, password, device: getTrust(email) }); }
      catch (err) {
        // the server wants the email confirmed first: send the code instead of showing an error
        if (!ticket && err instanceof ApiError && err.status === 400 && /code we send you/i.test(err.message)) { needCode = true; return undefined; }
        throw err;
      }
    });
    if (needCode) { setPassword(""); await sendCode(); return; }
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
  const [hasApp, setHasApp] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [devLink, setDevLink] = useState("");

  // Forgot password, way 1: a one-time link by email (30 minutes)
  async function sendResetLink() {
    const r = await run(() => authApi.post<{ sentTo: string; devLink?: string }>("/auth/password/forgot", { ticket }));
    if (r) { setSentTo(r.sentTo); setDevLink(r.devLink ?? ""); setCooldown(60); setStep("sent"); }
  }
  // Forgot password, way 2: the email code already given, plus a code from the authenticator app
  async function signInWithApp(value = code) {
    if (!recovery && value.length < 6) return;
    const r = await run(() => authApi.post<SessionResponse & { device?: string }>("/auth/password/authenticator", { ticket, code: value }));
    if (r) finishSignIn(router, r, params.get("next")); else setCode("");
  }

  const lockedEmail = (
    <div className="au-locked" aria-label={`Email ${email}${confirmed ? ", confirmed" : ""}`}>
      <span className="au-locked-mail" title={email}>{email}</span>
      {confirmed ? <span className="au-ok"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor" /><path d="M5.5 10.2l3 3 6-6.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>Confirmed</span> : null}
      <button type="button" className="au-link" onClick={restart}>Change</button>
    </div>
  );

  const stepNo = step === "email" ? 1 : step === "code" || step === "mfa" ? 2 : 3;

  // One clear way back from every step. Steps inside "forgot password" go back one step;
  // code, authenticator and password steps go back to the email (the sign-in starts again cleanly).
  function goBack() {
    setError(""); setCode("");
    if (step === "forgot-app") { setRecovery(false); setStep("forgot"); return; }
    if (step === "forgot" || step === "sent" || (step === "reset" && !firstPassword)) { setStep("password"); return; }
    restart();
  }
  const backLabel = step === "forgot-app" ? "Back" : step === "forgot" || step === "sent" || (step === "reset" && !firstPassword) ? "Back to password" : "Back to email";

  return (
    <AuthShell>
      <section className="au-card" aria-labelledby="au-title">
        {step !== "email" && <button type="button" className="au-back" onClick={goBack} disabled={busy}><span aria-hidden="true">←</span> {backLabel}</button>}
        {codesOn && <ol className="au-progress" aria-label={`Step ${stepNo} of 3`}>{["Email", "Code", "Password"].map((s, i) => <li key={s} className={i + 1 < stepNo ? "done" : i + 1 === stepNo ? "now" : ""}><i>{i + 1 < stepNo ? "✓" : i + 1}</i>{s}</li>)}</ol>}

        {company && step !== "email" && <div className="au-company" role="status"><span aria-hidden="true">🏢</span><span>Signing in to <b>{company}</b></span></div>}

        {step === "email" && <>
          <h1 id="au-title">Sign in</h1>
          <p className="au-sub">to your WHOLESTRA account</p>
          {gate && <div className="au-gate" role="status"><span aria-hidden="true">{gate.icon}</span><span>{gate.text}</span></div>}
          <form onSubmit={submitEmail} noValidate={false}>
            <div className="au-field">
              <label htmlFor="em">Email address</label>
              <input id="em" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setMissing(""); setSuggest(""); }} autoComplete="username" required autoFocus placeholder="you@company.com" />
            </div>
            {error && <div className="au-err" role="alert">{error}{suggest && <> <button type="button" className="au-fix" onClick={() => { setEmail(suggest); setSuggest(""); setError(""); }}>Use {suggest}</button></>}</div>}
            {missing && <div className="au-noacct" role="alert">
              <span className="au-noacct-ic" aria-hidden="true">?</span>
              <div>
                <strong>No account for {missing}</strong>
                <p>This email has not been used to sign up for WHOLESTRA yet. Check the spelling, or create your account. It is free to start.</p>
                <Link href={`/get-started?email=${encodeURIComponent(missing)}`} className="au-noacct-go">Create an account →</Link>
              </div>
            </div>}
            {slow && <p className="au-note" role="status">The server is waking up after being idle. This can take up to a minute the first time.</p>}
            <button className="au-primary" disabled={busy}>{busy ? "Please wait..." : "Next"}</button>
            <button type="button" className="au-totp" disabled={busy} onClick={() => {
              const bad = emailProblem(email);
              if (bad && !(bad.soft && warned === email.trim().toLowerCase())) { setError(bad.message); setSuggest(bad.suggestion ?? ""); setWarned(email.trim().toLowerCase()); return; }
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
              ? <button type="button" className="au-link" onClick={() => { setPassword(""); setError(""); setStep("forgot"); }}>Forgot password?</button>
              : <span className="au-note">Forgot your password? Ask your owner or administrator to set a new one for you in Users.</span>}
          </div>
        </>}

        {step === "reset" && <>
          <h1 id="au-title">{firstPassword ? "Choose a password" : "Choose a new password"}</h1>
          {lockedEmail}
          <p className="au-sub">{firstPassword ? "You signed up with Google, Facebook or LinkedIn. Choose a password so you can also sign in with your email." : "Choose a new password. Anyone signed in with the old one keeps their session until it ends."}</p>
          <form onSubmit={submitReset}>
            <input type="email" value={email} readOnly autoComplete="username" hidden />
            <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" meter autoFocus id="npw" />
            <PasswordInput label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" id="npw2" />
            {error && <div className="au-err" role="alert">{error}</div>}
            <button className="au-primary" disabled={busy}>{busy ? "Saving..." : "Save and sign in"}</button>
          </form>
          {!firstPassword && <div className="au-actions"><button type="button" className="au-link" onClick={() => { setError(""); setStep("password"); }}>Back to password</button></div>}
        </>}

        {step === "forgot" && <>
          <h1 id="au-title">Forgot your password?</h1>
          {lockedEmail}
          <p className="au-sub">To keep your account safe, a password cannot be changed straight from here. Choose one of these:</p>
          <div className="au-ways">
            <button type="button" className="au-way" disabled={busy} onClick={sendResetLink}>
              <span className="au-way-ic" aria-hidden="true">✉</span>
              <span><b>Email me a reset link</b><small>We send a link to your inbox. It works once, for 30 minutes.{hasApp ? " You will also need your authenticator app." : ""}</small></span>
            </button>
            {hasApp && <button type="button" className="au-way" disabled={busy} onClick={() => { setCode(""); setRecovery(false); setError(""); setStep("forgot-app"); }}>
              <span className="au-way-ic" aria-hidden="true">⏱</span>
              <span><b>Sign in with your authenticator app</b><small>Use the 6-digit code from Google Authenticator (or a recovery code) instead of your password.</small></span>
            </button>}
          </div>
          {!hasApp && <p className="au-note">Tip: once you are in, turn on an authenticator app in Sign-in &amp; security. Then you can sign in with it if you forget your password again.</p>}
          {error && <div className="au-err" role="alert">{error}</div>}
          <div className="au-actions"><button type="button" className="au-link" onClick={() => { setError(""); setStep("password"); }}>Back to password</button></div>
        </>}

        {step === "forgot-app" && <>
          <h1 id="au-title">Sign in with your authenticator app</h1>
          {lockedEmail}
          <p className="au-sub">{recovery ? "Type one of the recovery codes you saved when you set up the app. Each one works once." : "Type the 6-digit code your authenticator app shows for WHOLESTRA. Together with the email code, it proves it is you."}</p>
          <form onSubmit={(e) => { e.preventDefault(); signInWithApp(); }}>
            {recovery
              ? <div className="au-field"><label htmlFor="frc">Recovery code</label><input id="frc" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoFocus placeholder="xxxxx-xxxxx" required /></div>
              : <OtpBoxes value={code} onChange={setCode} onComplete={(v) => signInWithApp(v)} disabled={busy} invalid={!!error} label="Code from your authenticator app" />}
            {error && <div className="au-err" role="alert">{error}</div>}
            <button className="au-primary" disabled={busy || (!recovery && code.length < 6) || (recovery && !code.trim())}>{busy ? "Checking..." : "Sign in"}</button>
          </form>
          <div className="au-actions">
            <button type="button" className="au-link" onClick={() => { setRecovery(!recovery); setCode(""); setError(""); }}>{recovery ? "Use the app instead" : "Use a recovery code"}</button>
            <button type="button" className="au-link" onClick={() => { setError(""); setStep("forgot"); }}>Back</button>
          </div>
        </>}

        {step === "sent" && <>
          <h1 id="au-title">Check your email</h1>
          <p className="au-sub">We sent a reset link to <b>{sentTo}</b>. Open it on any device to choose a new password. It works once, for 30 minutes.{hasApp ? " Keep your authenticator app close: the link will ask for a code from it." : ""}</p>
          {devLink && <p className="au-test" role="status">Test mode, no email is sent. <a href={devLink}>Open the reset link</a></p>}
          <p className="au-note">Not there? Check your spam folder. The link only works for the address above.</p>
          {error && <div className="au-err" role="alert">{error}</div>}
          <div className="au-actions">
            <button type="button" className="au-link" disabled={busy || cooldown > 0} onClick={sendResetLink}>{cooldown > 0 ? `Send again in ${cooldown}s` : "Send the link again"}</button>
            <button type="button" className="au-link" onClick={() => { setError(""); setStep("password"); }}>Back to sign in</button>
          </div>
        </>}
      </section>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </AuthShell>
  );
}
