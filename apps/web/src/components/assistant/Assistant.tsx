'use client';
import { Fragment, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Tour, { APP_TOUR, SITE_TOUR } from "./Tour";
import DemoModal from "../landing/DemoModal";
import { InstallSteps, startInstall } from "../InstallApp";
import type { Platform } from "../../lib/install";
import { Brain, Mode } from "../../lib/assistant/engine";
import { Card, Chip, Item, METHOD, money, ReportData } from "../../lib/assistant/core";
import { clearSession, getSessionUser } from "../../lib/session";
import { CONTACT_EMAIL, CONTACT_PHONES, telHref, whatsappHref } from "../../lib/contact";
import "./assistant.css";

const MAX_ITEMS = 80;

/** Turns the assistant's plain text (with the odd **bold** and "- " bullet) into tidy lines. */
function Rich({ text }: { text: string }) {
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>));
  const out: ReactNode[] = []; let list: ReactNode[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={`u${out.length}`}>{list}</ul>); list = []; } };
  text.split("\n").forEach((line, i) => {
    const m = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (m) { list.push(<li key={i}>{bold(m[1])}</li>); return; }
    flush();
    if (line.trim()) out.push(<p key={i}>{bold(line.replace(/^#+\s*/, ""))}</p>);
  });
  flush();
  return <>{out}</>;
}

function Report({ data, title }: { data: ReportData; title: string }) {
  const c = data.currency; const top = Math.max(1, ...data.byBranch.map((b) => b.total));
  return (
    <div className="ac ac-report">
      <div className="ac-h">{title}</div>
      <div className="ac-big">{money(data.total, c)}</div>
      <div className="ac-stats">
        <span><b>{data.count}</b>sale{data.count === 1 ? "" : "s"}</span>
        <span><b>{money(data.paid, c)}</b>paid</span>
        <span className={data.owed > 0 ? "warn" : ""}><b>{money(data.owed, c)}</b>owed</span>
      </div>
      {data.byBranch.length > 1 && <div className="ac-sec"><small>By branch</small>{data.byBranch.map((b) => (
        <div key={b.id} className="ac-bar"><span>{b.name}</span><i style={{ width: `${Math.max(4, (b.total / top) * 100)}%` }} /><em>{money(b.total, c)}</em></div>
      ))}</div>}
      {data.topProducts.length > 0 && <div className="ac-sec"><small>Top products</small>{data.topProducts.map((p) => (
        <div key={p.id} className="ac-row"><span>{p.name}<em>{p.quantity} sold</em></span><b>{money(p.total, c)}</b></div>
      ))}</div>}
      {data.byMethod.length > 0 && <div className="ac-sec"><small>Payments</small><div className="ac-pills">{data.byMethod.map((m) => <span key={m.method}>{METHOD[m.method] ?? m.method} · {money(m.amount, c)}</span>)}</div></div>}
    </div>
  );
}

function Contact() {
  const wa = whatsappHref("Hello WHOLESTRA, I have a question.");
  return (
    <div className="ac ac-contact">
      {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}><span aria-hidden="true">✉</span>{CONTACT_EMAIL}</a>}
      {CONTACT_PHONES.map((p) => <a key={p} href={telHref(p)}><span aria-hidden="true">☎</span>{p}</a>)}
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">💬</span>WhatsApp</a>}
      <a href="/contact"><span aria-hidden="true">→</span>Send us a message</a>
    </div>
  );
}

export default function Assistant({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [touring, setTouring] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [installOn, setInstallOn] = useState<Platform | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const brain = useRef<Brain | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const key = useMemo(() => (typeof window === "undefined" ? "" : `wms_ast:${mode}:${mode === "app" ? getSessionUser()?.email ?? "" : ""}`), [mode]);
  const narrow = () => typeof window !== "undefined" && window.innerWidth < 640;

  const push = useCallback((add: Item[]) => setItems((prev) => [...prev, ...add].slice(-MAX_ITEMS)), []);
  const patch = useCallback((id: string, card: Card) => setItems((prev) => prev.map((it) => (it.card?.kind === "confirm" && it.card.id === id ? { ...it, card: { ...it.card, ...card } as Card } : it))), []);

  // ---------------------------------------------------------------------------------------------- start: restore this tab's conversation
  useEffect(() => {
    const b = new Brain(mode, {
      push, patch,
      go: (to) => { if (narrow()) setOpen(false); if (to === window.location.pathname + window.location.search) window.location.reload(); else router.push(to); },
      tour: () => { setOpen(false); setTimeout(() => setTouring(true), 150); },
      demo: () => { if (mode === "site") setDemoOpen(true); },
      install: () => { void startInstall().then((p) => setInstallOn(p)); },
    });
    brain.current = b;
    let restored: Item[] = [];
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const s = JSON.parse(raw) as { items?: Item[]; messages?: never[]; draft?: never; open?: boolean };
        // cards waiting for a decision cannot be confirmed after a page reload
        restored = (s.items ?? []).map((it) => (it.card?.kind === "confirm" && (it.card.state === "waiting" || it.card.state === "saving") ? { ...it, card: { ...it.card, state: "expired" as const } } : it));
        b.restore({ messages: s.messages, draft: s.draft });
        if (s.open && !narrow()) setOpen(true);
      }
    } catch { /* start fresh */ }
    setItems(restored.length ? restored : b.greeting());
    setReady(true);
  }, [mode, key, push, patch, router]);

  // keep the conversation for this tab (it moves with the person from page to page)
  useEffect(() => {
    if (!ready || !brain.current) return;
    try { sessionStorage.setItem(key, JSON.stringify({ items: items.slice(-MAX_ITEMS), ...brain.current.snapshot(), open })); } catch { /* storage full or blocked */ }
  }, [items, open, ready, key]);

  // a friendly hello: once per tab on the website, once per person in the app, every time in the demo
  useEffect(() => {
    if (!ready || open) return;
    const u = getSessionUser();
    let flag = "", msg = "", store: Storage | null = null;
    try {
      if (mode === "site") { store = sessionStorage; flag = "wms_ast_hi_site"; msg = "Hi 👋 Need a hand? I can show you around or answer questions."; }
      else if (u?.demo) { store = sessionStorage; flag = `wms_ast_hi_demo`; msg = `Welcome to the demo${u.organization ? ` of ${u.organization}` : ""}! Want a quick tour?`; }
      else { store = localStorage; flag = `wms_ast_hi:${u?.email ?? ""}`; msg = `Hi ${(u?.name ?? "").split(" ")[0] || "there"}! I can show you around, or do tasks for you like recording a sale.`; }
      if (store.getItem(flag)) return;
    } catch { return; }
    const t = setTimeout(() => { setNudge(msg); try { store?.setItem(flag, "1"); } catch { /* ignore */ } }, mode === "site" ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [ready, open, mode]);

  useEffect(() => { if (open) { setNudge(null); setTimeout(() => input.current?.focus(), 60); } }, [open]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [items, busy, open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !touring) setOpen(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, touring]);

  async function send(words: string) {
    const b = brain.current; if (!b || busy || !words.trim()) return;
    setText(""); setBusy(true);
    try { await b.send(words); } finally { setBusy(false); }
  }
  function chip(c: Chip) {
    if (c.say) return void send(c.say);
    const r = c.run; const h = brain.current?.host; if (!r || !h) return;
    if (r.do === "go") h.go(r.path); else if (r.do === "tour") h.tour(); else if (r.do === "demo") h.demo(); else if (r.do === "install") h.install();
    else if (r.do === "reset") restart();
  }
  function restart() { brain.current?.reset(); setItems(brain.current?.greeting() ?? []); }
  async function decide(id: string, ok: boolean) {
    if (!brain.current) return; setBusy(true);
    try { await brain.current.decide(id, ok); } finally { setBusy(false); }
  }

  if (!ready) return null;
  const lastBot = [...items].reverse().find((it) => it.from === "bot" && it.chips?.length);
  const user = getSessionUser();

  return (
    <div className={`ast ast-${mode}`}>
      {nudge && !open && (
        <div className="ast-nudge" role="status">
          <button type="button" className="ast-nudge-x" aria-label="Dismiss" onClick={() => setNudge(null)}>×</button>
          <p>{nudge}</p>
          <div>
            <button type="button" onClick={() => { setNudge(null); setTouring(true); }}>Show me around</button>
            <button type="button" className="alt" onClick={() => setOpen(true)}>Ask a question</button>
          </div>
        </div>
      )}
      <button type="button" className={`ast-fab${open ? " on" : ""}`} aria-label={open ? "Close the assistant" : "Open the WHOLESTRA assistant"} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open
          ? <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          : <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.6" /></svg>}
        {!open && <span className="ast-fab-dot" aria-hidden="true" />}
      </button>

      {open && (
        <section className="ast-panel" role="dialog" aria-label="WHOLESTRA assistant">
          <header className="ast-head">
            <img src="/icons/icon-192.png" alt="" width="36" height="36" />
            <div><strong>WHOLESTRA Assistant</strong><small>{mode === "app" ? (user?.demo ? "Demo · nothing is saved" : "Ask me, or tell me what to do") : "Here to help you find your way"}</small></div>
            <button type="button" className="ast-icon" title="Start a new conversation" aria-label="Start a new conversation" onClick={restart}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
            <button type="button" className="ast-icon" aria-label="Close" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div className="ast-list" ref={list} aria-live="polite">
            {items.map((it) => (
              <div key={it.id} className={`ast-msg ${it.from}`}>
                {it.text ? <div className="ast-bubble"><Rich text={it.text} /></div> : null}
                {it.card?.kind === "report" && <Report data={it.card.data} title={it.card.title} />}
                {it.card?.kind === "contact" && <Contact />}
                {it.card?.kind === "list" && (
                  <div className="ac ac-list">
                    <div className="ac-h">{it.card.title}</div>
                    {it.card.lines.length === 0 && <p className="ac-empty">{it.card.empty ?? "Nothing to show."}</p>}
                    {it.card.lines.map((l, i) => <div key={i} className="ac-row"><span>{l.label}{l.detail && <em>{l.detail}</em>}</span><b className={l.tone ?? ""}>{l.value}</b></div>)}
                    {!!it.card.more && <p className="ac-more">and {it.card.more} more</p>}
                  </div>
                )}
                {it.card?.kind === "confirm" && it.card.view && (() => {
                  const c = it.card; const v = c.view!;
                  return (
                    <div className={`ac ac-confirm ${c.state}`}>
                      <div className="ac-h">{v.title}</div>
                      <dl>{v.rows.map(([k, val]) => <Fragment key={k}><dt>{k}</dt><dd>{val}</dd></Fragment>)}</dl>
                      {v.lines && <table><thead><tr><th>Item</th><th>Qty</th><th>Each</th><th>Total</th></tr></thead><tbody>{v.lines.map((l, i) => <tr key={i}><td>{l.name}</td><td>{l.qty}</td><td>{l.each}</td><td>{l.total}</td></tr>)}</tbody></table>}
                      {v.total && <div className="ac-total"><span>Total</span><b>{v.total}</b></div>}
                      {v.note && <p className="ac-note">{v.note}</p>}
                      {c.state === "waiting" && !c.demo && <div className="ac-btns"><button type="button" className="ok" disabled={busy} onClick={() => decide(c.id, true)}>Confirm</button><button type="button" disabled={busy} onClick={() => decide(c.id, false)}>Cancel</button>{c.form && <button type="button" className="link" onClick={() => brain.current?.host.go(c.form!)}>Edit in the full form</button>}</div>}
                      {c.state === "waiting" && c.demo && <div className="ac-btns"><button type="button" className="ok" disabled title="The demo is read-only">Confirm</button><a className="link" href="/get-started" onClick={() => clearSession()}>Create your free account</a></div>}
                      {c.state === "saving" && <p className="ac-state">Saving…</p>}
                      {c.state === "done" && <p className="ac-state ok">✓ Saved</p>}
                      {c.state === "cancelled" && <p className="ac-state">Not saved</p>}
                      {c.state === "expired" && <p className="ac-state">Not saved (this card expired). Ask again if you still need it.</p>}
                      {c.state === "failed" && <p className="ac-state bad">Not saved: {c.error}</p>}
                    </div>
                  );
                })()}
                {it === lastBot && it.chips && <div className="ast-chips">{it.chips.map((c) => <button key={c.label} type="button" disabled={busy} onClick={() => chip(c)}>{c.label}</button>)}</div>}
              </div>
            ))}
            {busy && <div className="ast-msg bot"><div className="ast-bubble ast-typing" aria-label="Thinking"><i /><i /><i /></div></div>}
          </div>

          <form className="ast-input" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <textarea ref={input} rows={1} value={text} maxLength={1500} placeholder={mode === "app" ? "Ask or tell me what to do…" : "Ask me anything about WHOLESTRA…"}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} aria-label="Message" />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
          {mode === "app" && <p className="ast-foot">{user?.demo ? "This is the demo: nothing you do here is saved." : "I only save things after you press Confirm."}</p>}
        </section>
      )}

      {touring && <Tour steps={mode === "app" ? APP_TOUR : SITE_TOUR} onClose={() => setTouring(false)} />}
      {mode === "site" && <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />}
      {installOn && <InstallSteps on={installOn} onClose={() => setInstallOn(null)} />}
    </div>
  );
}
