import { IsNumber, IsOptional, Max, Min } from "class-validator";

/** Where a phone was when something was scanned. Optional everywhere: people can refuse location and still work. */
export class WhereInput {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  /** metres; readings worse than 2 km are dropped (an office computer guessing from its internet address) */
  @IsOptional() @IsNumber() @Min(0) @Max(100000) accuracy?: number;
}

/** A usable reading, or nothing. */
export function place(w?: WhereInput | null): { lat: number; lng: number } | null {
  if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) return null;
  if (w.accuracy !== undefined && w.accuracy > 2000) return null;
  if (Math.abs(w.lat) < 0.0001 && Math.abs(w.lng) < 0.0001) return null; // 0,0 is a phone that had no fix
  return { lat: Math.round(w.lat * 1e6) / 1e6, lng: Math.round(w.lng * 1e6) / 1e6 };
}

/** Straight-line distance in kilometres. */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
