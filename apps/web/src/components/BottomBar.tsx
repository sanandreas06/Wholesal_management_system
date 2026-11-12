'use client';
/**
 * On a phone, the five places people go most sit at the bottom of the screen, within reach of the thumb, with Scan raised in
 * the middle. Each tab follows the person's role: a store person's "Inventory" and middle button go where their work is, a
 * cashier's middle button opens the counter, and nobody sees a tab they are not allowed to open.
 */
type Tab = { href: string; label: string; icon: string; match: string[]; main?: boolean };
const P: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  scan: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13.5 8v8M17 8v8",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h3",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-2-4-2 .7-1.5-1L15 4h-4l-.5 2.7-1.5 1L7 7l-2 4 2 1v2l-2 1 2 4 2-.7 1.5 1L11 20h4l.5-2.7 1.5-1 2 .7 2-4-2-1v-2z",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5",
};

export function bottomTabs(can: (p: string) => boolean): Tab[] {
  const any = (s: string) => s.split("|").some(can);
  const tabs: Tab[] = [{ href: "/dashboard", label: "Home", icon: "home", match: ["/dashboard", "/summary"] }];
  if (can("PRODUCTS:READ") || can("INVENTORY:READ"))
    tabs.push({ href: can("PRODUCTS:READ") ? "/products" : "/inventory", label: "Inventory", icon: "box", match: ["/products", "/inventory", "/stock-adjustments", "/stock-transfers", "/stock-counts", "/units", "/tracking", "/labels"] });
  // the middle button: scanning goods for the store, the counter for a cashier, finding an item for anyone else
  if (any("GOODS_RECEIVING:CREATE|STOCK_TRANSFERS:UPDATE|SALES:UPDATE")) tabs.push({ href: "/scan", label: "Scan", icon: "scan", match: ["/scan"], main: true });
  else if (can("SALES:CREATE")) tabs.push({ href: "/counter", label: "Sell", icon: "scan", match: ["/counter"], main: true });
  else if (any("INVENTORY:READ|STOCK_TRANSFERS:READ|GOODS_RECEIVING:READ")) tabs.push({ href: "/tracking", label: "Find", icon: "search", match: ["/tracking"], main: true });
  if (can("SALES:READ")) tabs.push({ href: "/sales", label: "Sales", icon: "receipt", match: ["/sales", "/customers", "/shifts", "/release-note"] });
  else if (can("PURCHASING:READ")) tabs.push({ href: "/purchase-orders", label: "Orders", icon: "receipt", match: ["/purchase-orders", "/reorder", "/suppliers"] });
  else if (can("STOCK_TRANSFERS:READ")) tabs.push({ href: "/stock-transfers", label: "Transfers", icon: "truck", match: ["/stock-transfers"] });
  tabs.push({ href: "/settings", label: "Settings", icon: "gear", match: ["/settings", "/organization", "/branches", "/users", "/roles", "/regions"] });
  // keep the raised button in the middle when a role has fewer tabs
  const mid = tabs.findIndex(t => t.main);
  if (mid > 0 && tabs.length >= 3) { const [m] = tabs.splice(mid, 1); tabs.splice(Math.floor(tabs.length / 2), 0, m); }
  return tabs;
}

export default function BottomBar({ can, pathname }: { can: (p: string) => boolean; pathname: string }) {
  const tabs = bottomTabs(can);
  const on = (t: Tab) => t.match.some(m => pathname === m || pathname.startsWith(m + "/"));
  return (
    <nav className="bbar" aria-label="Main">
      {tabs.map(t => (
        <a key={t.href} href={t.href} className={"bbar-tab" + (t.main ? " main" : "") + (on(t) ? " on" : "")} aria-current={on(t) ? "page" : undefined}>
          <span className="bbar-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={t.main ? 26 : 22} height={t.main ? 26 : 22} fill="none" stroke="currentColor" strokeWidth={t.main ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d={P[t.icon]} /></svg>
          </span>
          <span className="bbar-l">{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
