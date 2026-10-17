'use client';
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getSessionUser, SessionUser } from "../lib/session";
import { useTheme } from "../hooks/useTheme";
import { api } from "../lib/api";
import { useNotifications } from "../hooks/useNotifications";
import CommandPalette, { Cmd } from "./CommandPalette";
import ToastHost from "./ToastHost";
import Avatar from "./Avatar";
import Logo from "./Logo";
import ProfileModal, { Profile } from "./ProfileModal";
import ContactBlock from "./ContactBlock";
import "./app-extra.css";

type Item = { href: string; label: string; permission: string | null };
type Entry = { kind: "link"; icon: string; item: Item } | { kind: "group"; icon: string; label: string; items: Item[] };

const NAV: Entry[] = [
  { kind: "link", icon: "home", item: { href: "/dashboard", label: "Home", permission: null } },
  { kind: "group", icon: "box", label: "Inventory", items: [
    { href: "/products", label: "Products", permission: "PRODUCTS:READ" },
    { href: "/categories", label: "Categories", permission: "CATEGORIES:READ" },
    { href: "/brands", label: "Brands", permission: "BRANDS:READ" },
    { href: "/units", label: "Units", permission: "UNITS:READ" },
    { href: "/inventory", label: "Stock Levels", permission: "INVENTORY:READ" },
    { href: "/stock-adjustments", label: "Stock Adjustments", permission: "STOCK_ADJUSTMENTS:READ" },
    { href: "/stock-transfers", label: "Stock Transfers", permission: "STOCK_TRANSFERS:READ" },
    { href: "/stock-counts", label: "Stock Counts", permission: "STOCK_COUNTS:READ" }
  ] },
  { kind: "group", icon: "cart", label: "Sales", items: [
    { href: "/sales", label: "Sales & Invoices", permission: "SALES:READ" },
    { href: "/customers", label: "Customers", permission: "CUSTOMERS:READ" }
  ] },
  { kind: "group", icon: "bag", label: "Purchases", items: [
    { href: "/purchase-orders", label: "Purchase Orders", permission: "PURCHASING:READ" },
    { href: "/reorder", label: "Reorder Suggestions", permission: "PURCHASING:READ" },
    { href: "/suppliers", label: "Suppliers", permission: "SUPPLIERS:READ" }
  ] },
  { kind: "link", icon: "coins", item: { href: "/finance", label: "Finance", permission: "RECONCILIATION:READ|EXPENSES:READ|DEPOSITS:READ|VARIANCE_CASES:READ|BRANCH_CLOSING:READ" } },
  { kind: "link", icon: "trend", item: { href: "/insights", label: "Investment Insights", permission: "PROFIT:READ" } },
  { kind: "link", icon: "sheet", item: { href: "/imports", label: "Excel Import", permission: "EXCEL_IMPORT:READ" } },
  { kind: "link", icon: "shield", item: { href: "/audit", label: "Audit & Fraud Signals", permission: "AUDIT:READ" } },
  { kind: "group", icon: "gear", label: "Administration", items: [
    { href: "/settings", label: "All settings", permission: null },
    { href: "/organization", label: "Organization", permission: "ORGANIZATION:READ" },
    { href: "/regions", label: "Regions", permission: "REGIONS:READ" },
    { href: "/branches", label: "Branches", permission: "BRANCHES:READ" },
    { href: "/users", label: "Users", permission: "USERS:READ" },
    { href: "/roles", label: "Roles", permission: "ROLES:READ" }
  ] },
  { kind: "link", icon: "gift", item: { href: "/referrals", label: "Refer & earn", permission: null } }
];

/** The "+" menu in the top bar, grouped like the sidebar. Each item shows only for people allowed to create that thing. */
const QUICK: { group: string; items: { label: string; href: string; permission: string }[] }[] = [
  { group: "General", items: [
    { label: "Product", href: "/products?new=1", permission: "PRODUCTS:CREATE" },
    { label: "User", href: "/users?new=1", permission: "USERS:CREATE" },
    { label: "Branch", href: "/branches?new=1", permission: "BRANCHES:CREATE" },
  ] },
  { group: "Inventory", items: [
    { label: "Stock adjustment", href: "/stock-adjustments?new=1", permission: "STOCK_ADJUSTMENTS:CREATE" },
    { label: "Stock transfer", href: "/stock-transfers?new=1", permission: "STOCK_TRANSFERS:CREATE" },
    { label: "Stock count", href: "/stock-counts?new=1", permission: "STOCK_COUNTS:CREATE" },
  ] },
  { group: "Sales", items: [
    { label: "Sale / invoice", href: "/sales?new=1", permission: "SALES:CREATE" },
    { label: "Customer", href: "/customers?new=1", permission: "CUSTOMERS:CREATE" },
  ] },
  { group: "Purchases", items: [
    { label: "Purchase order", href: "/purchase-orders?new=1", permission: "PURCHASING:CREATE" },
    { label: "Supplier", href: "/suppliers?new=1", permission: "SUPPLIERS:CREATE" },
    { label: "Expense", href: "/finance?tab=expenses&new=1", permission: "EXPENSES:CREATE" },
  ] },
];

