'use client';
import SiteHeader from "../landing/SiteHeader";
import Showcase from "./Showcase";
import ContactBlock from "../ContactBlock";
import { useTheme } from "../../hooks/useTheme";
import "../landing/landing.css";
import "./auth.css";

/** Frame for sign-in, sign-up and company set-up: the site's top bar, the sliding showcase on the left and the form box on the right (the showcase hides on phones). */
export default function AuthShell({ children, wide, aside }: { children: React.ReactNode; wide?: boolean; aside?: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="au">
      <SiteHeader />
      <div className={"au-grid" + (wide ? " wide" : "")}>
        <aside className="au-art" aria-label="About WHOLESTRA"><div className="au-art-in">{aside ?? <Showcase />}</div></aside>
        <main className="au-pane">
          <button type="button" className="theme-toggle au-theme" onClick={toggle} aria-label="Toggle dark mode">{theme === "light" ? "🌙" : "☀️"}</button>
          <div className="au-col">
            {children}
            <ContactBlock />
          </div>
        </main>
      </div>
    </div>
  );
}
