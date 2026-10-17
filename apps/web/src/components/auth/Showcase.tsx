'use client';
import { useCallback, useEffect, useRef, useState } from "react";

/** The picture panel beside the sign-in and sign-up boxes: three small screens (stock, sales, goods on the way) that slide from one to the next.
 *  It pauses while the pointer or keyboard focus is on it, and stays on the first slide (with dots to switch) for visitors who prefer less motion.
 *  Every figure is sample data and says so. */

type Glyph = "sack" | "carton" | "bottle" | "tin" | "bag" | "pipe";
const TILE: Record<Glyph, string> = { sack: "#C9953F", carton: "#2563EB", bottle: "#16A34A", tin: "#B23B3B", bag: "#7C3AED", pipe: "#0891B2" };

function ProductTile({ kind, size = 38 }: { kind: Glyph; size?: number }) {
  const c = TILE[kind];
  const art: Record<Glyph, React.ReactNode> = {
    sack: <path d="M14 12h20l-2 4c4 3 6 8 6 14 0 7-5 10-14 10S10 37 10 30c0-6 2-11 6-14z" fill="#fff" opacity=".92" />,
    carton: <><path d="M10 18l14-7 14 7v16l-14 7-14-7z" fill="#fff" opacity=".92" /><path d="M10 18l14 7 14-7M24 25v16" stroke={c} strokeWidth="2" fill="none" /></>,
    bottle: <path d="M20 8h8v6c4 2 6 6 6 10v16H14V24c0-4 2-8 6-10z" fill="#fff" opacity=".92" />,
    tin: <><rect x="12" y="12" width="24" height="28" rx="4" fill="#fff" opacity=".92" /><path d="M12 18h24M12 34h24" stroke={c} strokeWidth="2" /></>,
    bag: <><path d="M12 18h24l-2 22H14z" fill="#fff" opacity=".92" /><path d="M18 18a6 6 0 0112 0" stroke="#fff" strokeWidth="2.5" fill="none" /></>,
    pipe: <><rect x="8" y="20" width="32" height="10" rx="5" fill="#fff" opacity=".92" /><ellipse cx="38" cy="25" rx="3" ry="5" fill={c} opacity=".6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="sc-tile"><rect width="48" height="48" rx="11" fill={c} />{art[kind]}</svg>;
}

function StockSlide() {
  const rows: [Glyph, string, string, number, "ok" | "low" | "out"][] = [
    ["sack", "Cement 50kg", "Tema", 0, "out"], ["bag", "Rice 25kg", "Accra", 14, "low"], ["tin", "Paint 20L white", "Kumasi", 64, "ok"], ["pipe", "PVC pipe 4in", "Accra", 210, "ok"],
  ];
  return (
    <div className="sc-screen">
      <div className="sc-head"><b>Stock by branch</b><span className="sc-chip warn">2 need restocking</span></div>
      <div className="sc-kpis"><div><small>Products</small><strong>248</strong></div><div><small>Stock value</small><strong>GH₵ 412k</strong></div><div><small>Branches</small><strong>3</strong></div></div>
      <ul className="sc-list">
        {rows.map(([g, n, b, q, l]) => (
          <li key={n}><ProductTile kind={g} size={34} /><div><b>{n}</b><small>{b} branch</small></div><span className="sc-qty">{q}</span><span className={`sc-pill ${l}`}>{l === "out" ? "Out" : l === "low" ? "Low" : "In stock"}</span></li>
        ))}
      </ul>
    </div>
  );
}

function SalesSlide() {
  const pts = [22, 26, 24, 31, 29, 36, 34, 41, 38, 46, 44, 52];
  const W = 300, H = 84, max = 58, step = W / (pts.length - 1);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(H - (v / max) * H).toFixed(1)}`).join(" ");
  return (
    <div className="sc-screen">
      <div className="sc-head"><b>Sales this month</b><span className="sc-chip ok">▲ 14% on last month</span></div>
      <div className="sc-kpis"><div><small>Sales</small><strong>GH₵ 86,240</strong></div><div><small>Invoices</small><strong>312</strong></div><div><small>Unpaid</small><strong>GH₵ 6,100</strong></div></div>
      <svg className="sc-chart" viewBox={`0 0 ${W} ${H + 6}`} aria-hidden="true">
        {[0.33, 0.66].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(157,184,255,.18)" />)}
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="rgba(76,121,255,.22)" />
        <path d={line} fill="none" stroke="#8FB0FF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <ul className="sc-list compact">
        <li><ProductTile kind="carton" size={30} /><div><b>INV-00231 · Kwame Trading</b><small>40 × Cement 50kg, 12 × PVC pipe</small></div><span className="sc-pill ok">Paid</span></li>
        <li><ProductTile kind="bottle" size={30} /><div><b>INV-00230 · Adjoa Stores</b><small>Cooking oil 5L × 24</small></div><span className="sc-pill low">Credit</span></li>
      </ul>
    </div>
  );
}

function TrackingSlide() {
  const steps = ["Requested", "Approved", "On the road", "Received"];
  return (
    <div className="sc-screen">
      <div className="sc-head"><b>Goods on the way</b><span className="sc-chip">TRF-0042</span></div>
      <div className="sc-route">
        <div><small>From</small><b>Accra warehouse</b></div>
        <div className="sc-road" aria-hidden="true"><i /><svg viewBox="0 0 64 32" className="sc-truck"><rect x="2" y="6" width="34" height="18" rx="3" fill="#EAF1FF" /><path d="M36 11h12l8 8v5H36z" fill="#4C79FF" /><circle cx="14" cy="26" r="4.5" fill="#0B1B3E" stroke="#EAF1FF" strokeWidth="1.5" /><circle cx="46" cy="26" r="4.5" fill="#0B1B3E" stroke="#EAF1FF" strokeWidth="1.5" /></svg></div>
        <div className="r"><small>To</small><b>Kumasi branch</b></div>
      </div>
      <ol className="sc-steps">{steps.map((s, i) => <li key={s} className={i < 2 ? "done" : i === 2 ? "now" : ""}><span>{i < 2 ? "✓" : i + 1}</span>{s}</li>)}</ol>
      <ul className="sc-list compact">
        <li><ProductTile kind="sack" size={30} /><div><b>Cement 50kg</b><small>Dispatched 120 · arrives tomorrow</small></div><span className="sc-qty">120</span></li>
        <li><ProductTile kind="tin" size={30} /><div><b>Paint 20L white</b><small>Dispatched 30</small></div><span className="sc-qty">30</span></li>
      </ul>
    </div>
  );
}

const SLIDES = [
  { key: "stock", title: "Know what is on every shelf", text: "Live stock for each branch, with pictures, low-stock warnings and what to reorder.", body: <StockSlide /> },
  { key: "sales", title: "Every sale, every cedi", text: "Invoices, payments and money still owed, totalled for you each day.", body: <SalesSlide /> },
  { key: "track", title: "Track goods on the move", text: "See stock leave one branch and arrive at another, and what suppliers still owe you.", body: <TrackingSlide /> },
];

export default function Showcase() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => { setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    if (paused || still) return;
    const t = setTimeout(() => setI((n) => (n + 1) % SLIDES.length), 6000);
    return () => clearTimeout(t);
  }, [i, paused, still]);
  const go = useCallback((n: number) => setI((n + SLIDES.length) % SLIDES.length), []);
  return (
    <section className="sc" ref={host} aria-roledescription="carousel" aria-label="What WHOLESTRA does"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={(e) => { if (!host.current?.contains(e.relatedTarget as Node)) setPaused(false); }}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(i + 1); if (e.key === "ArrowLeft") go(i - 1); }}>
      <div className="sc-viewport">
        <div className="sc-track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {SLIDES.map((s, n) => (
            <div key={s.key} className="sc-slide" role="group" aria-roledescription="slide" aria-label={`${n + 1} of ${SLIDES.length}: ${s.title}`} aria-hidden={n !== i}>
              <div className="sc-frame">{s.body}<span className="sc-sample">Sample data</span></div>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="sc-dots" role="tablist" aria-label="Choose a slide">
        {SLIDES.map((s, n) => (
          <button key={s.key} type="button" role="tab" aria-selected={n === i} aria-label={s.title} className={n === i ? "on" : ""} onClick={() => go(n)}>
            {n === i && !paused && !still && <i key={i} />}
          </button>
        ))}
      </div>
    </section>
  );
}
