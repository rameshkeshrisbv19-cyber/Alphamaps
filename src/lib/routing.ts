/**
 * Routing.
 *
 *  - Default (no key): OSRM. Car uses the OSRM demo server; bike and walk use the
 *    FOSSGIS OSRM profiles. Requests use alternatives=true. A second car request
 *    with exclude=motorway produces the "Avoids highways" option.
 *  - Optional OpenRouteService key (config.ts): ORS handles every mode and its
 *    avoid_features option produces "Avoids highways".
 *
 * Also exposes fetchRoadLegs() — driving distances between several points — for
 * the distance tool. Live traffic is NOT included anywhere; times are estimates.
 */
import { ORS_API_KEY, ROUTING } from '../config';
import { ApiError, isAbortError, requestJson } from './http';
import type { LatLng, RouteOption, RouteStep, StepIcon, TravelMode } from '../types';

/* ============================== OSRM ============================== */

interface OsrmManeuver {
  type: string;
  modifier?: string;
  location: [number, number];
  exit?: number;
}
interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  ref?: string;
  maneuver: OsrmManeuver;
}
interface OsrmLeg {
  distance: number;
  duration: number;
  steps: OsrmStep[];
}
interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: OsrmLeg[];
}
interface OsrmResponse {
  code: string;
  message?: string;
  routes?: OsrmRoute[];
}

const coordString = (points: LatLng[]) =>
  points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

async function osrmRequest(
  base: string,
  points: LatLng[],
  opts: { alternatives: boolean; steps: boolean; exclude?: string },
  signal?: AbortSignal,
): Promise<OsrmRoute[]> {
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: String(opts.steps),
    alternatives: String(opts.alternatives),
  });
  if (opts.exclude) params.set('exclude', opts.exclude);

  const url = `${base}/route/v1/driving/${coordString(points)}?${params.toString()}`;
  const data = await requestJson<OsrmResponse>(url, { signal, timeoutMs: 25000 });

  if (data.code === 'NoRoute') {
    throw new ApiError('noroute', 'No route found between these points. Try a point closer to a road.');
  }
  if (data.code === 'NoSegment') {
    throw new ApiError('noroute', 'One of the points is not near a road. Move it closer to a road or path.');
  }
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new ApiError('service', data.message || `Routing failed (${data.code}).`);
  }
  return data.routes;
}

const MODIFIER_ICON: Record<string, StepIcon> = {
  straight: 'straight',
  'slight right': 'slight-right',
  right: 'right',
  'sharp right': 'sharp-right',
  'slight left': 'slight-left',
  left: 'left',
  'sharp left': 'sharp-left',
  uturn: 'uturn',
};

const MODIFIER_TEXT: Record<string, string> = {
  straight: 'straight',
  'slight right': 'slightly right',
  right: 'right',
  'sharp right': 'sharply right',
  'slight left': 'slightly left',
  left: 'left',
  'sharp left': 'sharply left',
  uturn: 'around',
};

/** Joins non-empty words: join('Turn', '', 'onto X') → 'Turn onto X'. */
const join = (...parts: string[]) => parts.filter(Boolean).join(' ');

/** Converts an OSRM maneuver into a readable instruction and an icon. */
function describeOsrmStep(step: OsrmStep): { icon: StepIcon; text: string } {
  const m = step.maneuver;
  const mod = m.modifier ?? '';
  const dir = MODIFIER_TEXT[mod] ?? mod;
  const turnIcon = MODIFIER_ICON[mod] ?? 'straight';
  const onto = step.name ? `onto ${step.name}` : '';

  switch (m.type) {
    case 'depart':
      return {
        icon: 'depart',
        // OSRM gives a direction only when the first leg turns; otherwise just say where to start.
        text: step.name ? (dir ? join('Head', dir, 'on', step.name) : join('Start on', step.name)) : 'Start your journey',
      };
    case 'arrive':
      return { icon: 'arrive', text: 'You have arrived at your destination' };
    case 'turn':
      if (mod === 'uturn') return { icon: 'uturn', text: join('Make a U-turn', onto) };
      if (!mod || mod === 'straight') return { icon: 'straight', text: join('Continue straight', onto) };
      return { icon: turnIcon, text: join('Turn', dir, onto) };
    case 'merge':
      return { icon: 'merge', text: join('Merge', dir, onto) };
    case 'on ramp':
      return { icon: 'ramp', text: join('Take the ramp', dir, onto) };
    case 'off ramp':
      return { icon: 'ramp', text: join('Take the exit', dir, onto) };
    case 'fork':
      return { icon: 'fork', text: join('Keep', dir, 'at the fork', onto) };
    case 'end of road':
      return { icon: turnIcon, text: join('Turn', dir, 'at the end of the road', onto) };
    case 'roundabout':
    case 'rotary':
      return {
        icon: 'roundabout',
        text: join('Enter the roundabout', m.exit ? `and take exit ${m.exit}` : '', onto),
      };
    case 'roundabout turn':
      return { icon: 'roundabout', text: join('At the roundabout, turn', dir, onto) };
    case 'exit roundabout':
    case 'exit rotary':
      return { icon: 'roundabout', text: join('Leave the roundabout', onto) };
    case 'use lane':
      return { icon: turnIcon, text: join('Keep', dir, onto) };
    default: // "new name", "continue", "notification" …
      return { icon: turnIcon, text: join('Continue', dir || 'straight', onto) };
  }
}

