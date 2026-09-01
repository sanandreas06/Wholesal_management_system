'use client';
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getSessionUser, SessionUser } from "../lib/session";

const NAV = [
  { href: "/dashboard", label: "Dashboard", permission: null },
  { href: "/organization", label: "Organization", permission: "ORGANIZATION:READ" },
  { href: "/regions", label: "Regions", permission: "REGIONS:READ" },
  { href: "/branches", label: "Branches", permission: "BRANCHES:READ" },
  { href: "/users", label: "Users", permission: "USERS:READ" },
  { href: "/roles", label: "Roles", permission: "ROLES:READ" }
];

export default function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const u = getSessionUser();
    if (!u) { router.replace("/login"); return; }
    setUser(u);
  }, [router]);

  function signOut() { clearSession(); router.replace("/login"); }

  const visibleNav = NAV.filter(item => !item.permission || user?.permissions.includes(item.permission));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="mark small">W</span><span>WMS</span></div>
        <nav>
          {visibleNav.map(item => (
            <a key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>{item.label}</a>
          ))}
        </nav>
        {user && <div className="who"><strong>{user.name}</strong><span className="muted">{user.branch || user.organization || ""}</span></div>}
      </aside>
      <div className="content">
        <header className="topbar">
          <h1>{title}</h1>
          <button className="secondary" onClick={signOut}>Sign out</button>
        </header>
        {children}
      </div>
    </div>
  );
}
