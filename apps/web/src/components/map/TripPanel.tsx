'use client';
import { FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api, ApiError } from "../../lib/api";
import { ago, waNumber } from "../../lib/geo";
import { usePolling } from "../../hooks/usePolling";
import type { Pin } from "./LiveMap";
import "./map.css";

const LiveMap = dynamic(() => import("./LiveMap"), { ssr: false, loading: () => <div className="lm lm-loading" style={{ height: 340 }} /> });

export interface Trip {
  id: string; kind: string; status: "WAITING" | "LIVE" | "ENDED"; driverName: string; driverPhone: string | null; vehicle: string | null;
  from: { label: string; lat: number | null; lng: number | null }; to: { label: string; lat: number | null; lng: number | null };
  last: { lat: number; lng: number; accuracy: number | null; at: string } | null; kmLeft: number | null; startedAt: string | null; endedAt: string | null; endReason: string | null;
  route?: { lat: number; lng: number; at: string }[]; token?: string; company?: string;
}

export function tripPins(t: Trip, extra: Pin[] = []): Pin[] {
  const pins: Pin[] = [...extra];
  if (t.from.lat !== null && t.from.lng !== null) pins.push({ kind: "from", lat: t.from.lat, lng: t.from.lng, label: t.from.label, sub: "Left from here" });
  if (t.to.lat !== null && t.to.lng !== null) pins.push({ kind: "to", lat: t.to.lat, lng: t.to.lng, label: t.to.label, sub: "Going here" });
  if (t.last) pins.push({ kind: "vehicle", lat: t.last.lat, lng: t.last.lng, label: `${t.driverName}${t.vehicle ? ` · ${t.vehicle}` : ""}`, sub: `Last seen ${ago(t.last.at)}` });
  return pins;
}

/** The message the driver gets: what the link is for, and that it only shares location while the trip lasts. */
export function driverMessage(t: Trip) {
  const link = `${window.location.origin}/t/${t.token}`;
  return `Hello ${t.driverName}, this is ${t.company || "us"}. For the goods you are carrying (${t.from.label} to ${t.to.label}), please open this link and tap "Start trip". It shares your phone's location with us only until the goods are received:\n${link}`;
}

/** A trip on the map with what matters: where the goods are now, how far is left, when the driver was last seen. Refreshes itself. */
export function TripView({ tripId, height = 340, onEnded }: { tripId: string; height?: number; onEnded?: () => void }) {
  const [t, setT] = useState<Trip | null>(null);
  const [error, setError] = useState("");
  function load() { api.get<Trip>(`/trips/${tripId}`).then(x => { setT(x); if (x.status === "ENDED") onEnded?.(); }).catch(e => setError(e instanceof ApiError ? e.message : "Could not load the trip.")); }
  useEffect(load, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps
  usePolling(load, 15000, !!t && t.status !== "ENDED");
  if (error) return <div className="error">{error}</div>;
  if (!t) return <div className="lm lm-loading" style={{ height }} />;
  return (
    <div className="tp">
      <LiveMap pins={tripPins(t)} route={t.route ?? []} height={height} follow={t.status === "LIVE"} />
      <div className="tp-card">
        <span className={`tp-status ${t.status.toLowerCase()}`}>{t.status === "LIVE" ? "On the road" : t.status === "WAITING" ? "Waiting for the driver to start" : "Trip ended"}</span>
        <b>{t.driverName}{t.vehicle ? ` · ${t.vehicle}` : ""}</b>
        <span>{t.from.label} → {t.to.label}</span>
        {t.last && <span>Last seen {ago(t.last.at)}{t.kmLeft !== null && t.status !== "ENDED" ? ` · about ${t.kmLeft} km to go (straight line)` : ""}</span>}
        {t.status === "WAITING" && <span className="muted">The map moves once the driver opens the link and taps Start trip.</span>}
        {t.status === "ENDED" && t.endReason && <span className="muted">{t.endReason}</span>}
        {!t.from.lat || !t.to.lat ? <span className="muted">Tip: pin your branches on the map (Branches, then Pin location) to see where the trip starts and ends.</span> : null}
      </div>
    </div>
  );
}

/** Making the driver's link and sending it on WhatsApp. */
export function ShareWithDriver({ transferId, releaseId, defaultName = "", defaultVehicle = "", onCreated }: { transferId?: string; releaseId?: string; defaultName?: string; defaultVehicle?: string; onCreated?: (t: Trip) => void }) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState(defaultVehicle);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const t = await api.post<Trip>("/trips", { transferId, releaseId, driverName: name.trim(), driverPhone: phone.trim() || undefined, vehicle: vehicle.trim() || undefined }); setTrip(t); onCreated?.(t); }
    catch (er) { setError(er instanceof ApiError ? er.message : "Could not make the link."); }
    finally { setBusy(false); }
  }
  if (trip) {
    const msg = driverMessage(trip), wa = waNumber(trip.driverPhone);
    return (
      <div className="tp-share done">
        <b>Link ready for {trip.driverName}</b>
        <p className="muted">Send it now. The map starts moving when the driver opens it and taps Start trip.</p>
        <div className="tp-acts">
          <a className="button" href={`https://wa.me/${wa ?? ""}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a>
          <button type="button" className="secondary" onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/t/${trip.token}`).then(() => setCopied(true)); }}>{copied ? "Copied" : "Copy link"}</button>
        </div>
      </div>
    );
  }
  return (
    <form className="tp-share" onSubmit={submit}>
      <b>Follow it on the map</b>
      <p className="muted">The driver gets a link (no account needed). While it is open, their phone shares its location until the goods are scanned in.</p>
      <div className="tp-grid">
        <label>Driver&apos;s name<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={80} /></label>
        <label>Driver&apos;s phone (for WhatsApp)<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="024 000 0000" maxLength={20} /></label>
        <label>Vehicle (optional)<input value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="GT 4455-21" maxLength={40} /></label>
      </div>
      {error && <div className="error">{error}</div>}
      <button disabled={busy || name.trim().length < 2}>{busy ? "Making…" : "Make the driver's link"}</button>
    </form>
  );
}
