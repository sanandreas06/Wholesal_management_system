'use client';
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

export interface Cmd { id: string; label: string; sub?: string; group: string; href: string }
interface Hit { id: string; label: string; sub: string; href: string }
interface Found { products: Hit[]; customers: Hit[]; sales: Hit[]; suppliers: Hit[] }

const GROUPS: [keyof Found, string][] = [["products", "Products"], ["sales", "Invoices"], ["customers", "Customers"], ["suppliers", "Suppliers"]];

/** Ctrl+K: jump to any page, start a common task, or search products, invoices, customers and suppliers. */
export default function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Cmd[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); setFound(null); setActive(0); setTimeout(() => input.current?.focus(), 20); } }, [open]);
  useEffect(() => {
    if (!open || q.trim().length < 2) { setFound(null); return; }
    const t = setTimeout(() => { api.get<Found>(`/search?q=${encodeURIComponent(q.trim())}`).then(setFound).catch(() => setFound(null)); }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const rows: Cmd[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const local = commands.filter(c => !needle || `${c.label} ${c.group} ${c.sub ?? ""}`.toLowerCase().includes(needle)).slice(0, needle ? 8 : 12);
    const remote: Cmd[] = found ? GROUPS.flatMap(([k, label]) => found[k].map(h => ({ id: `${k}-${h.id}`, label: h.label, sub: h.sub, group: label, href: h.href }))) : [];
    return [...local, ...remote];
  }, [q, commands, found]);

  useEffect(() => { setActive(0); }, [rows.length]);
  if (!open) return null;

  function go(c: Cmd | undefined) { if (!c) return; onClose(); router.push(c.href); }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(rows.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(rows[active]); }
    else if (e.key === "Escape") onClose();
  }

  let last = "";
  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd" role="dialog" aria-label="Command palette" onClick={e => e.stopPropagation()} onKeyDown={onKey}>
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Search products, invoices, customers, or jump to a page..." aria-label="Search" />
        <div className="cmd-list">
          {rows.length === 0 && <div className="cmd-empty">{q.trim().length < 2 ? "Type to search." : "No matches."}</div>}
          {rows.map((c, i) => {
            const head = c.group !== last ? <div className="cmd-group">{c.group}</div> : null;
            last = c.group;
            return (
              <div key={c.id}>
                {head}
                <button type="button" className={"cmd-row" + (i === active ? " on" : "")} onMouseEnter={() => setActive(i)} onClick={() => go(c)}>
                  <span>{c.label}</span>{c.sub && <small>{c.sub}</small>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="cmd-foot"><span>↑↓ move</span><span>Enter open</span><span>Esc close</span></div>
      </div>
    </div>
  );
}
