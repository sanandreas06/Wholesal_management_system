'use client';
import { useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";

interface AuditFlag {
  id: string;
  severity: "high" | "medium" | "low";
  type: string;
  title: string;
  description: string;
  branchName?: string;
  userName?: string;
  productName?: string;
  occurredAt: string;
}

const SEVERITY_LABEL: Record<string, string> = { high: "High priority", medium: "Worth reviewing", low: "For awareness" };

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AuditManager() {
  const [flags, setFlags] = useState<AuditFlag[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");

  function load() { api.get<AuditFlag[]>("/audit/flags").then(setFlags).catch(e => setError(e.message)); }
  useEffect(load, []);
  usePolling(load, 20000);

  const visible = flags?.filter(f => filter === "all" || f.severity === filter) ?? [];
  const counts = {
    high: flags?.filter(f => f.severity === "high").length ?? 0,
    medium: flags?.filter(f => f.severity === "medium").length ?? 0,
    low: flags?.filter(f => f.severity === "low").length ?? 0,
  };

  return (
    <AppShell title="Audit & Fraud Signals">
      {error && <div className="error">{error}</div>}
      <p className="muted" style={{ marginBottom: 16 }}>
        Automated, rule-based patterns worth a closer look — not accusations. Every flag is generated from your actual stock movement history and links back to real records for you to verify.
      </p>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <button className={`kpi ${filter === "all" ? "" : "secondary"}`} style={{ textAlign: "left", cursor: "pointer" }} onClick={() => setFilter("all")}>
          <p>All signals</p><strong>{flags?.length ?? "—"}</strong>
        </button>
        <button className={`kpi ${filter === "high" ? "" : "secondary"}`} style={{ textAlign: "left", cursor: "pointer", border: filter === "high" ? "2px solid var(--danger)" : undefined }} onClick={() => setFilter("high")}>
          <div className="kpi-icon red">⚠</div><p>High priority</p><strong>{counts.high}</strong>
        </button>
        <button className={`kpi ${filter === "medium" ? "" : "secondary"}`} style={{ textAlign: "left", cursor: "pointer", border: filter === "medium" ? "2px solid var(--accent-amber)" : undefined }} onClick={() => setFilter("medium")}>
          <div className="kpi-icon amber">◐</div><p>Worth reviewing</p><strong>{counts.medium}</strong>
        </button>
        <button className={`kpi ${filter === "low" ? "" : "secondary"}`} style={{ textAlign: "left", cursor: "pointer", border: filter === "low" ? "2px solid var(--accent-blue)" : undefined }} onClick={() => setFilter("low")}>
          <div className="kpi-icon blue">ⓘ</div><p>For awareness</p><strong>{counts.low}</strong>
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        {flags && visible.length === 0 && <div className="empty">{filter === "all" ? "No unusual activity detected. Everything looks normal." : "No signals in this category."}</div>}
        {visible.map(flag => (
          <div key={flag.id} className={`flag-card ${flag.severity}`}>
            <div className="flag-header">
              <div>
                <span className={`badge ${flag.severity}`} style={{ marginBottom: 6, display: "inline-block" }}>{SEVERITY_LABEL[flag.severity]}</span>
                <p className="flag-title">{flag.title}</p>
              </div>
              <span className="flag-time">{timeAgo(flag.occurredAt)}</span>
            </div>
            <p className="flag-description">{flag.description}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