/** A "turn" is any maneuver that is not a straight continuation. */
const countTurns = (steps: RouteStep[]) =>
  steps.filter((s) => !['straight', 'depart', 'arrive'].includes(s.icon)).length;

function fromOsrm(route: OsrmRoute, index: number, tag = ''): RouteOption {
  const steps: RouteStep[] = [];
  route.legs.forEach((leg, li) =>
    leg.steps.forEach((s, si) => {
      const { icon, text } = describeOsrmStep(s);
      steps.push({
        id: `osrm${tag}-${index}-${li}-${si}`,
        text,
        // Exact OSM name first, then the public route number from the shield.
        street: s.name ? (s.ref ? `${s.name} · ${s.ref}` : s.name) : s.ref || '',
        distance: s.distance,
        duration: s.duration,
        icon,
        lat: s.maneuver.location[1],
        lng: s.maneuver.location[0],
      });
    }),
  );
  return {
    id: `osrm${tag}-${index}`,
    provider: 'OSRM',
    distance: route.distance,
    duration: route.duration,
    turns: countTurns(steps),
    coords: route.geometry.coordinates,
    steps,
    tags: [],
    note: '',
  };
}

/* ======================= OpenRouteService (key) ======================= */

const ORS_PROFILE: Record<TravelMode, string> = {
  car: 'driving-car',
  bike: 'cycling-regular',
  walk: 'foot-walking',
};

/** ORS step type codes → icons (0 left … 13 keep right). */
const ORS_ICON: Record<number, StepIcon> = {
  0: 'left',
  1: 'right',
  2: 'sharp-right',
  3: 'sharp-left',
  4: 'slight-left',
  5: 'slight-right',
  6: 'straight',
  7: 'roundabout',
  8: 'roundabout',
  9: 'uturn',
  10: 'arrive',
  11: 'depart',
  12: 'slight-left',
  13: 'slight-right',
};

interface OrsStep {
  distance: number;
  duration: number;
  type: number;
  instruction: string;
  name: string;
  way_points: [number, number];
}
interface OrsFeature {
  geometry: { coordinates: [number, number][] };
  properties: {
    summary: { distance: number; duration: number };
    segments: { steps: OrsStep[] }[];
  };
}
interface OrsResponse {
  features?: OrsFeature[];
  error?: { message?: string };
}

