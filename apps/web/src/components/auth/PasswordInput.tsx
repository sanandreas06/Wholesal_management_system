'use client';
import { useState } from "react";

/** A password box with a Show/Hide button and, when asked, a strength bar with plain advice. The rules match the server: at least 8 characters with a letter and a number. */
export function passwordProblem(p: string) {
  if (p.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Use at least one letter and one number.";
  return "";
}
function score(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}
const WORDS = ["Too weak", "Weak", "Fair", "Good", "Strong"];

export default function PasswordInput({ label = "Password", value, onChange, autoComplete = "current-password", meter, autoFocus, id = "pw" }: {
  label?: string; value: string; onChange: (v: string) => void; autoComplete?: string; meter?: boolean; autoFocus?: boolean; id?: string;
}) {
  const [show, setShow] = useState(false);
  const s = score(value), problem = value ? passwordProblem(value) : "";
  return (
    <div className="au-field">
      <label htmlFor={id}>{label}</label>
      <div className="au-pw">
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required autoFocus={autoFocus} aria-describedby={meter ? `${id}-hint` : undefined} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
      </div>
      {meter && (
        <div className="au-meter" id={`${id}-hint`} aria-live="polite">
          <div className="au-meter-bar" data-s={value ? s : 0}><i /><i /><i /><i /></div>
          <small>{!value ? "At least 8 characters, with a letter and a number." : problem || `${WORDS[s]} password`}</small>
        </div>
      )}
    </div>
  );
}
