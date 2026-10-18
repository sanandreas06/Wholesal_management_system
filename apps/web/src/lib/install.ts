'use client';
/** Installing WHOLESTRA as a web app (an icon on the phone or computer that opens without the browser bars).
 *  Chrome, Edge and Android fire "beforeinstallprompt" once, early, so the root layout catches it here and any
 *  "Install app" button can use it later. iPhone and iPad have no such event: people use Share → Add to Home Screen. */

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: PromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let started = false;
export function captureInstallPrompt() {
  if (typeof window === "undefined" || started) return;
  started = true;
  // the small script in the page head may already have caught the offer before React started
  const early = (window as Window & { __wmsInstall?: PromptEvent }).__wmsInstall;
  if (early) { deferred = early; notify(); }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; installed = true; notify(); });
}

export function onInstallChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** True when WHOLESTRA is already running as the installed app. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return installed || window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type Platform = "ios" | "android" | "desktop";
export function platform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, so also check for touch
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export const canPromptInstall = () => !!deferred;

/** Shows the browser's own install window. Returns false when the browser offers none (then show the steps instead). */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null; notify(); // each event can be used only once
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") { installed = true; notify(); }
  return true;
}
