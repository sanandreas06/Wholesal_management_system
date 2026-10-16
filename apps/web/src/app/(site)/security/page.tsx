import type { Metadata } from "next";
import Link from "next/link";
import SealChain from "../../../components/landing/SealChain";

export const metadata: Metadata = { title: "Security | WHOLESTRA", description: "Branch-level access, approval limits, a sealed change log and private passwords." };

const POINTS = [
  ["Branch-level access", "A role can be limited to one branch. A branch manager cannot see another branch’s stock, sales or people, even by typing an address."],
  ["Least access by default", "Each role lists the screens it may open and what it may do. Cost price and profit are shown only to roles that have that permission."],
  ["Approval limits", "A role can approve expenses up to an amount you choose. Bigger ones wait for the owner, and nobody approves their own."],
  ["A sealed change log", "Every important change is written with who made it, when, and the before and after values. Each entry is sealed with a secret key and linked to the one before it."],
  ["Plain-words sign-in records", "Sign-ins show the device, such as “Chrome on Windows”, and whether it came from inside your network or outside."],
  ["Your own password", "New users must choose a private password the first time they sign in. Secrets that protect sign-ins and the log can be replaced at any time."],
];

export default function Security() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>Built so one mistake cannot sink the business</h1><p className="lp-lead">WHOLESTRA assumes people make errors, and that sometimes someone will try to hide one. These are the safeguards that are in the product today.</p></div></section>
      <section className="lp-sec ink"><div className="lp-wrap lp-split"><div><h2 className="lp-h2">Try to change the record</h2><p className="lp-sub">Edit any entry and see how the seals after it stop matching.</p></div><SealChain /></div></section>
      <section className="lp-sec light">
        <div className="lp-wrap">
          <dl className="lp-defs">{POINTS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
          <p className="lp-note-box"><b>Early access.</b> This public demo runs on free hosting with sample data. It is for looking around, not for real shop records. Real use needs a hosted setup with regular backups.</p>
        </div>
      </section>
      <section className="lp-final"><div className="lp-wrap"><h2 className="lp-h2">Questions about how your data is handled?</h2><div className="lp-cta center"><Link href="/contact" className="lp-btn kraft">Contact us</Link></div></div></section>
    </>
  );
}
