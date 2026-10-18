'use client';
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { canPromptInstall, isStandalone, onInstallChange, platform, Platform, promptInstall } from "../lib/install";

const STEPS: Record<Platform, { title: string; steps: string[] }> = {
  ios: {
    title: "Add WHOLESTRA to your iPhone or iPad",
    steps: [
      "Open this page in Safari.",
      "Tap the Share button (the square with an arrow pointing up) at the bottom or top of the screen.",
      "Scroll down and tap \"Add to Home Screen\".",
      "Tap \"Add\". WHOLESTRA now has its own icon on your home screen.",
    ],
  },
  android: {
    title: "Install WHOLESTRA on your Android phone",
    steps: [
      "Open this page in Chrome.",
      "Tap the menu (⋮) at the top right.",
      "Tap \"Install app\" or \"Add to Home screen\".",
      "Tap \"Install\". WHOLESTRA now has its own icon with your other apps.",
    ],
  },
  desktop: {
    title: "Install WHOLESTRA on this computer",
    steps: [
      "Use Google Chrome or Microsoft Edge.",
      "Click the install icon at the right end of the address bar (a small screen with an arrow), or open the browser menu (⋮ or …).",
      "Choose \"Install WHOLESTRA\" (in Edge: Apps → Install this site as an app).",
      "WHOLESTRA opens in its own window and gets an icon on your desktop and taskbar.",
    ],
  },
};

/** The short how-to window, for browsers that have no install window of their own. */
export function InstallSteps({ on, onClose }: { on: Platform; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const info = STEPS[on];
  // drawn on the page itself, so it still shows when the menu that opened it closes
  return createPortal(
    <div className="ia-back" onClick={onClose}>
      <div className="ia-card" role="dialog" aria-modal="true" aria-labelledby="ia-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ia-x" aria-label="Close" onClick={onClose}>×</button>
        <img src="/icons/icon-192.png" alt="" width="56" height="56" />
        <h2 id="ia-title">{info.title}</h2>
        <p>It works like an app: its own icon, its own window, no app store needed, and it is always the newest version.</p>
        <ol>{info.steps.map((x) => <li key={x}>{x}</li>)}</ol>
        <button type="button" className="ia-ok" onClick={onClose}>Got it</button>
      </div>
    </div>,
    document.body,
  );
}

/** False when WHOLESTRA is already open as the installed app (then no install button is needed). */
export function useCanInstall() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const sync = () => setShow(!isStandalone());
    sync();
    return onInstallChange(sync);
  }, []);
  return show;
}

/** Opens the browser's install window if it has one; otherwise returns the platform whose steps to show. */
export async function startInstall(): Promise<Platform | null> {
  if (canPromptInstall() && await promptInstall()) return null;
  return platform();
}

/** "Install app" button for the public site header. Uses the browser's own install window where there is one,
 *  and shows short steps everywhere else (iPhone, Safari, Firefox). Hidden inside the installed app. */
export default function InstallApp({ className = "", onOpen }: { className?: string; onOpen?: () => void }) {
  const show = useCanInstall();
  const [help, setHelp] = useState<Platform | null>(null);
  if (!show) return null;
  return (
    <>
      <button type="button" className={className} onClick={async () => { onOpen?.(); setHelp(await startInstall()); }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
        Install app
      </button>
      {help && <InstallSteps on={help} onClose={() => setHelp(null)} />}
    </>
  );
}