const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  cart: "M3 4h2l2.4 11h10.2l2-8H6.2M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z",
  bag: "M5 8h14l-1 12H6L5 8zM9 8a3 3 0 016 0",
  coins: "M12 3a8 8 0 100 16 8 8 0 000-16zM12 7v8M9.5 10c0-1 1-1.6 2.5-1.6s2.5.6 2.5 1.6-1 1.5-2.5 1.7-2.5.7-2.5 1.700 1 1.600 2.500 1.600 2.500-.6 2.500-1.600",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  sheet: "M6 3h9l4 4v14H6V3zM14 3v5h5M9 13h6M9 17h6",
  gift: "M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7c-1.500-3-5-3.500-5-1.200C7 7 9 7 12 7zM12 7c1.500-3 5-3.500 5-1.200C17 7 15 7 12 7z",
  plus: "M12 5v14M5 12h14",
  shield: "M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-2-4-2 .7-1.500-1L15 4h-4l-.5 2.700-1.500 1L7 7l-2 4 2 1v2l-2 1 2 4 2-.7 1.500 1L11 20h4l.5-2.700 1.500-1 2 .7 2-4-2-1v-2z"
};
/** Friendly names for the built-in role codes; a company's own roles show their code as it is. */
const ROLE_NAMES: Record<string, string> = { SUPER_ADMIN: "Owner", ORGANIZATION_ADMIN: "Administrator", REGIONAL_MANAGER: "Regional manager", BRANCH_MANAGER: "Branch manager", SALES_USER: "Sales", INVENTORY_USER: "Inventory", DEMO_VIEWER: "Demo viewer" };
const roleName = (code?: string) => (code ? ROLE_NAMES[code] ?? code.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "");

