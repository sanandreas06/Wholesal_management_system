'use client';
import { useState, type FormEvent } from "react";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "../../lib/contact";

const SIZES = ["1 branch", "2 to 3 branches", "4 to 10 branches", "More than 10 branches"];

/** Collects a few details and turns them into a ready-to-send message. Nothing is stored on this site: the person sends it by WhatsApp or email, whichever the site owner has set up. */
export default function GetStartedForm() {
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), v = (k: string) => String(f.get(k) || "").trim();
    setMsg([
      "Hello, I would like to get started with WHOLESTRA.",
      `Name: ${v("name")}`, `Business: ${v("business")}`, `Phone or WhatsApp: ${v("phone")}`, v("email") && `Email: ${v("email")}`,
      `Branches: ${v("size")}`, v("sells") && `We sell: ${v("sells")}`,
    ].filter(Boolean).join("\n"));
    setCopied(false);
  }
  async function copy() { try { await navigator.clipboard.writeText(msg || ""); setCopied(true); } catch { /* the text is visible to copy by hand */ } }

  if (msg !== null) {
    const enc = encodeURIComponent(msg);
    return (
      <div className="gs-done" role="status">
        <h2>Your message is ready</h2>
        {CONTACT_WHATSAPP || CONTACT_EMAIL ? <p>Send it to us and we will reply to arrange a walkthrough.</p> : <p>Online sending is not switched on for this site yet. Copy the message below and send it to the person who shared this site with you.</p>}
        <pre>{msg}</pre>
        <div className="gs-actions">
          {CONTACT_WHATSAPP && <a className="lp-btn kraft" href={`https://wa.me/${CONTACT_WHATSAPP}?text=${enc}`} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
          {CONTACT_EMAIL && <a className="lp-btn solid" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Get started with WHOLESTRA")}&body=${enc}`}>Send by email</a>}
          <button type="button" className="lp-btn line" onClick={copy}>{copied ? "Copied" : "Copy message"}</button>
          <button type="button" className="lp-btn line" onClick={() => setMsg(null)}>Edit details</button>
        </div>
      </div>
    );
  }
  return (
    <form className="gs-form" onSubmit={submit}>
      <label>Your name<input name="name" required autoComplete="name" /></label>
      <label>Business name<input name="business" required autoComplete="organization" /></label>
      <label>Phone or WhatsApp<input name="phone" required inputMode="tel" autoComplete="tel" /></label>
      <label><span>Email <small>(optional)</small></span><input name="email" type="email" autoComplete="email" /></label>
      <label>How many branches?<select name="size" defaultValue={SIZES[1]}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label><span>What do you sell? <small>(optional)</small></span><input name="sells" placeholder="For example building materials, food, drinks" /></label>
      <button className="lp-btn kraft wide" type="submit">Prepare my message</button>
    </form>
  );
}
