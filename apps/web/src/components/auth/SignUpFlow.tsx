'use client';
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "./AuthShell";
import OtpBoxes from "./OtpBoxes";
import PasswordInput, { passwordProblem } from "./PasswordInput";
import SocialButtons from "./SocialButtons";
import { useAuthOptions } from "./useAuthOptions";
import { finishSignIn } from "./SignInFlow";
import { authApi, OAUTH_ERRORS, SessionResponse } from "../../lib/authApi";
import { ApiError } from "../../lib/api";

const REF_KEY = "wms_ref";

/** Create an account: with Google / Facebook / LinkedIn, or with the form (name, email, phone, password) and a 6-digit code sent to the email.
 *  Either way the next screen is the company profile, then the authenticator app (QR code), then the dashboard. A referral code from a ?ref= link is kept. */
export default function SignUpFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { options, loading: optLoading } = useAuthOptions();
  const [step, setStep] = useState<"form" | "code">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [ref, setRef] = useState("");
  const [refInfo, setRefInfo] = useState<{ valid: boolean; company?: string } | null>(null);
  const [showRef, setShowRef] = useState(false);
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState(() => { const e = params.get("error"); return e ? OAUTH_ERRORS[e] ?? "Sign-up did not finish. Please try again." : ""; });

  // a referral code from the link (or from an earlier visit in this browser)
  useEffect(() => {
    let r = (params.get("ref") ?? "").trim().toUpperCase();
    try { if (r) localStorage.setItem(REF_KEY, r); else r = localStorage.getItem(REF_KEY) ?? ""; } catch { /* storage unavailable */ }
    if (r) { setRef(r); setShowRef(true); }
  }, [params]);
  useEffect(() => {
    const c = ref.trim().toUpperCase();
    if (c.length < 4) { setRefInfo(null); return; }
    const t = setTimeout(() => { authApi.get<{ valid: boolean; company?: string }>(`/referrals/check?code=${encodeURIComponent(c)}`).then(setRefInfo).catch(() => setRefInfo(null)); }, 350);
    return () => clearTimeout(t);
  }, [ref]);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  const emailOffText = `Sign-up with email is not switched on for this site yet. ${options.social ? "Use one of the buttons above, " : "You can "}try the demo, or contact us.`;

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true); setError("");
    try { return await fn(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again."); return undefined; }
    finally { setBusy(false); }
  }

  async function sendCode() {
    const r = await run(() => authApi.post<{ devCode?: string }>("/auth/email/start", { email, purpose: "signup" }));
    if (!r) return false;
    setDevCode(r.devCode ?? ""); setCode(""); setCooldown(30);
    return true;
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setError("Please type your full name."); return; }
    const p = passwordProblem(password);
    if (p) { setError(p); return; }
    if (!agree) { setError("Please agree to the terms of use and privacy notice."); return; }
    if (!options.emailSignup) { setError(emailOffText); return; }
    if (await sendCode()) setStep("code");
  }

  async function verify(value = code) {
    if (value.length < 6) return;
    const v = await run(() => authApi.post<{ ticket: string }>("/auth/email/verify", { email, purpose: "signup", code: value }));
    if (!v) { setCode(""); return; }
    const s = await run(() => authApi.post<SessionResponse>("/auth/signup", { ticket: v.ticket, name: name.trim(), password, phone: phone.trim() || undefined, referralCode: refInfo?.valid ? ref.trim().toUpperCase() : undefined }));
    if (s) { try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ } finishSignIn(router, s); }
  }

  async function demo() {
    const r = await run(() => authApi.post<SessionResponse>("/auth/demo"));
    if (r) finishSignIn(router, r, "/dashboard");
  }

  return (
    <AuthShell>
      <section className="au-card" aria-labelledby="au-title">
        {step === "form" && <>
          <h1 id="au-title">Create your account</h1>
          <p className="au-sub">Free to start. Set up your company in a few minutes.</p>
          {!optLoading && !options.emailSignup && <p className="au-test" role="status">{emailOffText}</p>}
          {refInfo?.valid && <p className="au-invite">🎁 Invited by <b>{refInfo.company}</b></p>}
          <SocialButtons options={options} mode="signup" referral={refInfo?.valid ? ref.trim().toUpperCase() : undefined} loading={optLoading} />
          <div className="au-or"><span>or sign up with your email</span></div>
          <form onSubmit={submitForm}>
            <div className="au-field"><label htmlFor="nm">Full name</label><input id="nm" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} /></div>
            <div className="au-field"><label htmlFor="em">Work email</label><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={160} placeholder="you@company.com" /></div>
            <div className="au-field"><label htmlFor="ph">Phone number <em>(optional)</em></label><input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={40} placeholder="+233 ..." /></div>
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" meter id="spw" />
            {showRef
              ? <div className="au-field"><label htmlFor="rf">Referral code <em>(optional)</em></label><input id="rf" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} maxLength={20} autoComplete="off" />
                  {refInfo && <small className={refInfo.valid ? "au-good" : "au-warn"}>{refInfo.valid ? `✓ Referred by ${refInfo.company}` : "We don't recognise this code. You can still sign up without it."}</small>}</div>
              : <button type="button" className="au-link au-left" onClick={() => setShowRef(true)}>Have a referral code?</button>}
            <label className="au-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I agree to the <Link href="/terms" target="_blank">terms of use</Link> and <Link href="/privacy" target="_blank">privacy notice</Link>.</span></label>
            {error && <div className="au-err" role="alert">{error}</div>}
            <button className="au-primary" disabled={busy}>{busy ? "Please wait..." : "Create my account"}</button>
          </form>
          <p className="au-safe"><span aria-hidden="true">🔒</span>We confirm your email with a code, and next you can protect your account with an authenticator app by scanning a QR code.</p>
          <div className="au-split">
            <button type="button" className="au-link" onClick={demo} disabled={busy}>Just looking? Try the demo</button>
            <span>Have an account? <Link href="/login">Sign in</Link></span>
          </div>
        </>}

        {step === "code" && <>
          <h1 id="au-title">Confirm your email</h1>
          <div className="au-locked"><span className="au-locked-mail">{email}</span><button type="button" className="au-link" onClick={() => { setStep("form"); setError(""); }}>Change</button></div>
          <p className="au-sub">We sent a 6-digit code to this address. It works for 10 minutes. Check your spam folder if it is not there.</p>
          {devCode && <p className="au-test" role="status">Test mode, no email is sent. Your code is <b>{devCode}</b>.</p>}
          <form onSubmit={(e) => { e.preventDefault(); verify(); }}>
            <OtpBoxes value={code} onChange={setCode} onComplete={(v) => verify(v)} disabled={busy} invalid={!!error} label="Code from your email" />
            {error && <div className="au-err" role="alert">{error}</div>}
            <button className="au-primary" disabled={busy || code.length < 6}>{busy ? "Creating your account..." : "Verify and continue"}</button>
          </form>
          <div className="au-actions"><button type="button" className="au-link" disabled={busy || cooldown > 0} onClick={sendCode}>{cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}</button></div>
        </>}
      </section>
    </AuthShell>
  );
}
