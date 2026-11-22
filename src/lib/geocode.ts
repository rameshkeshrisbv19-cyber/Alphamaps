/**
 * Geocoding.
 *  - searchPlaces(): Photon (komoot) forward search — designed for typeahead.
 *  - reversePlace(): Nominatim reverse lookup for tapped points without a name.
 *
 * Usage policy compliance: every request goes through one shared throttle
 * (≤ 1 request per second), results are cached, and callers debounce + abort.
 */
import { GEOCODING } from '../config';
import { createCache, createThrottle, requestJson } from './http';
import type { LatLng } from '../types';

export interface PlaceResult extends LatLng {
  id: string;
  name: string;
  subtitle: string;
  kind: string;
}

const throttle = createThrottle(GEOCODING.minIntervalMs);
const searchCache = createCache<PlaceResult[]>();
const reverseCache = createCache<PlaceResult | null>(300);

/* ---------- helpers ---------- */

const unique = (parts: (string | number | undefined | null)[]): string[] => [
  ...new Set(parts.filter((p) => p !== undefined && p !== null && p !== '').map(String)),
];

/* ---------- Photon (forward search) ---------- */

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | number | undefined>;
}
interface PhotonResponse {
  features: PhotonFeature[];
}

// Photon only accepts a handful of language codes; others use its default names.
const PHOTON_LANGS = ['en', 'de', 'fr', 'it'];

export async function searchPlaces(
  query: string,
  opts: { lang: string; near?: LatLng | null; signal?: AbortSignal },
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({ q, limit: '6' });
  if (PHOTON_LANGS.includes(opts.lang)) params.set('lang', opts.lang);
  if (opts.near) {
    // Bias results towards where the user is.
    params.set('lat', opts.near.lat.toFixed(5));
    params.set('lon', opts.near.lng.toFixed(5));
  }
  const url = `${GEOCODING.photon}?${params.toString()}`;

  const cached = searchCache.get(url);
  if (cached) return cached;

  const data = await throttle(() => requestJson<PhotonResponse>(url, { signal: opts.signal }), opts.signal);
  const results: PlaceResult[] = data.features.map((f, i) => {
    const p = f.properties;
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    return {
      id: `${p.osm_type ?? 'x'}${p.osm_id ?? i}`,
      name: String(p.name || street || p.city || 'Unnamed place'),
      subtitle: unique([street, p.district, p.city, p.state, p.country]).join(', '),
      kind: String(p.osm_value ?? p.type ?? 'place'),
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    };
  });
  searchCache.set(url, results);
  return results;
}

/* ---------- Nominatim (reverse lookup) ---------- */

interface NominatimReverse {
  place_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  type?: string;
  category?: string;
  error?: string;
  address?: Record<string, string>;
}

export async function reversePlace(
  at: LatLng,
  lang: string,
  signal?: AbortSignal,
): Promise<PlaceResult | null> {
  const key = `${at.lat.toFixed(5)},${at.lng.toFixed(5)},${lang}`;
  const cached = reverseCache.get(key);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(at.lat),
    lon: String(at.lng),
    zoom: '18',
    addressdetails: '1',
  });
  if (lang && lang !== 'local') params.set('accept-language', lang);

  const data = await throttle(
    () => requestJson<NominatimReverse>(`${GEOCODING.nominatim}/reverse?${params.toString()}`, { signal }),
    signal,
  );
  if (!data || data.error || data.lat === undefined) {
    reverseCache.set(key, null);
    return null;
  }

  const a = data.address ?? {};
  // OpenStreetMap names every way, not just motor vehicles: include paths,
  // footways and cycleways so the exact name under the tap is used.
  const roadName =
    a.road || a.pedestrian || a.footway || a.path || a.cycleway || a.track || a.residential;
  const name =
    data.name ||
    roadName ||
    a.neighbourhood ||
    a.suburb ||
    a.city ||
    (data.display_name ?? '').split(',')[0] ||
    'Dropped pin';
  const street = roadName ? [roadName, a.house_number].filter(Boolean).join(' ') : undefined;
  const parts = unique([
    street,
    a.neighbourhood ?? a.suburb,
    a.city ?? a.town ?? a.village,
    a.state,
    a.country,
  ]).filter((s) => s !== name);

  const result: PlaceResult = {
    id: String(data.place_id ?? key),
    name,
    subtitle: parts.join(', '),
    kind: data.category ?? data.type ?? 'place',
    lat: Number(data.lat),
    lng: Number(data.lon),
  };
  reverseCache.set(key, result);
  return result;
}
