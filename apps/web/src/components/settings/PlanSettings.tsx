'use client';
import { useEffect, useState } from "react";
import SettingsPage from "./SettingsPage";
import { api } from "../../lib/api";
import { CONTACT_EMAIL, CONTACT_WHATSAPP, whatsappHref } from "../../lib/contact";

type Org = { name: string; plan: string; createdAt: string; isDemo: boolean; _count: { branches: number; users: number; products: number } };
const PLAN_NAMES: Record<string, string> = { PILOT: "Pilot", STARTER: "Starter", BUSINESS: "Business", ENTERPRISE: "Enterprise" };
const INCLUDED = ["Unlimited products, customers and suppliers", "Every branch and warehouse", "Sales, invoices and payments", "Purchase orders and goods received", "Transfers, adjustments and stock counts", "Expenses, deposits and daily reconciliation", "Excel import", "Roles, approval limits and the change log", "Email sign-in codes and authenticator app"];

/** Settings → Plan: which plan the company is on and what it includes. No payment is taken in the app. */
export default function PlanSettings() {
  const [org, setOrg] = useState<Org | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get<Org>("/organization").then(setOrg).catch((e) => setError(e.message)); }, []);
  const ask = "Hello WHOLESTRA, I would like to talk about plans for my company.";
  return (
    <SettingsPage title="Plan" intro="Your company's plan and what it includes.">
      {error && <div className="error">{error}</div>}
      {org && (
        <div className="br-grid">
          <article className="panel plan-card">
            <span className="plan-tag">{org.isDemo ? "Demo" : "Current plan"}</span>
            <h2>{org.isDemo ? "Demo company" : PLAN_NAMES[org.plan] ?? org.plan}</h2>
            <p className="muted">{org.isDemo ? "A shared sample company for trying WHOLESTRA. Create your own account to keep your data." : `${org.name} has used WHOLESTRA since ${new Date(org.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}.`}</p>
            <div className="plan-use"><div><b>{org._count.branches}</b><small>branches</small></div><div><b>{org._count.users}</b><small>users</small></div><div><b>{org._count.products}</b><small>products</small></div></div>
            {!org.isDemo && <>
              <p className="fine">No payment is taken inside the app. To talk about plans and pricing for your company, contact us.</p>
              <div className="st-row">
                {CONTACT_WHATSAPP && <a className="btn-link" href={whatsappHref(ask)} target="_blank" rel="noopener noreferrer">Talk to us on WhatsApp</a>}
                {CONTACT_EMAIL && <a className="btn-link secondary" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("WHOLESTRA plan")}`}>Email us</a>}
                {!CONTACT_EMAIL && !CONTACT_WHATSAPP && <a className="btn-link" href="/contact">Contact us</a>}
              </div>
            </>}
            {org.isDemo && <div className="st-row"><a className="btn-link" href="/get-started">Create your account</a></div>}
          </article>
          <article className="panel">
            <h2>Included</h2>
            <ul className="plan-list">{INCLUDED.map((x) => <li key={x}><span aria-hidden="true">✓</span>{x}</li>)}</ul>
          </article>
        </div>
      )}
    </SettingsPage>
  );
}
