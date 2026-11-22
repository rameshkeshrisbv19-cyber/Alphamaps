/**
 * JSON style builder shared by the Noir, Light and Dark themes.
 *
 * All three themes use the same layer recipe (OpenMapTiles schema, served by
 * OpenFreeMap or MapTiler) and differ only in their Palette. The result of
 * buildStyle() is a plain MapLibre style JSON object — it can be inspected,
 * exported or edited like any other style.
 *
 * Map features covered:
 *  - Globe projection with country / continent / ocean / sea names at low zoom
 *  - Flat buildings from z13, 3D extruded buildings from z15
 *  - Roads (major / minor / paths / rail), boundaries, rivers, road names and
 *    public route numbers (motorway / trunk / primary refs)
 *  - Label language switching via name:xx with fallback to name / name:latin
 */
import type { StyleSpecification } from 'maplibre-gl';
import { ATTRIBUTION, TILE_ENDPOINTS } from '../../config';
import { labelField } from '../../lib/languages';
import type { ThemeId } from '../../types';

/** Colours and per-theme options. Everything visual about a theme lives here. */
export interface Palette {
  id: ThemeId;
  name: string;
  background: string;
  landcover: string;
  landuse: string;
  park: string;
  water: string;
  waterway: string;
  building: string;
  buildingOutline: string;
  extrusion: string;
  extrusionOpacity: number;
  roadMajor: string;
  roadMinor: string;
  roadPath: string;
  roadCasing: string | null;
  rail: string;
  boundaryCountry: string;
  boundaryState: string;
  label: string;
  labelMinor: string;
  labelHalo: string;
  roadLabel: string;
  /** Public route number / shield text (motorway & trunk refs). */
  routeLabel: string;
  waterLabel: string;
  /** Colour of small POI dots; null = no POI icons (Noir). */
  poi: string | null;
  /** Atmosphere/sky settings used by the globe. */
  sky: Record<string, string | number>;
}

type Json = Record<string, unknown>;

const SOURCE = 'openmaptiles';
const REGULAR = 'Noto Sans Regular';
const BOLD = 'Noto Sans Bold';
const ITALIC = 'Noto Sans Italic';

// Road classes (OpenMapTiles `transportation.class`)
const MAJOR_HW = ['motorway', 'trunk'];
const MAJOR = ['primary', 'secondary'];
const MINOR = ['tertiary', 'minor', 'service'];
const PATHS = ['path', 'track', 'pedestrian', 'busway', 'raceway'];
const RAIL = ['rail', 'transit'];

/** Filter: the feature's `key` is one of `values`. */
const inList = (key: string, values: string[]) => ['in', ['get', key], ['literal', values]];
const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];

/** Linear zoom ramp: zl(z0, v0, z1, v1, …) */
const zl = (...stops: number[]) => ['interpolate', ['linear'], ['zoom'], ...stops];
/** Exponential zoom ramp (natural for line widths). */
const ze = (...stops: number[]) => ['interpolate', ['exponential', 1.4], ['zoom'], ...stops];
/** Adds `delta` to every value of a zoom ramp (used for road casings). */
const widen = (delta: number, stops: number[]) => stops.map((v, i) => (i % 2 === 1 ? v + delta : v));

const LABEL_META = { 'alpha-map:label': true };

interface LabelOpts {
  id: string;
  sourceLayer: string;
  filter?: unknown;
  minzoom: number;
  font?: string;
  size: unknown;
  placement?: 'point' | 'line';
  upper?: boolean;
  spacing?: number;
  /** Distance between repeated labels along a line (default MapLibre 250). */
  symbolSpacing?: number;
  keepUpright?: boolean;
  sortKey?: unknown;
  color: string;
  halo: string;
  haloWidth?: number;
  anchor?: string;
  offset?: number[];
}

/** Symbol layer whose text-field follows the selected label language. */
function labelLayer(lang: string, o: LabelOpts): Json {
  const layout: Json = {
    'text-field': labelField(lang),
    'text-font': [o.font ?? REGULAR],
    'text-size': o.size,
    'text-letter-spacing': o.spacing ?? 0,
    'text-transform': o.upper ? 'uppercase' : 'none',
    'text-max-width': 8,
    'text-padding': 4,
    'text-allow-overlap': false,
    'text-anchor': o.anchor ?? 'center',
    'symbol-placement': o.placement ?? 'point',
    'text-keep-upright': o.keepUpright ?? true,
  };
  if (o.offset) layout['text-offset'] = o.offset;
  if (o.sortKey !== undefined) layout['symbol-sort-key'] = o.sortKey;
  if (o.symbolSpacing !== undefined) layout['symbol-spacing'] = o.symbolSpacing;
  if (o.placement === 'line') layout['text-max-angle'] = 30;

  return {
    id: o.id,
    type: 'symbol',
    source: SOURCE,
    'source-layer': o.sourceLayer,
    minzoom: o.minzoom,
    filter: o.filter,
    metadata: LABEL_META,
    layout,
    paint: {
      'text-color': o.color,
      'text-halo-color': o.halo,
      'text-halo-width': o.haloWidth ?? 1.3,
      'text-halo-blur': 0.4,
    },
  };
}

