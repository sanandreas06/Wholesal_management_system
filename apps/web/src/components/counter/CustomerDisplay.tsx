'use client';
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { getSessionUser } from "../../lib/session";
import { LogoMark } from "../Logo";
import { channelName, DisplayMsg } from "./display-channel";
import "./counter.css";

type Payment = { name: string; momoNumber: string | null; momoName: string | null; momoMerchantId: string | null; momoQr: string | null };
type Brand = { name: string; logo: string | null };
const n2 = (v: number) => v.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const METHOD: Record<string, string> = { CASH: "cash", MOBILE_MONEY: "mobile money", BANK: "bank transfer", CREDIT: "credit" };

/** The screen that faces the customer: what is being bought and the running total on the left; how to pay by mobile money on the right.
 *  Opened from the counter's "Customer screen" button and dragged to the second display (press F11 for full screen). */
export default function CustomerDisplay() {
  const [branch, setBranch] = useState("");
  const [msg, setMsg] = useState<DisplayMsg>({ type: "idle" });
  const [pay, setPay] = useState<Payment | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("branch") ?? "";
    setBranch(b);
    if (!getSessionUser()) { setSignedIn(false); return; }
    if (b) api.get<Payment>(`/branches/${b}/payment`).then(setPay).catch(() => setPay(null));
    api.get<Brand>("/organization/brand").then(setBrand).catch(() => undefined);
    document.title = "Customer screen | WHOLESTRA";
  }, []);
  useEffect(() => {
    if (!branch || typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(channelName(branch));
    c.onmessage = (e: MessageEvent<DisplayMsg>) => { if (e.data && e.data.type !== "hello") setMsg(e.data); };
    c.postMessage({ type: "hello" } satisfies DisplayMsg);
    return () => c.close();
  }, [branch]);
  // after "Thank you", go back to the welcome screen
  useEffect(() => { if (msg.type !== "paid") return; const t = setTimeout(() => setMsg({ type: "idle" }), 12_000); return () => clearTimeout(t); }, [msg]);

  if (!signedIn) return <div className="cd-blank"><p>Open the customer screen from the counter, on the same computer, while signed in.</p></div>;
  const company = brand?.name || "WHOLESTRA";
  const hasMomo = !!(pay?.momoQr || pay?.momoNumber || pay?.momoMerchantId);

  return (
    <div className="cd" onDoubleClick={() => { document.documentElement.requestFullscreen?.().catch(() => undefined); }}>
      <section className="cd-left">
        <header className="cd-head">
          {brand?.logo && /^data:image\//.test(brand.logo) ? <img src={brand.logo} alt="" className="cd-logo" /> : <LogoMark size={44} tone="dark" />}
          <div><b>{company}</b><small>{pay?.name ?? ""}</small></div>
        </header>
        {msg.type === "cart" ? <>
          <ul className="cd-lines">
            {msg.lines.map(l => <li key={l.id}><span className="q">{l.qty} ×</span><span className="n">{l.name}<small>{n2(l.price)} each</small></span><b>{n2(l.qty * l.price)}</b></li>)}
          </ul>
          <div className="cd-total"><span>Total to pay{msg.customer ? ` · ${msg.customer}` : ""}</span><b>GH₵ {n2(msg.total)}</b></div>
        </> : msg.type === "paid" ? (
          <div className="cd-thanks"><div className="cd-tick" aria-hidden="true">✓</div><h1>Thank you!</h1>
            <p>{msg.method === "CREDIT" ? <>GH₵ {n2(msg.total)} added to your account.</> : <>Paid GH₵ {n2(msg.paid)} by {METHOD[msg.method] ?? "cash"}.</>}</p>
            {msg.change > 0 && <p className="cd-change">Your change: <b>GH₵ {n2(msg.change)}</b></p>}
            <small>Receipt {msg.invoice}</small></div>
        ) : (
          <div className="cd-welcome"><h1>Welcome to {company}</h1><p>Your items and the total will show here as they are added.</p></div>
        )}
      </section>
      <section className="cd-right">
        <h2>Pay with Mobile Money</h2>
        {hasMomo ? <>
          {pay?.momoQr && <img className="cd-qr" src={pay.momoQr} alt="Scan to pay with mobile money" />}
          {pay?.momoQr && <p className="cd-scan">Scan with your MoMo app</p>}
          <dl className="cd-ids">
            {pay?.momoMerchantId && <><dt>Merchant ID</dt><dd>{pay.momoMerchantId}</dd></>}
            {pay?.momoNumber && <><dt>MoMo number</dt><dd>{pay.momoNumber}</dd></>}
            {pay?.momoName && <><dt>Name</dt><dd>{pay.momoName}</dd></>}
          </dl>
          {msg.type === "cart" && <p className="cd-amount">Amount: <b>GH₵ {n2(msg.total)}</b></p>}
        </> : <p className="cd-none">Please pay at the counter.<br />Cash, mobile money and bank transfer accepted.</p>}
        <p className="cd-foot">Powered by WHOLESTRA</p>
      </section>
    </div>
  );
}
