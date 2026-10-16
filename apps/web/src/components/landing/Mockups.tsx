import { LogoMark } from "../Logo";

/** Small pictures of the real screens, drawn in HTML so they stay sharp and follow the theme. All figures are sample data and are labelled as such. */

const DAYS = [18, 22, 19, 27, 25, 31, 29, 34, 30, 38, 36, 41, 39, 46];

function trend(w: number, h: number) {
  const max = Math.max(...DAYS) * 1.1, step = w / (DAYS.length - 1);
  const pts = DAYS.map((v, i) => [i * step, h - (v / max) * h] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w} ${h} L0 ${h} Z`, last: pts[pts.length - 1] };
}

export function HeroMock() {
  const W = 420, H = 130, t = trend(W, H);
  return (
    <figure className="lp-window" aria-label="Example of the WHOLESTRA dashboard, with sample data">
      <div className="lp-window-bar"><i /><i /><i /><span>Dashboard</span></div>
      <div className="lp-window-body">
        <aside className="lp-side" aria-hidden="true">
          <b><LogoMark size={26} /></b>
          {["Dashboard", "Sales", "Inventory", "Purchases", "Finance", "Audit"].map((n, i) => <span key={n} className={i === 0 ? "on" : ""}>{n}</span>)}
        </aside>
        <div className="lp-main">
          <div className="lp-kpis">
            <div><small>Sales today</small><strong>GH₵ 48,260</strong><em className="up">▲ 12% vs yesterday</em></div>
            <div><small>Gross profit</small><strong>GH₵ 9,140</strong><em className="up">▲ 4% margin</em></div>
            <div><small>Needs attention</small><strong>7 items</strong><em className="warn">3 out of stock</em></div>
          </div>
          <div className="lp-chart">
            <small>Sales, last 14 days</small>
            <svg viewBox={`0 0 ${W} ${H + 8}`} role="img" aria-label="Sales rising over 14 days">
              <defs><linearGradient id="lpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--lp-blue)" stopOpacity=".35" /><stop offset="1" stopColor="var(--lp-blue)" stopOpacity="0" /></linearGradient></defs>
              {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--lp-line)" strokeWidth="1" />)}
              <path d={t.area} fill="url(#lpg)" />
              <path d={t.line} fill="none" stroke="var(--lp-blue)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={t.last[0]} cy={t.last[1]} r="5" fill="var(--lp-blue)" stroke="var(--lp-card)" strokeWidth="2" />
            </svg>
          </div>
          <div className="lp-rows">
            <div><span className="dot bad" />Cement 50kg<em>Out of stock · Tema branch</em></div>
            <div><span className="dot mid" />Roofing nails 3in<em>Low · 12 left</em></div>
          </div>
        </div>
      </div>
      <figcaption>Sample data</figcaption>
    </figure>
  );
}

export function StockMock() {
  const rows = [
    ["Cement 50kg", "Tema", "0", "bad", "Out"],
    ["Roofing nails 3in", "Accra", "12", "mid", "Low"],
    ["Paint 20L white", "Kumasi", "64", "ok", "OK"],
    ["PVC pipe 4in", "Accra", "210", "ok", "OK"],
  ];
  return (
    <figure className="lp-card-mock" aria-label="Example stock list with sample data">
      <div className="lp-mock-head"><b>Stock by branch</b><span>Reorder suggestions: 5</span></div>
      <table><thead><tr><th>Product</th><th>Branch</th><th>On hand</th><th /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><span className={`lp-pill ${r[3]}`}>{r[4]}</span></td></tr>)}</tbody></table>
      <figcaption>Sample data</figcaption>
    </figure>
  );
}

export function SealMock() {
  const rows = [
    ["#128", "Ama (Branch Manager)", "Changed Cement 50kg price", "GH₵ 92 → GH₵ 95"],
    ["#127", "Kofi (Inventory)", "Stock adjustment, Tema", "40 → 36 · damaged"],
    ["#126", "Owner", "Signed in", "Chrome on Windows · Inside your own network"],
  ];
  return (
    <figure className="lp-card-mock" aria-label="Example change log with sample data">
      <div className="lp-mock-head"><b>Change log</b><span className="lp-ok">✓ The log is intact</span></div>
      <ul className="lp-log">{rows.map((r) => <li key={r[0]}><span className="lp-seal">🔒 {r[0]}</span><div><b>{r[2]}</b><small>{r[1]}</small><em>{r[3]}</em></div></li>)}</ul>
      <figcaption>Sample data</figcaption>
    </figure>
  );
}

export function ApprovalMock() {
  return (
    <figure className="lp-card-mock" aria-label="Example expense approval with sample data">
      <div className="lp-mock-head"><b>Expenses to review</b><span>Your limit: GH₵ 500</span></div>
      <div className="lp-exp"><div><b>Fuel for delivery van</b><small>Accra · entered by Ama</small></div><strong>GH₵ 320</strong><span className="lp-btns"><i>Approve</i><i>Reject</i></span></div>
      <div className="lp-exp"><div><b>Generator repair</b><small>Accra · entered by Ama</small></div><strong>GH₵ 1,800</strong><span className="lp-note">Above your limit. The owner approves this one.</span></div>
      <figcaption>Sample data</figcaption>
    </figure>
  );
}
