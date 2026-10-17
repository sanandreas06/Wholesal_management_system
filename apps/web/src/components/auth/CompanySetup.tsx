'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "./AuthShell";
import AuthenticatorSetup from "./AuthenticatorSetup";
import OrgProfileForm, { OrgProfile, profileFrom } from "../OrgProfileForm";
import { api, ApiError } from "../../lib/api";
import { getSessionUser, SessionUser, updateSessionUser } from "../../lib/session";

const FEATURES = [
  "Stock for every branch, with pictures and low-stock alerts",
  "Sales, invoices, payments and money owed",
  "Purchase orders and goods received from suppliers",
  "Transfers between branches, tracked until they arrive",
  "Expenses with approval limits",
  "Excel import of weekly sales",
  "Roles: each person sees only their branch and their work",
  "A change log nobody can quietly rewrite",
];

function Features() {
  return (
    <div className="kf">
      <p className="au-eyebrow">What you get</p>
      <h2>Key features</h2>
      <ul>{FEATURES.map((f) => <li key={f}><span aria-hidden="true">✓</span>{f}</li>)}</ul>
      <div className="kf-safe"><b>🔒 Your data stays yours</b><span>Each company only ever sees its own records. Sign-ins are confirmed by email, and you can add an authenticator app.</span></div>
    </div>
  );
}

/** After sign-up: 1. the company profile; 2. protect the account with an authenticator app (QR code), which can be skipped; then the dashboard. */
export default function CompanySetup() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initial, setInitial] = useState<OrgProfile | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const u = getSessionUser();
    if (!u) { router.replace("/login?next=/setup"); return; }
    if (u.demo) { router.replace("/dashboard"); return; }
    setUser(u);
    if (!u.setupPending) { if (u.authenticator) router.replace("/dashboard"); else setStep(2); }
    api.get<Partial<Record<keyof OrgProfile, string | null>>>("/organization").then((o) => setInitial(profileFrom(o))).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your company."));
  }, [router]);

  async function save(p: OrgProfile) {
    setError("");
    try {
      const o = await api.put<{ name: string; currency: string }>("/organization/setup", p);
      updateSessionUser({ setupPending: false, organization: o.name, currency: o.currency });
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save. Please try again."); }
  }
  const done = () => router.replace("/dashboard?tab=start");

  return (
    <AuthShell wide aside={<Features />}>
      <section className="au-card setup" aria-labelledby="su-title">
        <ol className="au-progress" aria-label={`Step ${step} of 2`}>
          <li className={step > 1 ? "done" : "now"}><i>{step > 1 ? "✓" : 1}</i>Company profile</li>
          <li className={step === 2 ? "now" : ""}><i>2</i>Secure your account</li>
        </ol>
        {step === 1 && <>
          <h1 id="su-title">Set up your organization profile</h1>
          <p className="au-sub">{user ? `Welcome, ${user.name.split(" ")[0]}. ` : ""}Tell us about your business. You can change all of this later in Settings.</p>
          {error && <div className="au-err" role="alert">{error}</div>}
          {initial ? <OrgProfileForm initial={initial} onSubmit={save} submitLabel="Save and continue" /> : !error && <p className="au-note">Loading...</p>}
        </>}
        {step === 2 && <>
          <h1 id="su-title">Protect your account</h1>
          <p className="au-sub">Add a second lock: after your password, WHOLESTRA asks for a code from an app on your phone. Someone who learns your password still cannot get in.</p>
          <AuthenticatorSetup onDone={done} onSkip={done} skipLabel="Skip for now, I'll do it later in Settings" />
        </>}
      </section>
    </AuthShell>
  );
}
