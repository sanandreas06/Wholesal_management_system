'use client';
import { useEffect, useState } from "react";
import OtpBoxes from "./OtpBoxes";
import { api, ApiError } from "../../lib/api";
import { qrSvg } from "../../lib/qr";
import { updateSessionUser } from "../../lib/session";

/** Turning on the authenticator app: scan the QR code (or type the key), prove it works with one code, then keep the recovery codes.
 *  Used on the set-up screen after sign-up and in Settings → Security. */
export default function AuthenticatorSetup({ onDone, onSkip, skipLabel = "Skip for now" }: { onDone: () => void; onSkip?: () => void; skipLabel?: string }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [kept, setKept] = useState(false);

  useEffect(() => {
    api.post<{ secret: string; uri: string }>("/auth/totp/setup").then(setSetup).catch((e) => setError(e instanceof ApiError ? e.message : "Could not start. Please try again."));
  }, []);

  async function confirm(v = code) {
    if (v.length < 6 || busy) return;
    setBusy(true); setError("");
    try {
      const r = await api.post<{ recoveryCodes: string[] }>("/auth/totp/enable", { code: v });
      setCodes(r.recoveryCodes); updateSessionUser({ authenticator: true });
    } catch (e) { setError(e instanceof ApiError ? e.message : "That code did not work. Try the newest one."); setCode(""); }
    finally { setBusy(false); }
  }
  function copy(text: string, what: string) { navigator.clipboard?.writeText(text).then(() => { setCopied(what); setTimeout(() => setCopied(""), 1800); }).catch(() => {}); }
  function download() {
    const body = `WHOLESTRA recovery codes\nEach code works once, if you cannot use your authenticator app.\nKeep them somewhere safe.\n\n${codes!.join("\n")}\n`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/plain" })); a.download = "wholestra-recovery-codes.txt"; a.click(); URL.revokeObjectURL(a.href);
  }

  if (codes) return (
    <div className="ta">
      <p className="ta-ok"><span aria-hidden="true">✓</span> Your authenticator app is on.</p>
      <h3>Save your recovery codes</h3>
      <p className="au-sub">If you lose your phone, each of these codes lets you in once. Keep them somewhere safe and private. You will not see them again.</p>
      <ul className="ta-codes">{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
      <div className="ta-row">
        <button type="button" className="au-ghost" onClick={() => copy(codes.join("\n"), "codes")}>{copied === "codes" ? "Copied ✓" : "Copy"}</button>
        <button type="button" className="au-ghost" onClick={download}>Download</button>
        <button type="button" className="au-ghost" onClick={() => window.print()}>Print</button>
      </div>
      <label className="au-check"><input type="checkbox" checked={kept} onChange={(e) => setKept(e.target.checked)} /><span>I have saved my recovery codes.</span></label>
      <button type="button" className="au-primary" disabled={!kept} onClick={onDone}>Continue</button>
    </div>
  );

  const qr = setup ? qrSvg(setup.uri) : null;
  const key = setup?.secret.replace(/(.{4})/g, "$1 ").trim();
  return (
    <div className="ta">
      <ol className="ta-steps">
        <li><b>Get an authenticator app</b><span>Google Authenticator, Microsoft Authenticator or any app that shows 6-digit codes. They are free.</span></li>
        <li><b>Scan this QR code with the app</b><span>In the app, tap + and choose "Scan a QR code".</span></li>
      </ol>
      <div className="ta-qr">
        {qr ? <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR code for your authenticator app" shapeRendering="crispEdges"><rect width={qr.size} height={qr.size} fill="#fff" /><path d={qr.path} fill="#0B1B3E" /></svg> : <div className="ta-qr-wait">{error ? "!" : "Loading..."}</div>}
        <div className="ta-key">
          <small>Can&apos;t scan? Type this key in the app instead:</small>
          <code>{key ?? "..."}</code>
          {setup && <button type="button" className="au-link" onClick={() => copy(setup.secret, "key")}>{copied === "key" ? "Copied ✓" : "Copy key"}</button>}
          {setup && <a className="au-link ta-open" href={setup.uri}>Open in the authenticator app on this phone</a>}
        </div>
      </div>
      <ol className="ta-steps" start={3}><li><b>Type the 6-digit code the app shows</b><span>This proves it is set up correctly.</span></li></ol>
      <form onSubmit={(e) => { e.preventDefault(); confirm(); }}>
        <OtpBoxes value={code} onChange={setCode} onComplete={(v) => confirm(v)} disabled={busy || !setup} autoFocus={false} invalid={!!error} label="Code from your authenticator app" />
        {error && <div className="au-err" role="alert">{error}</div>}
        <button className="au-primary" disabled={busy || code.length < 6 || !setup}>{busy ? "Checking..." : "Turn on"}</button>
      </form>
      {onSkip && <div className="au-actions"><button type="button" className="au-link" onClick={onSkip}>{skipLabel}</button></div>}
    </div>
  );
}
