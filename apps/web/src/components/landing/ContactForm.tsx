'use client';
import { FormEvent, useState } from "react";
import Link from "next/link";
import { authApi } from "../../lib/authApi";
import { ApiError } from "../../lib/api";

const SUBJECTS = ["A demo of WHOLESTRA", "Prices and plans", "Help with my account", "Partnership", "Something else"];
const BRANCHES = ["1", "2 to 5", "6 to 20", "More than 20"];
type F = { name: string; email: string; phone: string; company: string; branches: string; subject: string; message: string; agree: boolean; website: string };
const EMPTY: F = { name: "", email: "", phone: "", company: "", branches: "", subject: "", message: "", agree: false, website: "" };

function check(f: F): Partial<Record<keyof F, string>> {
  const e: Partial<Record<keyof F, string>> = {};
  if (f.name.trim().length < 2) e.name = "Please type your full name.";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Please type a valid email address.";
  if (!/^[+()\d\s-]{7,24}$/.test(f.phone.trim())) e.phone = "Please type a valid phone number.";
  if (f.company.trim().length < 2) e.company = "Please type your company's name.";
  if (!f.subject) e.subject = "Please choose what your message is about.";
  if (f.message.trim().length < 10) e.message = "Please tell us a little more (at least 10 characters).";
  if (!f.agree) e.agree = "Please agree so we can contact you.";
  return e;
}

/** The enquiry form on the Contact page. Every field marked * must be filled in; the message is stored and sent to the WHOLESTRA team. */
export default function ContactForm() {
  const [f, setF] = useState<F>(EMPTY);
  const [errs, setErrs] = useState<Partial<Record<keyof F, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const set = <K extends keyof F>(k: K, v: F[K]) => { setF((x) => ({ ...x, [k]: v })); if (errs[k]) setErrs((x) => ({ ...x, [k]: undefined })); };

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    const found = check(f); setErrs(found);
    const first = Object.keys(found)[0];
    if (first) { document.getElementById(`cf-${first}`)?.focus(); return; }
    setBusy(true);
    try {
      const { agree: _agree, ...body } = f; void _agree;
      await authApi.post("/inquiries", { ...body, branches: f.branches || undefined, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), company: f.company.trim(), message: f.message.trim() });
      setSent(f.name.trim().split(" ")[0]); setF(EMPTY); setTimeout(() => document.querySelector(".cf-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Your message could not be sent. Please try again, or reach us on WhatsApp."); }
    finally { setBusy(false); }
  }

  if (sent !== null) return (
    <div className="cf-done" role="status">
      <span aria-hidden="true">✓</span>
      <h3>Thank you, {sent}.</h3>
      <p>Your message has reached the WHOLESTRA team. We reply within one working day.</p>
      <button type="button" className="lp-btn line-dark" onClick={() => setSent(null)}>Send another message</button>
    </div>
  );

  const field = (k: "name" | "email" | "phone" | "company", label: string, type: string, auto: string, ph?: string) => (
    <div className="cf-field">
      <label htmlFor={`cf-${k}`}>{label} <span className="cf-req" aria-hidden="true">*</span></label>
      <input id={`cf-${k}`} type={type} value={f[k]} onChange={(e) => set(k, e.target.value)} autoComplete={auto} placeholder={ph} required aria-invalid={!!errs[k]} aria-describedby={errs[k] ? `cf-${k}-e` : undefined} />
      {errs[k] && <small id={`cf-${k}-e`} className="cf-err">{errs[k]}</small>}
    </div>
  );

  return (
    <form className="cf" onSubmit={submit} noValidate>
      <p className="cf-note">Fields marked <span className="cf-req">*</span> are required.</p>
      <div className="cf-grid">
        {field("name", "Full name", "text", "name")}
        {field("email", "Email address", "email", "email", "you@company.com")}
        {field("phone", "Phone number", "tel", "tel", "+233 ...")}
        {field("company", "Company name", "text", "organization")}
        <div className="cf-field">
          <label htmlFor="cf-branches">Number of branches</label>
          <select id="cf-branches" value={f.branches} onChange={(e) => set("branches", e.target.value)}><option value="">Choose</option>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</select>
        </div>
        <div className="cf-field">
          <label htmlFor="cf-subject">What is it about? <span className="cf-req" aria-hidden="true">*</span></label>
          <select id="cf-subject" value={f.subject} onChange={(e) => set("subject", e.target.value)} required aria-invalid={!!errs.subject}><option value="">Choose</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
          {errs.subject && <small className="cf-err">{errs.subject}</small>}
        </div>
        <div className="cf-field span2">
          <label htmlFor="cf-message">Message <span className="cf-req" aria-hidden="true">*</span></label>
          <textarea id="cf-message" rows={5} value={f.message} onChange={(e) => set("message", e.target.value)} maxLength={3000} required aria-invalid={!!errs.message} placeholder="Tell us about your business and how we can help." />
          {errs.message && <small className="cf-err">{errs.message}</small>}
        </div>
      </div>
      <div className="cf-hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} /></label></div>
      <label className="cf-agree"><input id="cf-agree" type="checkbox" checked={f.agree} onChange={(e) => set("agree", e.target.checked)} /><span>I agree that WHOLESTRA may contact me about this message, as described in the <Link href="/privacy">privacy notice</Link>. <span className="cf-req">*</span></span></label>
      {errs.agree && <small className="cf-err">{errs.agree}</small>}
      {error && <div className="cf-fail" role="alert">{error}</div>}
      <button className="lp-btn solid wide" disabled={busy}>{busy ? "Sending..." : "Send message"}</button>
    </form>
  );
}
