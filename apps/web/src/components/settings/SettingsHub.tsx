'use client';
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { SECTIONS } from "./catalog";
import { getSessionUser } from "../../lib/session";

/** "All settings": every place where something is set up, grouped into tiles. Links someone may not open are left out; planned ones are marked "Soon". */
export default function SettingsHub() {
  const [perms, setPerms] = useState<string[] | null>(null);
  const [org, setOrg] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const u = getSessionUser(); setPerms(u?.permissions ?? []); setOrg(u?.organization ?? ""); }, []);
  const sections = useMemo(() => {
    const term = q.trim().toLowerCase();
    return SECTIONS.map((s) => ({
      ...s,
      groups: s.groups.map((g) => ({
        ...g,
        links: g.links.filter((l) => (!l.permission || perms?.includes(l.permission)) && (!term || `${g.title} ${l.label} ${l.hint ?? ""}`.toLowerCase().includes(term))),
      })).filter((g) => g.links.length),
    })).filter((s) => s.groups.length);
  }, [perms, q]);

  return (
    <AppShell title="All settings">
      <div className="st-head">
        <div><h1>All settings</h1><p>{org || "Your company"}</p></div>
        <label className="st-search"><span className="sr-only">Search settings</span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings" />
        </label>
      </div>
      {perms && sections.length === 0 && <p className="empty">No settings match “{q}”.</p>}
      {perms && sections.map((s) => (
        <section key={s.title} className="st-sec">
          <h2>{s.title}</h2>
          <div className="st-grid">
            {s.groups.map((g) => (
              <article key={g.title} className="st-tile">
                <h3><span aria-hidden="true">{g.icon}</span>{g.title}</h3>
                <ul>{g.links.map((l) => (
                  <li key={l.label}><Link href={l.href}>{l.label}{l.soon && <em className="st-soon">Soon</em>}</Link>{l.hint && <small>{l.hint}</small>}</li>
                ))}</ul>
              </article>
            ))}
          </div>
        </section>
      ))}
    </AppShell>
  );
}
