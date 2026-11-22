/**
 * Geographic helpers: great-circle distance, circle geometry for the accuracy
 * halo, globe zoom calculation and number/unit formatting.
 */
import type { LatLng, Units } from '../types';

export const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Haversine (great-circle) distance in metres between two points. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Formats a distance (metres) in km or miles. Short distances fall back to m / ft. */
export function formatDistance(metres: number, units: Units): string {
  if (!Number.isFinite(metres)) return '—';
  if (units === 'km') {
    if (metres < 1000) return `${Math.round(metres)} m`;
    return `${(metres / 1000).toFixed(metres < 10000 ? 2 : 1)} km`;
  }
  const miles = metres / 1609.344;
  if (miles < 0.1) return `${Math.round(metres * 3.28084)} ft`;
  return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
}

/** Formats GPS speed (metres/second) as km/h or mph. */
export function formatSpeed(metresPerSecond: number | null | undefined, units: Units): string {
  if (metresPerSecond === null || metresPerSecond === undefined || !Number.isFinite(metresPerSecond)) return '—';
  const value = Math.max(0, metresPerSecond) * (units === 'mi' ? 2.236936 : 3.6);
  const rounded = value < 10 ? value.toFixed(1) : Math.round(value).toString();
  return `${rounded} ${units === 'mi' ? 'mph' : 'km/h'}`;
}

/** Formats seconds as "< 1 min", "45 min" or "1 h 20 min". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Closed ring (lng/lat) approximating a circle of `radiusM` metres. */
export function circleRing(center: LatLng, radiusM: number, steps = 72): [number, number][] {
  const d = radiusM / EARTH_RADIUS_M;
  const lat1 = toRad(center.lat);
  const lng1 = toRad(center.lng);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );
    ring.push([toDeg(lng2), toDeg(lat2)]);
  }
  return ring;
}

/**
 * Zoom level at which the whole globe fits inside a viewport of the given size.
 * On a globe the diameter in CSS px is 512 * 2^zoom / π.
 */
export function globeZoomFor(width: number, height: number): number {
  const diameterPx = Math.min(width, height) * 0.92;
  const zoom = Math.log2((diameterPx * Math.PI) / 512);
  return Math.min(3.2, Math.max(0.6, zoom));
}

/** Marker letter for the nth point: 0 → A, 1 → B … (wraps after Z). */
export const letterFor = (index: number): string => String.fromCharCode(65 + (index % 26));
