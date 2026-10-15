'use client';
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getSessionUser, SessionUser } from "../lib/session";
import { useTheme } from "../hooks/useTheme";
import { api } from "../lib/api";

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
    { href: "/suppliers", label: "Suppliers", permission: "SUPPLIERS:READ" }
  ] },
  { kind: "link", icon: "coins", item: { href: "/finance", label: "Finance", permission: "RECONCILIATION:READ|EXPENSES:READ|DEPOSITS:READ|VARIANCE_CASES:READ|BRANCH_CLOSING:READ" } },
  { kind: "link", icon: "sheet", item: { href: "/imports", label: "Excel Import", permission: "EXCEL_IMPORT:READ" } },
  { kind: "link", icon: "shield", item: { href: "/audit", label: "Audit & Fraud Signals", permission: "AUDIT:READ" } },
  { kind: "group", icon: "gear", label: "Administration", items: [
    { href: "/organization", label: "Organization", permission: "ORGANIZATION:READ" },
    { href: "/regions", label: "Regions", permission: "REGIONS:READ" },
    { href: "/branches", label: "Branches", permission: "BRANCHES:READ" },
    { href: "/users", label: "Users", permission: "USERS:READ" },
    { href: "/roles", label: "Roles", permission: "ROLES:READ" }
  ] }
];

const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  cart: "M3 4h2l2.4 11h10.2l2-8H6.2M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z",
  bag: "M5 8h14l-1 12H6L5 8zM9 8a3 3 0 016 0",
  coins: "M12 3a8 8 0 100 16 8 8 0 000-16zM12 7v8M9.5 10c0-1 1-1.6 2.5-1.6s2.5.6 2.5 1.6-1 1.5-2.5 1.7-2.5.7-2.5 1.700 1 1.600 2.500 1.600 2.500-.6 2.500-1.600",
  sheet: "M6 3h9l4 4v14H6V3zM14 3v5h5M9 13h6M9 17h6",
  shield: "M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-2-4-2 .7-1.500-1L15 4h-4l-.5 2.700-1.500 1L7 7l-2 4 2 1v2l-2 1 2 4 2-.7 1.500 1L11 20h4l.5-2.700 1.500-1 2 .7 2-4-2-1v-2z"
};
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
  useEffect(() => { api.get("/health").then(() => setOnline(true)).catch(() => setOnline(false)); }, []);

  useEffect(() => {
    const u = getSessionUser();
    if (!u) { router.replace("/login"); return; }
    setUser(u);
  }, [router]);

  function signOut() { clearSession(); router.replace("/login"); }

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const allowed = (item: Item) => !item.permission || item.permission.split("|").some(p => user?.permissions.includes(p));
  const visibleNav = NAV.map(e => e.kind === "link" ? (allowed(e.item) ? e : null) : { ...e, items: e.items.filter(allowed) })
    .filter((e): e is Entry => !!e && (e.kind === "link" || e.items.length > 0));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="mark small"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS.box} /></svg></span><span className="brand-text"><strong>WholesalePro</strong><small>Management System</small></span></div>
        <nav className="sidebar-nav-scroll">
          {visibleNav.map(e => {
            if (e.kind === "link") {
              return (
                <a key={e.item.href} href={e.item.href} className={"nav-row" + (pathname === e.item.href ? " active" : "")}>
                  <Icon name={e.icon} /><span>{e.item.label}</span>
                </a>
              );
            }
            const hasActive = e.items.some(i => pathname === i.href);
            const isOpen = open[e.label] ?? hasActive;
            return (
              <div key={e.label} className="nav-group">
                <button type="button" className={"nav-row nav-head" + (hasActive ? " has-active" : "")} onClick={() => setOpen({ ...open, [e.label]: !isOpen })} aria-expanded={isOpen}>
                  <Icon name={e.icon} /><span>{e.label}</span><span className={"chev" + (isOpen ? " open" : "")}>▸</span>
                </button>
                {isOpen && (
                  <div className="nav-sub">
                    {e.items.map(i => (
                      <a key={i.href} href={i.href} className={pathname === i.href ? "active" : ""}>{i.label}</a>
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
          <h1>{title}</h1>
          <div className="topbar-actions">
            {user && <div className="user-chip"><span className="avatar">{(user.name || "?").slice(0, 1).toUpperCase()}</span><span className="who-text"><strong>{user.name}</strong><span>{user.roles?.[0] ?? user.branch ?? ""}</span></span></div>}
            <button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode" title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button className="secondary" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