function Icon({ name }: { name: string }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const { theme, toggle } = useTheme();
  const [online, setOnline] = useState<boolean | null>(null);
  const notes = useNotifications();
  const [bellOpen, setBellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  useEffect(() => {
    try { const c = sessionStorage.getItem("wms_profile"); if (c) setProfile(JSON.parse(c)); } catch { /* cache is optional */ }
    api.get<Profile>("/profile").then(p => { setProfile(p); try { sessionStorage.setItem("wms_profile", JSON.stringify(p)); } catch { /* ignore */ } }).catch(() => {});
  }, []);
  function profileSaved(p: Profile) {
    setProfile(p);
    try { sessionStorage.setItem("wms_profile", JSON.stringify(p)); const u = getSessionUser(); if (u) localStorage.setItem("wms_user", JSON.stringify({ ...u, name: p.name })); } catch { /* ignore */ }
    setUser(u => (u ? { ...u, name: p.name } : u));
  }
  const stockCount = notes.notices.filter(n => n.id === "out-of-stock" || n.id === "low-stock").reduce((t, n) => t + n.count, 0);
  const financeCount = notes.notices.filter(n => n.id === "pending-expenses" || n.id === "variance-cases").reduce((t, n) => t + n.count, 0);
  const badges: Record<string, number> = { "/reorder": stockCount, "/inventory": stockCount, "/finance": financeCount };
  useEffect(() => { api.get("/health").then(() => setOnline(true)).catch(() => setOnline(false)); }, []);

  useEffect(() => {
    const u = getSessionUser();
    if (!u) { router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    // a brand-new company fills in its profile first
    if (u.setupPending && !u.demo) { router.replace("/setup"); return; }
    setUser(u);
  }, [router]);

  // Tell the server first (so the Change log shows the sign-out), but never keep someone waiting more than a moment.
  function signOut() {
    const done = () => { clearSession(); router.replace("/login"); };
    Promise.race([api.post("/auth/logout").catch(() => undefined), new Promise(r => setTimeout(r, 1200))]).then(done, done);
  }

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const allowed = (item: Item) => !item.permission || item.permission.split("|").some(p => user?.permissions.includes(p));
  const visibleNav = NAV.map(e => e.kind === "link" ? (allowed(e.item) ? e : null) : { ...e, items: e.items.filter(allowed) })
    .filter((e): e is Entry => !!e && (e.kind === "link" || e.items.length > 0));

  const can = (p: string) => !!user?.permissions.includes(p);
  const quick = QUICK.map(g => ({ ...g, items: g.items.filter(i => can(i.permission)) })).filter(g => g.items.length);
  const commands: Cmd[] = [
    ...(can("SALES:CREATE") ? [{ id: "a-sale", label: "New sale", group: "Actions", href: "/sales?new=1" }] : []),
    ...(can("PRODUCTS:CREATE") ? [{ id: "a-product", label: "Add product", group: "Actions", href: "/products?new=1" }] : []),
    ...(can("PURCHASING:READ") ? [{ id: "a-reorder", label: "See what to reorder", group: "Actions", href: "/reorder" }] : []),
    ...visibleNav.flatMap(e => (e.kind === "link" ? [e.item] : e.items).map(i => ({ id: `p-${i.href}`, label: i.label, group: "Go to", href: i.href }))),
  ];
  const GO: Record<string, string> = { d: "/dashboard", s: "/sales", p: "/products", i: "/inventory", r: "/reorder", c: "/customers", f: "/finance", a: "/audit", e: "/insights" };

  useEffect(() => {
    let pendingG = 0;
    function onKey(ev: KeyboardEvent) {
      const t = ev.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); setPaletteOpen(o => !o); return; }
      if (typing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === "/") { ev.preventDefault(); setPaletteOpen(true); return; }
      if (ev.key === "?") { setHelpOpen(o => !o); return; }
      if (ev.key === "Escape") { setHelpOpen(false); setBellOpen(false); return; }
      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0;
        const href = GO[ev.key.toLowerCase()];
        if (href && commands.some(c => c.href === href)) { ev.preventDefault(); router.push(href); }
        return;
      }
      if (ev.key.toLowerCase() === "g") pendingG = Date.now();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bound each render so it always sees the current permissions

  return (
    <div className="app">
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={"sidebar" + (navOpen ? " open" : "")}>
        <div className="brand"><Logo size={38} /></div>
        {user?.organization && (
          <div className="org-badge" title="Every record here belongs to this company only">
            <small>{user.demo ? "Demo company" : "Company"}</small>
            <strong>{user.organization}</strong>
            {user.demo && <em>Sample data, read-only</em>}
          </div>
        )}
        <nav className="sidebar-nav-scroll">
          {visibleNav.map(e => {
            if (e.kind === "link") {
              return (
                <a key={e.item.href} href={e.item.href} className={"nav-row" + (pathname === e.item.href ? " active" : "")}>
                  <Icon name={e.icon} /><span>{e.item.label}</span>{badges[e.item.href] ? <span className="nbadge">{badges[e.item.href]}</span> : null}
                </a>
              );
            }
            const hasActive = e.items.some(i => pathname === i.href);
            const isOpen = open[e.label] ?? hasActive;
            return (
              <div key={e.label} className="nav-group">
                <button type="button" className={"nav-row nav-head" + (hasActive ? " has-active" : "")} onClick={() => setOpen({ ...open, [e.label]: !isOpen })} aria-expanded={isOpen}>
                  <Icon name={e.icon} /><span>{e.label}</span>{!isOpen && e.items.some(i => badges[i.href]) && <span className="ndot" />}<span className={"chev" + (isOpen ? " open" : "")}>▸</span>
                </button>
                {isOpen && (
                  <div className="nav-sub">
                    {e.items.map(i => (
                      <a key={i.href} href={i.href} className={pathname === i.href ? "active" : ""}>{i.label}{badges[i.href] ? <span className="nbadge">{badges[i.href]}</span> : null}</a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sys-status"><span className={"dot " + (online === null ? "" : online ? "on" : "off")} /><span>{online === null ? "Checking..." : online ? "System online" : "System offline"}</span></div>
      </aside>

      <div className="content">
        <header className="topbar">
          <button type="button" className="menu-btn" onClick={() => setNavOpen(o => !o)} aria-label="Open menu" aria-expanded={navOpen}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <h1>{title}</h1>
          <button type="button" className="search-bar" onClick={() => setPaletteOpen(true)} aria-label="Search (Ctrl+K)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <span className="search-ph">Search products, invoices, customers...</span><kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-actions">
            {user?.organization && <span className="org-chip" title="Your company">{user.organization}</span>}
            {quick.length > 0 && (
              <div className="bell-wrap">
                <button type="button" className="quick-btn" onClick={() => setQuickOpen(o => !o)} aria-haspopup="menu" aria-expanded={quickOpen} aria-label="Create new" title="Create new">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d={ICONS.plus} /></svg>
                </button>
                {quickOpen && <>
                  <div className="bell-backdrop" onClick={() => setQuickOpen(false)} />
                  <div className="quick-menu" role="menu" aria-label="Create new">
                    {quick.map(g => (
                      <div key={g.group} className="quick-col">
                        <div className="quick-h">{g.group}</div>
                        {g.items.map(i => <a key={i.href} href={i.href} role="menuitem" onClick={() => setQuickOpen(false)}><span aria-hidden="true">+</span>{i.label}</a>)}
                      </div>
                    ))}
                  </div>
                </>}
              </div>
            )}
            <div className="bell-wrap">
              <button type="button" className="theme-toggle bell" onClick={() => setBellOpen(o => !o)} aria-label={`Notifications${notes.badgeCount ? `, ${notes.badgeCount} need attention` : ""}`} title="Notifications">
                🔔{notes.badgeCount > 0 && <span className="bell-badge">{notes.badgeCount}</span>}
              </button>
              {bellOpen && <>
                <div className="bell-backdrop" onClick={() => setBellOpen(false)} />
                <div className="bell-panel" role="dialog" aria-label="Notifications">
                  <div className="bell-head">Needs your attention</div>
                  {notes.notices.length === 0 && <div className="bell-empty">All clear. Nothing needs attention right now.</div>}
                  {notes.notices.map(n => (
                    <a key={n.id} href={n.href} className={"bell-item " + n.severity} onClick={() => setBellOpen(false)}>
                      <span className="bell-dot" />
                      <span><strong>{n.title}</strong><small>{n.detail}</small></span>
                    </a>
                  ))}
                </div>
              </>}
            </div>
            {user && (
              <div className="user-wrap">
                <button type="button" className="user-chip" onClick={() => setMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>
                  <Avatar avatar={profile?.avatar} name={profile?.name ?? user.name} size={36} />
                  <span className="who-text"><strong>{profile?.name ?? user.name}</strong><span>{roleName(user.roles?.[0]) || user.branch || ""}</span></span>
                  <span className="chev-d">▾</span>
                </button>
                {menuOpen && <>
                  <div className="bell-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="user-menu" role="menu">
                    {user.organization && <div className="user-menu-org"><small>Company</small><strong>{user.organization}</strong></div>}
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setProfileOpen(true); }}>My profile</button>
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); router.push("/settings/security"); }}>Sign-in & security</button>
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setHelpOpen(true); }}>Keyboard shortcuts</button>
                    <button type="button" role="menuitem" className="danger" onClick={signOut}>Sign out</button>
                  </div>
                </>}
              </div>
            )}
            <a href="/settings" className={"theme-toggle gear" + (pathname?.startsWith("/settings") ? " on" : "")} aria-label="Settings" title="Settings">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS.gear} /></svg>
            </a>
            <button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode" title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </header>
        {user?.demo && (
          <div className="demo-bar" role="status">
            <span className="demo-tag">Demo account</span>
            <span>{user.demoFor ? <>Welcome, <b>{user.demoFor}</b>. </> : null}You are looking around a sample company. Everything is read-only, and the data is not real.</span>
            <a href="/get-started" onClick={() => clearSession()}>Sign up now, it&apos;s free →</a>
          </div>
        )}
        {user && !user.demo && /\.(local|localhost|test|invalid)$/i.test(user.email) && !pathname?.startsWith("/settings/security") && (
          <div className="demo-bar warn-bar" role="alert">
            <span className="demo-tag">Action needed</span>
            <span>Your sign-in email <b>{user.email}</b> is not a real inbox. Sign-in codes are sent by email, so change it to an address you can open.</span>
            <a href="/settings/security">Change email →</a>
          </div>
        )}
        <main className="page">{children}</main>
        <ContactBlock variant="footer" />
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <ToastHost />
      {(profileOpen || !!profile?.mustChangePassword) && profile && <ProfileModal profile={profile} forced={!!profile.mustChangePassword} onClose={() => setProfileOpen(false)} onSaved={profileSaved} />}
      {helpOpen && (
        <div className="cmd-backdrop" onClick={() => setHelpOpen(false)}>
          <div className="cmd help" role="dialog" aria-label="Keyboard shortcuts" onClick={e => e.stopPropagation()}>
            <div className="bell-head">Keyboard shortcuts</div>
            <ul className="keys">
              <li><span>Search or jump anywhere</span><kbd>Ctrl K</kbd> <em>or</em> <kbd>/</kbd></li>
              <li><span>Go to Home, Sales, Products, Stock</span><kbd>g</kbd> <kbd>d</kbd> / <kbd>s</kbd> / <kbd>p</kbd> / <kbd>i</kbd></li>
              <li><span>Go to Reorder, Customers, Finance</span><kbd>g</kbd> <kbd>r</kbd> / <kbd>c</kbd> / <kbd>f</kbd></li>
              <li><span>Go to Audit, Investment Insights</span><kbd>g</kbd> <kbd>a</kbd> / <kbd>e</kbd></li>
              <li><span>Show or hide this help</span><kbd>?</kbd></li>
              <li><span>Close any panel</span><kbd>Esc</kbd></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
