'use client';
import { useRef, useState, type PointerEvent } from "react";

const BRANCHES = ["Accra", "Kumasi", "Tema"];
const PRODUCTS = [
  { name: "Cement 50kg", short: "Cement", price: 95 },
  { name: "Paint 20L white", short: "Paint", price: 420 },
  { name: "PVC pipe 4in", short: "PVC pipe", price: 60 },
  { name: "Roofing nails 3in", short: "Nails", price: 180 },
  { name: "Rice 25kg", short: "Rice", price: 310 },
];
const START = [[4, 3, 5, 3, 4], [3, 4, 2, 3, 2], [0, 3, 4, 1, 3]];
const money = (n: number) => "GH₵ " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const level = (n: number) => (n === 0 ? "out" : n <= 2 ? "low" : "ok");

/** The memorable bit of the home page: a small, working stock board. Hover to scan, click a stack to sell one carton, and watch the alerts and the day's takings change. Everything is sample data and nothing is saved. */
export default function ScanBoard() {
  const [stock, setStock] = useState(START.map((r) => [...r]));
  const [sold, setSold] = useState({ units: 0, cedis: 0 });
  const [pulse, setPulse] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function sell(b: number, p: number) {
    if (stock[b][p] === 0) return;
    setStock(stock.map((r, i) => (i === b ? r.map((v, j) => (j === p ? v - 1 : v)) : r)));
    setSold({ units: sold.units + 1, cedis: sold.cedis + PRODUCTS[p].price });
    setPulse(`${b}-${p}-${sold.units}`);
    clearTimeout(timer.current); timer.current = setTimeout(() => setPulse(null), 900);
  }
  function restock() { setStock(START.map((r) => [...r])); setSold({ units: 0, cedis: 0 }); }
  function track(e: PointerEvent) {
    const g = grid.current; if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty("--by", `${Math.max(0, Math.min(r.height, e.clientY - r.top))}px`);
  }

  const alerts: { tone: "out" | "low"; text: string }[] = [];
  stock.forEach((row, b) => row.forEach((n, p) => {
    if (n === 0) alerts.push({ tone: "out", text: `${PRODUCTS[p].name} is out in ${BRANCHES[b]}` });
    else if (n <= 2) alerts.push({ tone: "low", text: `${PRODUCTS[p].name} is low in ${BRANCHES[b]}, ${n} left` });
  }));
  alerts.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "out" ? -1 : 1));

  return (
    <section className="sb" aria-label="Interactive example of a stock board with sample data">
      <header className="sb-top">
        <div><b>Stock by branch</b><small>Sample data. Click a stack to sell one carton.</small></div>
        <button type="button" onClick={restock} disabled={sold.units === 0}>Restock</button>
      </header>
      <div className="sb-grid" ref={grid} onPointerMove={track}>
        <div className="sb-sweep" aria-hidden="true" />
        <div className="sb-beam" aria-hidden="true" />
        {BRANCHES.map((br, b) => (
          <div className="sb-row" key={br}>
            <div className="sb-branch"><b>{br}</b><small>{stock[b].reduce((a, c) => a + c, 0)} cartons</small></div>
            <div className="sb-cells">
              {PRODUCTS.map((pr, p) => {
                const n = stock[b][p], lv = level(n), id = `${b}-${p}`;
                return (
                  <button type="button" key={pr.name} className={`sb-cell ${lv}${pulse?.startsWith(id + "-") ? " pulse" : ""}`} onClick={() => sell(b, p)} disabled={n === 0}
                    aria-label={`${pr.name}, ${br}: ${n === 0 ? "out of stock" : n + " in stock. Sell one"}`}>
                    <span className="sb-stack" aria-hidden="true">
                      {n === 0 ? <em>Out</em> : Array.from({ length: n }, (_, k) => <i key={k} className="sb-box" style={{ ["--t" as string]: k % 3 }} />)}
                    </span>
                    <span className="sb-name">{pr.short}</span>
                    <span className="sb-tip" aria-hidden="true"><b>{pr.name}</b>{br} · {n} on hand<br />{money(pr.price)} each</span>
                    {pulse?.startsWith(id + "-") && <span className="sb-plus" aria-hidden="true">+{money(pr.price)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <footer className="sb-foot">
        <ul className="sb-alerts" aria-live="polite" aria-label="Alerts">
          {alerts.slice(0, 3).map((a) => <li key={a.text} className={a.tone}><i />{a.text}</li>)}
          {alerts.length > 3 && <li className="more">and {alerts.length - 3} more</li>}
          {alerts.length === 0 && <li className="ok"><i />Everything is stocked</li>}
        </ul>
        <div className="sb-sold"><small>Sold in this demo</small><b>{money(sold.cedis)}</b><span>{sold.units} {sold.units === 1 ? "carton" : "cartons"}</span></div>
      </footer>
    </section>
  );
}