/** The ordered layer list. Drawing order: ground → buildings → roads → 3D → labels. */
export function buildLayers(p: Palette, lang: string): Json[] {
  const src = { source: SOURCE };
  const L: Json[] = [];

  /* ---------- ground ---------- */
  L.push({ id: 'background', type: 'background', paint: { 'background-color': p.background } });
  L.push({ id: 'landcover', type: 'fill', ...src, 'source-layer': 'landcover', minzoom: 0, paint: { 'fill-color': p.landcover } });
  L.push({ id: 'landuse', type: 'fill', ...src, 'source-layer': 'landuse', minzoom: 5, paint: { 'fill-color': p.landuse } });
  L.push({ id: 'park', type: 'fill', ...src, 'source-layer': 'park', minzoom: 3, paint: { 'fill-color': p.park } });
  L.push({ id: 'water', type: 'fill', ...src, 'source-layer': 'water', paint: { 'fill-color': p.water } });
  L.push({
    id: 'waterway',
    type: 'line',
    ...src,
    'source-layer': 'waterway',
    minzoom: 8,
    paint: { 'line-color': p.waterway, 'line-width': ze(8, 0.4, 14, 2, 18, 6) },
  });

  /* ---------- flat buildings (z13–15) with a light grey outline ---------- */
  L.push({
    id: 'building',
    type: 'fill',
    ...src,
    'source-layer': 'building',
    minzoom: 13,
    maxzoom: 15,
    paint: { 'fill-color': p.building, 'fill-opacity': zl(13, 0, 13.6, 1) },
  });
  L.push({
    id: 'building-outline',
    type: 'line',
    ...src,
    'source-layer': 'building',
    minzoom: 13.2,
    paint: {
      'line-color': p.buildingOutline,
      'line-width': zl(13.2, 0.3, 17, 1),
      'line-opacity': zl(13.2, 0, 13.8, 0.85),
    },
  });

  /* ---------- rail, paths and roads ---------- */
  L.push({
    id: 'rail',
    type: 'line',
    ...src,
    'source-layer': 'transportation',
    minzoom: 12,
    filter: ['all', inList('class', RAIL), notTunnel],
    paint: { 'line-color': p.rail, 'line-width': ze(12, 0.5, 16, 1.4), 'line-dasharray': [3, 2] },
  });
  L.push({
    id: 'road-path',
    type: 'line',
    ...src,
    'source-layer': 'transportation',
    minzoom: 13,
    filter: ['all', inList('class', PATHS), notTunnel],
    paint: { 'line-color': p.roadPath, 'line-width': ze(13, 0.4, 16, 1.2, 18, 2.6) },
  });

  const road = (id: string, classes: string[], color: string, stops: number[]) => {
    const filter = ['all', inList('class', classes), notTunnel];
    const layout = { 'line-cap': 'round', 'line-join': 'round' };
    if (p.roadCasing) {
      L.push({
        id: `${id}-casing`,
        type: 'line',
        ...src,
        'source-layer': 'transportation',
        minzoom: stops[0],
        filter,
        layout,
        paint: { 'line-color': p.roadCasing, 'line-width': ze(...widen(1.2, stops)) },
      });
    }
    L.push({
      id,
      type: 'line',
      ...src,
      'source-layer': 'transportation',
      minzoom: stops[0],
      filter,
      layout,
      paint: { 'line-color': color, 'line-width': ze(...stops) },
    });
  };
  road('road-major-hw', MAJOR_HW, p.roadMajor, [5, 0.8, 8, 1.4, 10, 2.4, 12, 3.6, 14, 6.5, 16, 12, 18, 24]);
  road('road-major', MAJOR, p.roadMajor, [7, 0.5, 9, 1, 11, 1.8, 13, 3.4, 15, 7, 17, 14]);
  road('road-minor', MINOR, p.roadMinor, [11, 0.4, 13, 1.2, 15, 3.2, 17, 8]);

  /* ---------- 3D buildings (z15+) ---------- */
  L.push({
    id: 'building-3d',
    type: 'fill-extrusion',
    ...src,
    'source-layer': 'building',
    minzoom: 15,
    filter: ['!=', ['get', 'hide_3d'], true],
    paint: {
      'fill-extrusion-color': p.extrusion,
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 9],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': zl(15, 0, 15.6, p.extrusionOpacity),
      'fill-extrusion-vertical-gradient': true,
    },
  });

  /* ---------- borders ----------
     Country outlines get a dark casing plus a clearly visible grey line so
     they read at every zoom, including the initial globe view. State lines
     are thinner and dashed. */
  const boundaryLayout = { 'line-cap': 'round', 'line-join': 'round' };
  L.push({
    id: 'boundary-state',
    type: 'line',
    ...src,
    'source-layer': 'boundary',
    minzoom: 3,
    filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
    layout: boundaryLayout,
    paint: {
      'line-color': p.boundaryState,
      'line-width': ze(3, 0.7, 8, 1.3, 12, 1.9),
      'line-opacity': 0.95,
      'line-dasharray': [3, 2],
    },
  });
  L.push({
    id: 'boundary-country-casing',
    type: 'line',
    ...src,
    'source-layer': 'boundary',
    minzoom: 0,
    filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
    layout: boundaryLayout,
    paint: {
      'line-color': p.roadCasing ?? p.labelHalo,
      'line-width': ze(0, 1.6, 4, 2.6, 8, 3.6, 12, 4.4),
      'line-opacity': 0.85,
    },
  });
  L.push({
    id: 'boundary-country',
    type: 'line',
    ...src,
    'source-layer': 'boundary',
    minzoom: 0,
    filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
    layout: boundaryLayout,
    paint: {
      'line-color': p.boundaryCountry,
      'line-width': ze(0, 1, 4, 1.6, 8, 2.6, 12, 3.4),
      'line-opacity': 1,
    },
  });

  if (p.poi) {
    L.push({
      id: 'poi-dot',
      type: 'circle',
      ...src,
      'source-layer': 'poi',
      minzoom: 15,
      paint: {
        'circle-radius': zl(15, 2, 18, 4.5),
        'circle-color': p.poi,
        'circle-stroke-color': p.labelHalo,
        'circle-stroke-width': 1,
      },
    });
  }

  /* ---------- labels (drawn last, always on top) ---------- */

  // Globe-level names: continents, countries, oceans and seas are visible from zoom 0.
  L.push(
    labelLayer(lang, {
      id: 'label-continent',
      sourceLayer: 'place',
      filter: ['==', ['get', 'class'], 'continent'],
      minzoom: 0,
      font: BOLD,
      size: zl(0, 11, 3, 16),
      upper: true,
      spacing: 2,
      color: p.label,
      halo: p.labelHalo,
      haloWidth: 1.6,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-ocean',
      sourceLayer: 'water_name',
      filter: inList('class', ['ocean', 'sea', 'gulf', 'bay', 'strait']),
      minzoom: 0,
      font: ITALIC,
      size: zl(0, 11, 2, 13, 4, 17),
      spacing: 1.5,
      color: p.waterLabel,
      halo: p.labelHalo,
      haloWidth: 1,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-country',
      sourceLayer: 'place',
      filter: ['==', ['get', 'class'], 'country'],
      minzoom: 0,
      font: BOLD,
      size: zl(0, 10, 2, 12, 4, 14, 6, 16),
      sortKey: ['get', 'rank'],
      color: p.label,
      halo: p.labelHalo,
      haloWidth: 1.5,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-lake',
      sourceLayer: 'water_name',
      filter: inList('class', ['lake', 'reservoir', 'lagoon']),
      minzoom: 5,
      font: ITALIC,
      size: zl(5, 10, 10, 13),
      color: p.waterLabel,
      halo: p.labelHalo,
    }),
  );

  // Settlements
  L.push(
    labelLayer(lang, {
      id: 'label-state',
      sourceLayer: 'place',
      filter: inList('class', ['state', 'province']),
      minzoom: 4,
      size: zl(4, 9.5, 7, 12),
      sortKey: ['get', 'rank'],
      color: p.labelMinor,
      halo: p.labelHalo,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-city',
      sourceLayer: 'place',
      filter: ['==', ['get', 'class'], 'city'],
      minzoom: 2,
      size: zl(2, 10, 6, 14, 10, 17),
      sortKey: ['get', 'rank'],
      color: p.label,
      halo: p.labelHalo,
      haloWidth: 1.4,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-town',
      sourceLayer: 'place',
      filter: ['==', ['get', 'class'], 'town'],
      minzoom: 6,
      size: zl(6, 9.5, 10, 13),
      sortKey: ['get', 'rank'],
      color: p.label,
      halo: p.labelHalo,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-village',
      sourceLayer: 'place',
      filter: inList('class', ['village', 'hamlet']),
      minzoom: 9,
      size: zl(9, 9, 12, 12),
      sortKey: ['get', 'rank'],
      color: p.labelMinor,
      halo: p.labelHalo,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-suburb',
      sourceLayer: 'place',
      filter: inList('class', ['suburb', 'neighbourhood', 'quarter', 'island', 'islet']),
      minzoom: 12,
      size: zl(12, 9, 15, 11.5),
      sortKey: ['get', 'rank'],
      color: p.labelMinor,
      halo: p.labelHalo,
    }),
  );

  // Natural features, rivers and roads
  L.push(
    labelLayer(lang, {
      id: 'label-peak',
      sourceLayer: 'mountain_peak',
      minzoom: 9,
      size: zl(9, 9.5, 13, 12),
      color: p.labelMinor,
      halo: p.labelHalo,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-waterway',
      sourceLayer: 'waterway',
      filter: inList('class', ['river', 'canal']),
      minzoom: 12,
      placement: 'line',
      font: ITALIC,
      size: zl(12, 9.5, 16, 12),
      color: p.waterLabel,
      halo: p.labelHalo,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-road-major',
      sourceLayer: 'transportation_name',
      filter: inList('class', [...MAJOR_HW, ...MAJOR]),
      minzoom: 11,
      placement: 'line',
      size: zl(11, 9.5, 14, 11.5, 17, 13),
      symbolSpacing: 480,
      color: p.roadLabel,
      halo: p.labelHalo,
      haloWidth: 1.2,
    }),
  );
  L.push(
    labelLayer(lang, {
      id: 'label-road-minor',
      sourceLayer: 'transportation_name',
      filter: inList('class', [...MINOR, ...PATHS]),
      minzoom: 14.5,
      placement: 'line',
      size: zl(14.5, 9, 17, 11),
      symbolSpacing: 340,
      color: p.roadLabel,
      halo: p.labelHalo,
      haloWidth: 1.2,
    }),
  );

  /* Public route number / shield (I-5, US 101, M1, A14 …).
     OpenMapTiles carries the signposted number in `ref`. It is a separate
     symbol layer so the exact street name can still be drawn beside it. */
  L.push({
    id: 'label-road-ref',
    type: 'symbol',
    source: SOURCE,
    'source-layer': 'transportation_name',
    minzoom: 10,
    filter: [
      'all',
      inList('class', [...MAJOR_HW, ...MAJOR]),
      ['has', 'ref'],
      ['!=', ['get', 'ref'], ''],
    ],
    layout: {
      'text-field': ['coalesce', ['get', 'ref'], ['get', 'ref:en']],
      'text-font': [BOLD],
      'text-size': zl(10, 9, 14, 10.5, 17, 12),
      'text-letter-spacing': 0.04,
      'text-transform': 'uppercase',
      'text-max-width': 6,
      'text-padding': 4,
      'text-allow-overlap': false,
      'text-anchor': 'center',
      'text-keep-upright': true,
      'symbol-placement': 'line',
      'symbol-spacing': 620,
      'text-max-angle': 30,
    },
    paint: {
      'text-color': p.routeLabel,
      'text-halo-color': p.labelHalo,
      'text-halo-width': 1.6,
      'text-halo-blur': 0.3,
    },
  });
  L.push(
    labelLayer(lang, {
      id: 'label-poi',
      sourceLayer: 'poi',
      minzoom: 16,
      size: zl(16, 10, 18, 12),
      anchor: p.poi ? 'top' : 'center',
      offset: p.poi ? [0, 0.9] : undefined,
      color: p.labelMinor,
      halo: p.labelHalo,
    }),
  );

  return L;
}

/** Builds the complete MapLibre style document for a palette and label language. */
export function buildStyle(p: Palette, lang: string): StyleSpecification {
  const style = {
    version: 8,
    name: `Alpha Maps — ${p.name}`,
    // Full Earth globe: MapLibre switches to a flat map automatically when zooming in.
    projection: { type: 'globe' },
    sky: p.sky,
    glyphs: TILE_ENDPOINTS.glyphs,
    sources: {
      [SOURCE]: { type: 'vector', url: TILE_ENDPOINTS.tileJson, attribution: ATTRIBUTION },
    },
    layers: buildLayers(p, lang),
  };
  // Round-trip through JSON: a plain, serialisable style (undefined values dropped).
  return JSON.parse(JSON.stringify(style)) as StyleSpecification;
}
