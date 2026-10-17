'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, SessionResponse } from "../../lib/authApi";
import { saveSession } from "../../lib/session";
import { ApiError } from "../../lib/api";

/** "Try the demo": opens the shared, read-only sample company straight away, without filling anything in. */
export default function DemoButton({ className = "lp-btn line", label = "Try the demo" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!busy) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [busy]);
  async function go() {
    setBusy(true); setError("");
    try { const s = await authApi.post<SessionResponse>("/auth/demo"); saveSession(s.accessToken, s.user); router.push("/dashboard"); }
    catch (e) { setError(e instanceof ApiError ? e.message : "The demo could not open. Please try again."); setBusy(false); }
  }
  return (
    <span className="lp-demo-wrap">
      <button type="button" className={className} onClick={go} disabled={busy}>{busy ? "Opening the demo..." : label}</button>
      {(slow || error) && <small className="lp-demo-note" role="status">{error || "The server is waking up after being idle. This can take up to a minute."}</small>}
    </span>
  );
}
