'use client';
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, SessionResponse } from "../../lib/authApi";
import { saveSession } from "../../lib/session";
import { ApiError } from "../../lib/api";
import "./demo-modal.css";

/** The pop-up shown before the demo opens: it asks for the visitor's shop or company name, which then appears inside the demo. */
export default function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setError(""); setTimeout(() => input.current?.focus(), 30); } }, [open]);
  useEffect(() => { if (!busy) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [busy]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, busy, onClose]);
  if (!open) return null;

  async function go(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setError("Please type your shop or company name."); input.current?.focus(); return; }
    setBusy(true); setError("");
    try {
      const s = await authApi.post<SessionResponse>("/auth/demo", { company: name.trim() });
      saveSession(s.accessToken, s.user); router.push("/dashboard");
    } catch (e) { setError(e instanceof ApiError ? e.message : "The demo could not open. Please try again."); setBusy(false); }
  }

  return (
    <div className="dm-back" onClick={() => !busy && onClose()}>
      <div className="dm" role="dialog" aria-modal="true" aria-labelledby="dm-t" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dm-x" onClick={onClose} aria-label="Close" disabled={busy}>×</button>
        <span className="dm-ic" aria-hidden="true">▶</span>
        <h2 id="dm-t">Try the demo</h2>
        <p>Look around a sample wholesale company with stock, sales and branches already filled in. It is read-only.</p>
        <form onSubmit={go}>
          <label htmlFor="dm-n">Your shop or company name <span aria-hidden="true">*</span></label>
          <input id="dm-n" ref={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Asante Distributors" autoComplete="organization" required aria-invalid={!!error} />
          {error && <small className="dm-err" role="alert">{error}</small>}
          {slow && <small className="dm-note" role="status">The server is waking up after being idle. This can take up to a minute.</small>}
          <button className="dm-go" disabled={busy}>{busy ? "Opening the demo..." : "Open the demo"}</button>
        </form>
      </div>
    </div>
  );
}
