'use client';
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, ALL_CATEGORIES, brandsFor } from "../../lib/catalog";
import "./pickers.css";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A sheet that slides up on a phone (and opens as a dialog on a computer) with a search box and a list to tap. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }; window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true); }, [onClose]);
  return (
    <div className="pk-back" onClick={onClose}>
      <div className="pk-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="pk-head"><b>{title}</b><button type="button" className="pk-x" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

/** "Other": type a name that is not in the list. */
function OtherBox({ label, initial, onUse }: { label: string; initial: string; onUse: (v: string) => void }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <form className="pk-other" onSubmit={e => { e.preventDefault(); e.stopPropagation(); if (v.trim()) onUse(v.trim()); }}>
      <label>{label}<input ref={ref} value={v} onChange={e => setV(e.target.value)} maxLength={80} placeholder="Type the name" /></label>
      <button type="submit" disabled={!v.trim()}>Use this</button>
    </form>
  );
}

/** The field on the form: shows the choice, opens the sheet. */
function Field({ label, value, placeholder, onOpen, onClear }: { label: string; value: string; placeholder: string; onOpen: () => void; onClear: () => void }) {
  return (
    <div className="pk-field">
      <span className="pk-label">{label}</span>
      <div className="pk-row">
        <button type="button" className={"pk-pick" + (value ? " set" : "")} onClick={onOpen}>
          <span>{value || placeholder}</span><i aria-hidden="true">›</i>
        </button>
        {value && <button type="button" className="pk-clear" onClick={onClear} aria-label={`Clear ${label.toLowerCase()}`}>×</button>}
      </div>
    </div>
  );
}

/** Category: the ready-made list, grouped like an online store, plus the company's own; "Other" to type a new one. */
export function CategoryPicker({ value, onChange, own = [] }: { value: string; onChange: (v: string) => void; own?: string[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const known = useMemo(() => new Set(ALL_CATEGORIES.map(c => norm(c.name))), []);
  const mine = own.filter(n => !known.has(norm(n)));
  const hits = q.trim() ? [...mine.map(name => ({ name, group: "Your categories", icon: "⭐" })), ...ALL_CATEGORIES].filter(c => norm(c.name).includes(norm(q)) || norm(c.group).includes(norm(q))).slice(0, 40) : [];
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(""); setGroup(null); setOther(false); };
  const close = () => { setOpen(false); setQ(""); setGroup(null); setOther(false); };
  const shownGroup = CATALOG.find(g => g.group === group);
  return <>
    <Field label="Category" value={value} placeholder="Choose a category" onOpen={() => setOpen(true)} onClear={() => onChange("")} />
    {open && <Sheet title={other ? "Other category" : shownGroup ? shownGroup.group : "Choose a category"} onClose={close}>
      {other ? <OtherBox label="Category name" initial={q} onUse={pick} /> : <>
        <input className="pk-search" value={q} onChange={e => { setQ(e.target.value); setGroup(null); }} placeholder="Search, e.g. rice, tyres, phones" aria-label="Search categories" autoFocus />
        <div className="pk-list">
          {q.trim() ? (hits.length ? hits.map(c => <button type="button" key={c.group + c.name} className={"pk-item" + (c.name === value ? " on" : "")} onClick={() => pick(c.name)}><span className="pk-ico">{c.icon}</span><span><b>{c.name}</b><small>{c.group}</small></span></button>)
            : <p className="pk-none">Nothing called &quot;{q}&quot;. Use <b>Other</b> below to add it.</p>)
          : shownGroup ? <>
              <button type="button" className="pk-back-link" onClick={() => setGroup(null)}>‹ All groups</button>
              {shownGroup.categories.map(c => <button type="button" key={c.name} className={"pk-item" + (c.name === value ? " on" : "")} onClick={() => pick(c.name)}><span><b>{c.name}</b>{c.brands.length > 0 && <small>{c.brands.slice(0, 3).join(", ")}…</small>}</span></button>)}
            </>
          : <>
              {mine.length > 0 && <>
                <p className="pk-sec">Your categories</p>
                <div className="pk-chips">{mine.map(n => <button type="button" key={n} className={"pk-chip" + (n === value ? " on" : "")} onClick={() => pick(n)}>{n}</button>)}</div>
              </>}
              <p className="pk-sec">All categories</p>
              <div className="pk-groups">{CATALOG.map(g => <button type="button" key={g.group} className="pk-group" onClick={() => setGroup(g.group)}><span className="pk-ico big">{g.icon}</span><b>{g.group}</b><small>{g.categories.length} kinds</small></button>)}</div>
            </>}
        </div>
        <button type="button" className="pk-other-btn" onClick={() => setOther(true)}>Not in the list? <b>Other</b>, type a name</button>
      </>}
    </Sheet>}
  </>;
}

/** Brand: suggested brands for the chosen category, brands the company already uses, a search, and "Other". */
export function BrandPicker({ value, onChange, category, own = [] }: { value: string; onChange: (v: string) => void; category: string; own?: string[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [other, setOther] = useState(false);
  const suggested = brandsFor(category);
  const all = useMemo(() => [...new Set(ALL_CATEGORIES.flatMap(c => c.brands))].sort((a, b) => a.localeCompare(b)), []);
  const yours = own.filter(b => !suggested.some(s => norm(s) === norm(b)));
  const hits = q.trim() ? [...new Set([...own, ...all])].filter(b => norm(b).includes(norm(q))).slice(0, 40) : [];
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(""); setOther(false); };
  const close = () => { setOpen(false); setQ(""); setOther(false); };
  const chips = (list: string[]) => <div className="pk-chips">{list.map(b => <button type="button" key={b} className={"pk-chip" + (norm(b) === norm(value) ? " on" : "")} onClick={() => pick(b)}>{b}</button>)}</div>;
  return <>
    <Field label="Brand" value={value} placeholder="Choose a brand" onOpen={() => setOpen(true)} onClear={() => onChange("")} />
    {open && <Sheet title={other ? "Other brand" : "Choose a brand"} onClose={close}>
      {other ? <OtherBox label="Brand name" initial={q} onUse={pick} /> : <>
        <input className="pk-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search brands" aria-label="Search brands" autoFocus />
        <div className="pk-list">
          {q.trim() ? (hits.length ? chips(hits) : <p className="pk-none">No brand called &quot;{q}&quot; yet. Use <b>Other</b> below to add it.</p>) : <>
            {suggested.length > 0 && <><p className="pk-sec">Popular in {category}</p>{chips(suggested)}</>}
            {yours.length > 0 && <><p className="pk-sec">Brands you already sell</p>{chips(yours)}</>}
            {!suggested.length && !yours.length && <p className="pk-none">{category ? `No suggestions for ${category}.` : "Choose a category first for suggestions, or search."} Use <b>Other</b> below to type the brand.</p>}
            <button type="button" className="pk-item pk-nobrand" onClick={() => pick("")}><span><b>No brand</b><small>Loose or unbranded goods</small></span></button>
          </>}
        </div>
        <button type="button" className="pk-other-btn" onClick={() => setOther(true)}>Not in the list? <b>Other</b>, type a name</button>
      </>}
    </Sheet>}
  </>;
}
