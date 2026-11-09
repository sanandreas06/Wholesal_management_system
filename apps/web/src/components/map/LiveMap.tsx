'use client';
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "./map.css";

export interface MapPoint { lat: number; lng: number }
export interface Pin extends MapPoint { kind: "from" | "to" | "vehicle" | "scan" | "branch"; label: string; sub?: string }

/** Map tiles: OpenStreetMap by default (free, with credit). A company can switch to another provider with NEXT_PUBLIC_MAP_TILES. */
const TILES = process.env.NEXT_PUBLIC_MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const CREDIT = process.env.NEXT_PUBLIC_MAP_CREDIT || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const GHANA: [number, number] = [7.95, -1.03];

const ICON: Record<Pin["kind"], string> = {
  from: `<span class="lm-pin from"><i>A</i></span>`,
  to: `<span class="lm-pin to"><i>B</i></span>`,
  vehicle: `<span class="lm-truck"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></span>`,
  scan: `<span class="lm-dot"></span>`,
  branch: `<span class="lm-pin branch"></span>`,
};

/**
 * A map with the trip's start (A), destination (B), the route travelled so far (solid line), the straight way still to go
 * (dashed), the vehicle where it was last seen, and any scan points. Like a courier's tracking page.
 */
export default function LiveMap({ pins, route = [], height = 340, follow = false }: { pins: Pin[]; route?: MapPoint[]; height?: number; follow?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const state = useRef<{ L: typeof import("leaflet"); map: import("leaflet").Map; layer: import("leaflet").LayerGroup; fitted: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current || state.current) return;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(GHANA, 6);
      L.tileLayer(TILES, { maxZoom: 19, attribution: CREDIT }).addTo(map);
      state.current = { L, map, layer: L.layerGroup().addTo(map), fitted: false };
      draw();
    })();
    return () => { cancelled = true; state.current?.map.remove(); state.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const s = state.current; if (!s) return;
    const { L, map, layer } = s;
    layer.clearLayers();
    const all: [number, number][] = [];
    if (route.length > 1) { const line = route.map(p => [p.lat, p.lng] as [number, number]); L.polyline(line, { color: "#E8590C", weight: 5, opacity: .9 }).addTo(layer); all.push(...line); }
    const vehicle = pins.find(p => p.kind === "vehicle"), to = pins.find(p => p.kind === "to");
    if (vehicle && to) L.polyline([[vehicle.lat, vehicle.lng], [to.lat, to.lng]], { color: "#E8590C", weight: 3, dashArray: "6 8", opacity: .8 }).addTo(layer);
    for (const p of pins) {
      const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ html: ICON[p.kind], className: "lm-icon", iconSize: [34, 34], iconAnchor: [17, p.kind === "vehicle" || p.kind === "scan" ? 17 : 32] }), zIndexOffset: p.kind === "vehicle" ? 1000 : 0 });
      m.bindTooltip(`<b>${p.label.replace(/</g, "&lt;")}</b>${p.sub ? `<br>${p.sub.replace(/</g, "&lt;")}` : ""}`, { direction: "top", offset: [0, -18] });
      m.addTo(layer); all.push([p.lat, p.lng]);
    }
    if (all.length && (!s.fitted || follow)) {
      if (all.length === 1) map.setView(all[0], 13); else map.fitBounds(L.latLngBounds(all), { padding: [36, 36], maxZoom: 15 });
      s.fitted = true;
    }
  }
  useEffect(draw); // every update: redraw the pins and lines (cheap: a handful of layers)

  return <div className="lm" style={{ height }} ref={box} role="img" aria-label="Map" />;
}
