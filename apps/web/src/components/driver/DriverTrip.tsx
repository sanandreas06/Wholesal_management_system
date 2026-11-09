'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import { authApi } from "../../lib/authApi";
import { ApiError } from "../../lib/api";
import { LogoMark } from "../Logo";
import "./driver.css";

interface Info { company: string; kind: string; status: "WAITING" | "LIVE" | "ENDED"; driverName: string; vehicle: string | null; from: string; to: string; items: number; ref: string; startedAt: string | null; lastAt: string | null; endReason: string | null }
interface Pt { lat: number; lng: number; accuracy?: number; speed?: number; at: string }

const SEND_EVERY = 20_000, KEEP_EVERY = 45_000, KEEP_METRES = 25;
const metres = (a: Pt, b: Pt) => { const R = 6371000, r = (d: number) => d * Math.PI / 180, x = r(b.lat - a.lat), y = r(b.lng - a.lng); const h = Math.sin(x / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

/**
 * The driver's side of a trip. One big button: Start trip. While this page stays open the phone's location is sent every 20 seconds
 * (kept on the phone when there is no signal, and sent later). The screen is kept awake where the phone allows it.
 * Sharing stops by itself when the goods are scanned in or the customer confirms.
 */
export default function DriverTrip({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [gpsProblem, setGpsProblem] = useState("");
  const [, tick] = useState(0);
  const watch = useRef<number | null>(null);
  const lock = useRef<{ release(): Promise<void> } | null>(null);
  const kept = useRef<Pt | null>(null);
  const key = `wms_trip_${token}`;

  const queue = useCallback((): Pt[] => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } }, [key]);
  const save = useCallback((q: Pt[]) => { try { localStorage.setItem(key, JSON.stringify(q.slice(-2000))); } catch { /* full: keep going */ } setWaiting(q.length); }, [key]);

  useEffect(() => {
    authApi.get<Info>(`/public/trip/${encodeURIComponent(token)}`).then(setInfo).catch(e => setError(e instanceof ApiError && e.status === 404 ? "This trip link is not valid. Ask the person who sent it for a new one." : "Could not open the trip. Check your connection and try again."));
    setWaiting(queue().length);
    const t = setInterval(() => tick(n => n + 1), 5000);
    return () => clearInterval(t);
  }, [token, queue]);

  const stop = useCallback(async () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null; setSharing(false);
    try { await lock.current?.release(); } catch { /* already released */ }
    lock.current = null;
  }, []);

  const flush = useCallback(async () => {
    const q = queue();
    if (!q.length) return;
    try {
      const r = await authApi.post<{ status: string }>(`/public/trip/${encodeURIComponent(token)}/points`, { points: q.slice(0, 200) });
      save(q.slice(200)); setLastSent(Date.now());
      if (r.status === "ENDED") { await stop(); setInfo(i => i && { ...i, status: "ENDED" }); }
    } catch { /* no signal: the points stay on the phone and go with the next try */ }
  }, [queue, save, token, stop]);

  useEffect(() => { if (!sharing) return; const t = setInterval(() => void flush(), SEND_EVERY); return () => clearInterval(t); }, [sharing, flush]);
  // when the page comes back to the front (screen unlocked), send at once and ask to keep the screen on again
  useEffect(() => {
    const on = async () => {
      if (document.visibilityState !== "visible" || !sharing) return;
      void flush();
      try { lock.current = await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* not allowed */ }
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [sharing, flush]);

  async function start() {
    setGpsProblem("");
    if (!navigator.geolocation) { setGpsProblem("This phone's browser cannot share location. Open the link in Chrome."); return; }
    watch.current = navigator.geolocation.watchPosition(p => {
      const pt: Pt = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), ...(p.coords.speed !== null && p.coords.speed >= 0 ? { speed: Math.round(p.coords.speed * 10) / 10 } : {}), at: new Date(p.timestamp || Date.now()).toISOString() };
      setGpsProblem("");
      const k = kept.current;
      // keep a point when the vehicle has moved, or every 45 seconds when it is standing still (traffic, a stop)
      if (!k || metres(k, pt) >= KEEP_METRES || Date.parse(pt.at) - Date.parse(k.at) >= KEEP_EVERY) {
        kept.current = pt; const q = queue(); q.push(pt); save(q);
        if (!lastSent) void flush();
      }
    }, err => {
      setGpsProblem(err.code === err.PERMISSION_DENIED ? "Location is blocked. Allow location for this site in the browser, then tap Start again." : "Looking for GPS… Stay where the phone can see the sky.");
      if (err.code === err.PERMISSION_DENIED) void stop();
    }, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 });
    setSharing(true);
    try { lock.current = await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* the phone does not allow it */ }
    // tells the business the trip has started even before the first GPS reading
    try { await authApi.post(`/public/trip/${encodeURIComponent(token)}/points`, { points: [] }); } catch { /* sent with the next points */ }
  }

  const ended = info?.status === "ENDED";
  return (
    <main className="dv">
      <div className="dv-card">
        <header className="dv-head"><span className="dv-mark"><LogoMark size={34} tone="dark" /></span><div><b>{info?.company ?? "WHOLESTRA"}</b><span>Trip {info?.ref}</span></div></header>
        {error && <p className="dv-err">{error}</p>}
        {!info && !error && <p className="dv-muted">Loading…</p>}
        {info && <>
          <div className="dv-route"><div><span>From</span><b>{info.from}</b></div><i aria-hidden="true">→</i><div><span>To</span><b>{info.to}</b></div></div>
          <p className="dv-muted">{info.items} item{info.items === 1 ? "" : "s"}{info.vehicle ? ` · ${info.vehicle}` : ""} · driver {info.driverName}</p>
          {ended ? <div className="dv-done"><div className="dv-tick">✓</div><h1>Trip finished</h1><p>{info.endReason ?? "The goods were received."} Your location is no longer shared. Thank you!</p></div>
            : sharing ? <div className="dv-live">
                <div className="dv-pulse" aria-hidden="true" />
                <h1>Sharing your location</h1>
                <p>{lastSent ? `Last sent ${Math.max(0, Math.round((Date.now() - lastSent) / 1000))} seconds ago` : "Getting your position…"}{waiting > 0 ? ` · ${waiting} point${waiting === 1 ? "" : "s"} waiting for signal` : ""}</p>
                {gpsProblem && <p className="dv-warn">{gpsProblem}</p>}
                <p className="dv-tip">Keep this page open. If the phone locks, open it again: nothing is lost.</p>
                <button type="button" className="dv-stop" onClick={() => void stop()}>Pause sharing</button>
              </div>
            : <>
                <button type="button" className="dv-start" onClick={() => void start()}>{info.status === "LIVE" ? "Continue the trip" : "Start trip"}</button>
                {gpsProblem && <p className="dv-warn">{gpsProblem}</p>}
                <p className="dv-muted dv-small">Tapping Start shares this phone&apos;s location with {info.company} until the goods are received. Nothing else on your phone is shared, and it stops by itself when the trip ends.</p>
              </>}
        </>}
      </div>
      <p className="dv-foot">WHOLESTRA</p>
    </main>
  );
}
