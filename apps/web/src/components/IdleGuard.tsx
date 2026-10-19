'use client';
import { useEffect, useState } from "react";
import { IDLE_MINUTES, IDLE_MS, WARN_MS, idleFor, markActive } from "../lib/idle";

/** Signs the person out after IDLE_MINUTES without activity in any tab, with a one-minute warning first.
 *  Also signs out at once when the app is reopened after a long quiet spell (a tab left open overnight, a laptop woken up),
 *  and follows a sign-out made in another tab. */
export default function IdleGuard({ onTimeout }: { onTimeout: (reason: "idle" | "elsewhere") => void }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (idleFor() >= IDLE_MS) { onTimeout("idle"); return; }
    markActive(true);
    const active = () => { markActive(); };
    const evs: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove", "scroll"];
    evs.forEach(e => window.addEventListener(e, active, { passive: true, capture: true }));
    const check = () => {
      const idle = idleFor();
      if (idle >= IDLE_MS) { onTimeout("idle"); return; }
      setLeft(idle >= IDLE_MS - WARN_MS ? Math.ceil((IDLE_MS - idle) / 1000) : null);
    };
    const t = setInterval(check, 1000);
    const vis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", vis);
    const storage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== "wms_access_token") return;
      let has = true; try { has = !!localStorage.getItem("wms_access_token"); } catch { /* ignore */ }
      if (!has) onTimeout("elsewhere");
    };
    window.addEventListener("storage", storage);
    return () => {
      evs.forEach(e => window.removeEventListener(e, active, { capture: true }));
      clearInterval(t); document.removeEventListener("visibilitychange", vis); window.removeEventListener("storage", storage);
    };
  }, [onTimeout]);

  if (left === null) return null;
  return (
    <div className="idle-back">
      <div className="idle-card" role="alertdialog" aria-modal="true" aria-labelledby="idle-h" aria-describedby="idle-p">
        <div className="idle-ring" aria-hidden="true">{left}</div>
        <h2 id="idle-h">Are you still there?</h2>
        <p id="idle-p">You have not used WHOLESTRA for about {IDLE_MINUTES} minutes. To keep your company&apos;s data safe, we will sign you out in <b>{left} second{left === 1 ? "" : "s"}</b>.</p>
        <div className="idle-btns">
          <button type="button" className="secondary" onClick={() => onTimeout("idle")}>Sign out now</button>
          <button type="button" autoFocus onClick={() => { markActive(true); setLeft(null); }}>Stay signed in</button>
        </div>
      </div>
    </div>
  );
}
