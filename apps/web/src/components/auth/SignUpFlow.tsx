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
import { authApi, OAUTH_ERRORS, oauthUrl, SessionResponse } from "../../lib/authApi";
import { ApiError } from "../../lib/api";
import DemoModal from "../landing/DemoModal";
import { LogoMark } from "../Logo";
import "../status/status.css";

const REF_KEY = "wms_ref";

/** Create an account: with Google / Facebook / LinkedIn, or with the form (name, email, phone, password) and a 6-digit code sent to the email.
 *  Either way the next screen is the company profile, then the authenticator app (QR code), then the dashboard. A referral code from a ?ref= link is kept. */
export default function SignUpFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { options, loading: optLoading } = useAuthOptions();
  const [step, setStep] = useState<"form" | "review" | "code">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => params.get("email") ?? "");
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
  const [error, setError] = useState(() => { const e = params.get("error"); return e === "no-account" ? "" : e ? OAUTH_ERRORS[e] ?? "Sign-up did not finish. Please try again." : ""; });

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
    setStep("review");
  }

  // The review screen: everything is shown back before anything is sent. Cancel forgets the details.
  async function approve() { if (await sendCode()) setStep("code"); }
  function cancel() {
    setName(""); setEmail(""); setPhone(""); setPassword(""); setCode(""); setAgree(false);
    router.push("/signup-cancelled");
  }
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";

  async function verify(value = code) {
    if (value.length < 6) return;
    const v = await run(() => authApi.post<{ ticket: string }>("/auth/email/verify", { email, purpose: "signup", code: value }));
    if (!v) { setCode(""); return; }
    const s = await run(() => authApi.post<SessionResponse>("/auth/signup", { ticket: v.ticket, name: name.trim(), password, phone: phone.trim() || undefined, referralCode: refInfo?.valid ? ref.trim().toUpperCase() : undefined }));
    if (s) { try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ } finishSignIn(router, s); }
  }

  const [demoOpen, setDemoOpen] = useState(false);
  // Came here from "Sign in with Google" (or Facebook / LinkedIn) using an account that has not signed up yet
  const noAcct = params.get("error") === "no-account" && !!params.get("email");
  const prov = params.get("provider");
  const noAcctProvider: "google" | "facebook" | "linkedin" = prov === "facebook" || prov === "linkedin" ? prov : "google";
  const providerName = { google: "Google", facebook: "Facebook", linkedin: "LinkedIn" }[noAcctProvider];
  const socialOn = !optLoading && options.providers[noAcctProvider];

  return (
    <AuthShell>
      <section className="au-card" aria-labelledby="au-title">
        {step === "form" && <>
          <h1 id="au-title">Create your account</h1>
          <p className="au-sub">Free to start. Set up your company in a few minutes.</p>
          {noAcct
            ? <div className="au-noacct" role="status">
                <span className="au-noacct-ic" aria-hidden="true">?</span>
                <div>
                  <strong>No account for {params.get("email")}</strong>
                  <p>You chose this {providerName} account to sign in, but it has not been used to sign up for WHOLESTRA yet. Nothing was created. Create your account now: it is free to start.</p>
                  {socialOn
                    ? <a href={oauthUrl(noAcctProvider, "signup", refInfo?.valid ? ref.trim().toUpperCase() : undefined, params.get("email") ?? undefined)} className="au-noacct-go">Create my account with {providerName} →</a>
                    : null}
                  <p className="au-noacct-or">Or fill in the form below to sign up with your email.</p>
                </div>
              </div>
            : params.get("email") && <p className="au-invite">👋 <b>{params.get("email")}</b> is new to WHOLESTRA. Fill in the rest below to create your account.</p>}
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
            <button className="au-primary" disabled={busy}>{busy ? "Please wait..." : "Review and continue"}</button>
          </form>
          <p className="au-safe"><span aria-hidden="true">🔒</span>We confirm your email with a code, and next you can protect your account with an authenticator app by scanning a QR code.</p>
          <div className="au-split">
            <button type="button" className="au-link" onClick={() => setDemoOpen(true)} disabled={busy}>Just looking? Try the demo</button>
            <span>Have an account? <Link href="/login">Sign in</Link></span>
          </div>
        </>}

        {step === "review" && <>
          <div className="su-pair" aria-hidden="true">
            <LogoMark size={56} tone="dark" />
            <span className="su-dots"><i /><i /><i /></span>
            <span className="su-avatar">{initials}</span>
          </div>
          <h1 id="au-title" className="su-h">Create a <b>WHOLESTRA</b> account</h1>
          <p className="su-as">as <b>{name.trim()}</b> with <b>{email.trim()}</b></p>

          <div className="su-box">
            <div className="su-cap">Your details</div>
            <div className="su-row"><span className="su-ic" aria-hidden="true">👤</span><div><strong>{name.trim()}</strong><small>Shown to your team and on the change log.</small></div></div>
            <div className="su-row"><span className="su-ic" aria-hidden="true">✉</span><div><strong>{email.trim()}</strong><small>You sign in with this email, and your sign-in codes are sent here.</small></div></div>
            {phone.trim() && <div className="su-row"><span className="su-ic" aria-hidden="true">☎</span><div><strong>{phone.trim()}</strong><small>Kept on your profile so we can reach you.</small></div></div>}
            {refInfo?.valid && <div className="su-row"><span className="su-ic" aria-hidden="true">🎁</span><div><strong>Invited by {refInfo.company}</strong><small>Your sign-up counts toward their referral.</small></div></div>}
          </div>

          <div className="su-box">
            <div className="su-cap">WHOLESTRA will</div>
            <div className="su-row"><span className="su-ic ok" aria-hidden="true">✓</span><div><strong>Send a 6-digit code to your email</strong><small>To confirm the address is yours. The code works for 10 minutes.</small></div></div>
            <div className="su-row"><span className="su-ic ok" aria-hidden="true">✓</span><div><strong>Create your company workspace</strong><small>You become its owner, with full access. Its data is kept separate from every other company.</small></div></div>
            <div className="su-row"><span className="su-ic ok" aria-hidden="true">✓</span><div><strong>Record sign-ins and changes</strong><small>Each action is saved with who did it and when, in a change log nobody can edit.</small></div></div>
          </div>

          <div className="su-box">
            <div className="su-cap">WHOLESTRA will not</div>
            <div className="su-row"><span className="su-ic no" aria-hidden="true">✕</span><div><strong>Sell your personal data</strong><small>Your company&apos;s records are never used for advertising.</small></div></div>
            <div className="su-row"><span className="su-ic no" aria-hidden="true">✕</span><div><strong>Ask for your email password</strong><small>We only check that you can receive our code.</small></div></div>
          </div>

          {error && <div className="au-err" role="alert">{error}</div>}
          <div className="su-btns">
            <button type="button" className="su-cancel" onClick={cancel} disabled={busy}>Cancel</button>
            <button type="button" className="au-primary" onClick={approve} disabled={busy}>{busy ? "Sending code..." : "Continue"}</button>
          </div>
          <p className="su-fine">Not you, or something wrong? <button type="button" className="au-link" onClick={() => { setStep("form"); setError(""); }}>Edit your details</button><br />
            By continuing you agree to the <Link href="/terms" target="_blank">terms of use</Link> and <Link href="/privacy" target="_blank">privacy notice</Link>.</p>
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
          <div className="au-actions"><button type="button" className="au-link" disabled={busy || cooldown > 0} onClick={sendCode}>{cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}</button>
            <button type="button" className="au-link" disabled={busy} onClick={cancel}>Cancel sign-up</button></div>
        </>}
      </section>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </AuthShell>
  );
}
