'use client';
import { useEffect, useState } from "react";
import AppShell from "./AppShell";
import StatusCheck from "./landing/StatusCheck";
import StatusPage from "./status/StatusPage";
import { getSessionUser } from "../lib/session";
import "./landing/landing.css";

/** The setup checks (email, Google, database, addresses) for the people who run WHOLESTRA. Everyone else gets "page not found",
 *  so customers never see how the system is wired. The server refuses the checks too. */
export default function SystemChecks() {
  const [who, setWho] = useState<"admin" | "other" | null>(null);
  useEffect(() => { const u = getSessionUser(); setWho(u?.platformAdmin ? "admin" : "other"); }, []);
  if (who === null) return null;
  if (who === "other") return <StatusPage code="Error 404" art="missing" title="This shelf is empty"
    text={<p>We could not find the page you asked for. The link may be mistyped, or the page may have moved.</p>} />;
  return (
    <AppShell title="System checks">
      <div className="dash-head"><div><h1>System checks</h1><p>Everything sign-in depends on: the server, database, email and social sign-in. Only platform owners can see this page.</p></div></div>
      <div className="card2"><StatusCheck /></div>
    </AppShell>
  );
}