async function orsRequest(
  mode: TravelMode,
  from: LatLng,
  to: LatLng,
  opts: { avoid?: string[]; alternatives: boolean },
  signal?: AbortSignal,
): Promise<RouteOption[]> {
  const body: Record<string, unknown> = {
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    instructions: true,
    units: 'm',
    language: 'en',
  };
  if (opts.avoid?.length) body.options = { avoid_features: opts.avoid };
  if (opts.alternatives) body.alternative_routes = { target_count: 2, share_factor: 0.6, weight_factor: 1.6 };

  const data = await requestJson<OrsResponse>(`${ROUTING.ors}/v2/directions/${ORS_PROFILE[mode]}/geojson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/geo+json, application/json',
      Authorization: ORS_API_KEY,
    },
    body: JSON.stringify(body),
    signal,
    timeoutMs: 25000,
  });
  if (!data.features?.length) throw new ApiError('noroute', data.error?.message || 'No route found.');

  const avoidsHighways = !!opts.avoid?.includes('highways');
  return data.features.map((f, i) => {
    const coords = f.geometry.coordinates;
    const steps: RouteStep[] = f.properties.segments.flatMap((seg, si) =>
      seg.steps.map((s, k) => {
        const at = coords[s.way_points[0]] ?? coords[0];
        return {
          id: `ors-${i}-${si}-${k}`,
          text: s.instruction,
          street: s.name && s.name !== '-' ? s.name : '',
          distance: s.distance,
          duration: s.duration,
          icon: ORS_ICON[s.type] ?? 'straight',
          lat: at[1],
          lng: at[0],
        };
      }),
    );
    return {
      id: `ors-${i}-${avoidsHighways ? 'avoid' : 'base'}`,
      provider: 'OpenRouteService',
      distance: f.properties.summary.distance,
      duration: f.properties.summary.duration,
      turns: countTurns(steps),
      coords,
      steps,
      tags: avoidsHighways ? ['avoids-highways'] : [],
      note: '',
    };
  });
}

/* ============================ Public API ============================ */

/**
 * Labels each route by what makes it different:
 * Shortest / Fastest / Fewer turns / Avoids highways. Sorted shortest-first,
 * so index 0 is the default (bright) route.
 */
export function annotateRoutes(routes: RouteOption[]): RouteOption[] {
  if (routes.length === 0) return routes;
  const sorted = [...routes].sort((a, b) => a.distance - b.distance);
  const shortest = sorted[0];
  const fastest = sorted.reduce((best, r) => (r.duration < best.duration ? r : best), sorted[0]);
  const fewestTurns = Math.min(...sorted.map((r) => r.turns));

  for (const r of sorted) {
    const parts: string[] = [];
    if (r === shortest) parts.push(r === fastest ? 'Shortest & fastest' : 'Shortest');
    else if (r === fastest) parts.push('Fastest');
    if (r.turns === fewestTurns && fewestTurns < shortest.turns) parts.push('Fewer turns');
    if (r.tags.includes('avoids-highways')) parts.push('Avoids highways');
    r.note = parts.length ? parts.join(' · ') : 'Alternative';
  }
  return sorted;
}

/** Drops routes that are effectively identical; merges their tags. */
function dedupe(routes: RouteOption[]): RouteOption[] {
  const out: RouteOption[] = [];
  for (const r of routes) {
    const twin = out.find(
      (u) => Math.abs(u.distance - r.distance) < 30 && Math.abs(u.duration - r.duration) < 20,
    );
    if (twin) {
      twin.tags = [...new Set([...twin.tags, ...r.tags])];
      continue;
    }
    out.push(r);
  }
  return out;
}

/** Route options between two points for the given travel mode. */
export async function fetchRoutes(
  from: LatLng,
  to: LatLng,
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<RouteOption[]> {
  let routes: RouteOption[] = [];

  // 1) OpenRouteService when a key is configured.
  if (ORS_API_KEY) {
    try {
      routes = await orsRequest(mode, from, to, { alternatives: true }, signal).catch((err) => {
        // Some profiles reject alternative_routes — retry the plain request.
        if (err instanceof ApiError && err.kind === 'badrequest') {
          return orsRequest(mode, from, to, { alternatives: false }, signal);
        }
        throw err;
      });
      if (mode === 'car') {
        const avoid = await orsRequest(mode, from, to, { avoid: ['highways'], alternatives: false }, signal).catch(
          (err) => {
            if (isAbortError(err)) throw err;
            return [] as RouteOption[];
          },
        );
        routes = [...routes, ...avoid];
      }
    } catch (err) {
      if (isAbortError(err) || (err instanceof ApiError && (err.kind === 'offline' || err.kind === 'noroute'))) {
        throw err;
      }
      console.warn('OpenRouteService failed; falling back to OSRM.', err);
      routes = [];
    }
  }

  // 2) OSRM (default, no key needed).
  if (routes.length === 0) {
    // OSRM alternatives. The public OSRM servers have no avoid options, so the
    // "Avoids highways" route comes only from ORS (see above).
    const base = ROUTING[mode];
    const alternatives = await osrmRequest(base, [from, to], { alternatives: true, steps: true }, signal);
    routes = alternatives.map((r, i) => fromOsrm(r, i));
  }

  return annotateRoutes(dedupe(routes));
}

export interface RoadLegs {
  legs: number[]; // metres between consecutive points
  total: number; // metres
  coords: [number, number][];
}

/** Driving distances between several points, visited in order (distance tool). */
export async function fetchRoadLegs(points: LatLng[], signal?: AbortSignal): Promise<RoadLegs> {
  const [route] = await osrmRequest(ROUTING.car, points, { alternatives: false, steps: false }, signal);
  return {
    legs: route.legs.map((l) => l.distance),
    total: route.distance,
    coords: route.geometry.coordinates,
  };
}
