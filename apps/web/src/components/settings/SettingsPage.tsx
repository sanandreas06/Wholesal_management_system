'use client';
import Link from "next/link";
import AppShell from "../AppShell";

/** Frame for one settings screen: a way back to All settings, a title and a short explanation. */
export default function SettingsPage({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <AppShell title={title}>
      <div className="st-page">
        <Link href="/settings" className="st-back">← All settings</Link>
        <h1>{title}</h1>
        {intro && <p className="st-intro">{intro}</p>}
        {children}
      </div>
    </AppShell>
  );
}
