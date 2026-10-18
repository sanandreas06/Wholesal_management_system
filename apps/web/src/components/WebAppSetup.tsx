'use client';
import { useEffect } from "react";
import { captureInstallPrompt, isStandalone } from "../lib/install";

const APP_NAME = "WHOLESTRA";

/** Runs once on every page: listens for the browser's install offer and turns on the service worker,
 *  which keeps the app's files on the device so it opens fast and shows a friendly page when there is no internet.
 *  Inside the installed app the window title is always just "WHOLESTRA" (not the page's name). */
export default function WebAppSetup() {
  useEffect(() => {
    captureInstallPrompt();
    let stop = () => {};
    if (isStandalone()) {
      document.documentElement.classList.add("wms-app");
      const keep = () => { if (document.title !== APP_NAME) document.title = APP_NAME; };
      keep();
      // pages change the title as people move around; put the app's name back each time
      const obs = new MutationObserver(keep);
      obs.observe(document.head, { subtree: true, childList: true, characterData: true });
      stop = () => obs.disconnect();
    }
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* the site still works without it */ });
      if (document.readyState === "complete") register(); else window.addEventListener("load", register, { once: true });
    }
    return stop;
  }, []);
  return null;
}
