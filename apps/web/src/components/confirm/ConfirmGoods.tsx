'use client';
import { useEffect, useState } from "react";
import { authApi } from "../../lib/authApi";
import { ApiError } from "../../lib/api";
import { LogoMark } from "../Logo";
import "./confirm.css";

interface Info {
  company: string; logo: string | null; phone: string | null; branch: string; invoiceNumber: string; number: string; date: string; customer: string | null;
  items: { id: string; name: string; quantity: number }[]; total: number; confirmed: { status: string; at: string } | null;
}

/** The customer checks what they took home against what the shop recorded, and says yes, or what was missing. */
export default function ConfirmGoods({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"ask" | "short" | "thanks" | "sorry">("ask");
  const [got, setGot] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi.get<Info>(`/public/confirm/${encodeURIComponent(token)}`).then(i => {
      setInfo(i); setGot(Object.fromEntries(i.items.map(x => [x.id, x.quantity])));
      if (i.confirmed) setStep(i.confirmed.status === "PROBLEM" ? "sorry" : "thanks");
    }).catch(e => setError(e instanceof ApiError && e.status === 404
      ? "This receipt is not in the shop's records yet. If the shop's internet was down when you were served, please try again later today."
      : e instanceof ApiError ? e.message : "This page could not be opened. Check your connection and try again."));
  }, [token]);

  async function send(allReceived: boolean) {
    if (!info) return;
    setBusy(true); setError("");
    try {
      const r = await authApi.post<{ status: string }>(`/public/confirm/${encodeURIComponent(token)}`, allReceived ? { allReceived: true } : {
        allReceived: false, lines: info.items.map(i => ({ itemId: i.id, received: got[i.id] ?? i.quantity })), comment: comment.trim() || undefined, name: name.trim() || undefined, phone: phone.trim() || undefined,
      });
      setStep(r.status === "PROBLEM" ? "sorry" : "thanks");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setStep("thanks");
      else setError(e instanceof ApiError ? e.message : "Your answer could not be sent. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  const missing = info ? info.items.reduce((s, i) => s + Math.max(0, i.quantity - (got[i.id] ?? i.quantity)), 0) : 0;
  const when = info ? new Date(info.date).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const logo = info?.logo && /^data:image\/(png|jpeg|webp);base64,/.test(info.logo) ? info.logo : null;

  return (
    <main className="cf">
      <div className="cf-card">
        <header className="cf-head">
          {logo ? <img src={logo} alt="" className="cf-logo" /> : <span className="cf-mark"><LogoMark size={36} tone="dark" /></span>}
          <div><b>{info?.company ?? "WHOLESTRA"}</b>{info && <span>{info.branch}</span>}</div>
        </header>

        {!info && !error && <p className="cf-muted">Loading…</p>}
        {error && <p className="cf-err" role="alert">{error}</p>}

        {info && step === "ask" && <>
          <h1>Did you receive everything?</h1>
          <p className="cf-muted">Receipt {info.invoiceNumber} · {when}</p>
          <ul className="cf-items">{info.items.map(i => <li key={i.id}><span>{i.name}</span><b>{i.quantity}</b></li>)}</ul>
          <p className="cf-total"><span>Items</span><b>{info.total}</b></p>
          <button className="cf-yes" disabled={busy} onClick={() => send(true)}>{busy ? "Sending…" : "Yes, I received everything"}</button>
          <button className="cf-no" disabled={busy} onClick={() => setStep("short")}>Something is missing or wrong</button>
        </>}

        {info && step === "short" && <>
          <h1>What did you receive?</h1>
          <p className="cf-muted">Change the number for anything that is short. We will tell the manager straight away.</p>
          <ul className="cf-items edit">{info.items.map(i => (
            <li key={i.id}>
              <span>{i.name}<small>Shop recorded {i.quantity}</small></span>
              <div className="cf-step">
                <button type="button" aria-label={`One less ${i.name}`} onClick={() => setGot(g => ({ ...g, [i.id]: Math.max(0, (g[i.id] ?? i.quantity) - 1) }))}>−</button>
                <input type="number" inputMode="numeric" min={0} max={i.quantity} value={got[i.id] ?? i.quantity} onChange={e => setGot(g => ({ ...g, [i.id]: Math.max(0, Math.min(i.quantity, Math.floor(Number(e.target.value) || 0))) }))} aria-label={`How many ${i.name} you received`} />
                <button type="button" aria-label={`One more ${i.name}`} onClick={() => setGot(g => ({ ...g, [i.id]: Math.min(i.quantity, (g[i.id] ?? i.quantity) + 1) }))}>+</button>
              </div>
            </li>
          ))}</ul>
          <label className="cf-field">Anything else? (damaged, wrong item…)<textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={1000} /></label>
          <div className="cf-two">
            <label className="cf-field">Your name (optional)<input value={name} onChange={e => setName(e.target.value)} maxLength={120} autoComplete="name" /></label>
            <label className="cf-field">Phone (optional)<input value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} inputMode="tel" autoComplete="tel" /></label>
          </div>
          {missing > 0 && <p className="cf-warn">{missing} item{missing === 1 ? "" : "s"} short.</p>}
          <button className="cf-no solid" disabled={busy || (missing === 0 && !comment.trim())} onClick={() => send(false)}>{busy ? "Sending…" : "Send to the manager"}</button>
          <button className="cf-link" disabled={busy} onClick={() => setStep("ask")}>Back</button>
        </>}

        {info && step === "thanks" && <div className="cf-done">
          <div className="cf-tick" aria-hidden="true">✓</div>
          <h1>Thank you!</h1>
          <p>You confirmed you received your goods from {info.company}. We appreciate your business and hope to see you again soon.</p>
        </div>}

        {info && step === "sorry" && <div className="cf-done">
          <div className="cf-tick bad" aria-hidden="true">!</div>
          <h1>We are sorry</h1>
          <p>Your report has gone to the branch manager and the owner of {info.company}. They will look into it and contact you{info.phone ? `. You can also call ${info.phone}` : ""}.</p>
        </div>}
      </div>
      <p className="cf-foot">Checked with WHOLESTRA</p>
    </main>
  );
}
