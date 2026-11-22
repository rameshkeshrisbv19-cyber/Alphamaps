/**
 * MapController — owns the MapLibre instance and every map-side overlay:
 *  - live location: pulsing blue dot + translucent accuracy circle
 *  - routes: grey alternatives, bright selected route, A/B pins
 *  - distance tool: lettered draggable pins, dashed straight lines, road path
 *  - selected place pin and the highlighted step
 *
 * React never touches MapLibre directly; it calls these methods and listens
 * to the callbacks in MapHandlers. Overlay data is cached so it can be
 * re-applied whenever the style is swapped (theme change).
 */
import { Map as MapLibreMap, Marker, setWorkerCount, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre parses tiles in a web worker. By default that worker is a separate file
// next to the bundle, which a single-file build does not have. The worker is
// self-contained, so we inline its source and hand MapLibre a Blob URL. The whole
// app then ships as one self-contained index.html.
import mapWorkerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import { getStyle } from './styles';
import { labelField } from '../lib/languages';
import { circleRing, letterFor } from '../lib/geo';
import type { DistancePoint, GeoFix, LatLng, TapFeature, ThemeId } from '../types';

setWorkerUrl(URL.createObjectURL(new Blob([mapWorkerSource], { type: 'text/javascript' })));

// Tile parsing is the main startup cost. MapLibre defaults to one worker on
// Chrome, which serialises the first globe tiles. Use up to three workers on
// multi-core devices (and one on low-core phones) to parse tiles in parallel.
const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
setWorkerCount(Math.min(3, Math.max(1, Math.floor(cores / 2))));

type MLMap = InstanceType<typeof MapLibreMap>;
type MLMarker = InstanceType<typeof Marker>;
type LayerSpec = Parameters<MLMap['addLayer']>[0];
type Coords = [number, number][];

export interface TapEvent extends LatLng {
  features: TapFeature[];
}

export interface InitialView extends LatLng {
  zoom: number;
}

export interface MapInit {
  theme: ThemeId;
  lang: string;
  view: InitialView;
}

export interface MapHandlers {
  onTap?: (e: TapEvent) => void;
  onRouteSelect?: (index: number) => void;
  onPointDrag?: (id: string, at: LatLng) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/* ---- minimal GeoJSON helpers (local, so no GeoJSON typings are needed) ---- */

interface Feature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'LineString' | 'Polygon'; coordinates: unknown };
}
interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}
interface GeoJsonSourceLike {
  setData(data: FeatureCollection): void;
}

const featureCollection = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });
const lineFeature = (coords: Coords, properties: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates: coords },
});
const polygonFeature = (ring: Coords): Feature => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [ring] },
});

/* ---- styling constants for overlay layers ---- */

const ROUND = { 'line-cap': 'round', 'line-join': 'round' };
const ALT_WIDTH = ['interpolate', ['linear'], ['zoom'], 5, 3.5, 12, 6.5, 16, 10];
const SELECTED_WIDTH = ['interpolate', ['linear'], ['zoom'], 5, 4, 12, 7.5, 16, 11];
const SELECTED_CASING = ['interpolate', ['linear'], ['zoom'], 5, 7, 12, 10.5, 16, 14];
const ALT_CASING = ['interpolate', ['linear'], ['zoom'], 5, 5.5, 12, 8.5, 16, 13];
/** Nudges a teardrop pin up so its tip sits exactly on the coordinate. */
const PIN_OFFSET: [number, number] = [0, -6];

interface MarkerSpec {
  className: string;
  html: string;
  anchor: 'center' | 'bottom';
  /** Pixel nudge so a teardrop's tip lands exactly on its coordinate. */
  offset?: [number, number];
  /** Markers are rebuilt only when this signature changes; otherwise they just move. */
  sig: string;
  draggable?: boolean;
  onDragEnd?: (at: LatLng) => void;
}

export class MapController {
  private readonly map: MLMap;
  private readonly handlers: MapHandlers;
  private theme: ThemeId;
  private lang: string;
  private readonly markers = new Map<string, MLMarker>();
  /** Overlay data kept in memory so it survives style swaps. */
  private readonly overlay = {
    location: null as GeoFix | null,
    routes: [] as Coords[],
    selected: 0,
    distance: [] as Coords,
    road: null as Coords | null,
  };
  private readyNotified = false;
  private errorNotified = false;

  constructor(container: HTMLElement, init: MapInit, handlers: MapHandlers) {
    this.handlers = handlers;
    this.theme = init.theme;
    this.lang = init.lang;

    this.map = new MapLibreMap({
      container,
      style: getStyle(init.theme, init.lang),
      center: [init.view.lng, init.view.lat],
      zoom: init.view.zoom,
      minZoom: 0.3,
      maxZoom: 19,
      maxPitch: 70,
      attributionControl: false, // credits are rendered by <Attribution /> instead
      fadeDuration: 0, // no tile cross-fade: first paint is immediate
      dragRotate: true,
      pitchWithRotate: true,
      // --- startup & memory tuning -------------------------------------------
      // Cap the backing-store resolution on high-DPI phones (3x → 2x is a
      // 2.25× pixel saving) and ask for the fast GPU.
      pixelRatio: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
      canvasContextAttributes: { antialias: false, powerPreference: 'high-performance' },
      // Do not block tiles from refreshing when they expire; correctness wins
      // over a marginally cheaper session.
      refreshExpiredTiles: true,
      // Render the world normally at low zoom so the whole globe is present.
      renderWorldCopies: true,
      // Keep enough tiles for a full city/globe view without evicting visible ones.
      maxTileCacheSize: 200,
      // The style is built locally; skip the expensive style validation pass.
      validateStyle: false,
    });

    this.map.on('style.load', () => this.handleStyleLoad());
    this.map.on('click', (e) => this.handleClick(e));
    this.map.on('error', (e) => this.handleError(e));

    // Keep the splash until the map has finished its first full idle pass, so
    // the user never sees a half-loaded map. A long timeout is a safety net.
    this.map.once('idle', () => this.notifyReady());
    window.setTimeout(() => this.notifyReady(), 8000);
  }

  /* ============================ style & lifecycle ============================ */

  private handleStyleLoad(): void {
    this.addOverlayLayers();
    this.syncOverlays();
  }

  private notifyReady(): void {
    if (this.readyNotified) return;
    this.readyNotified = true;
    this.handlers.onReady?.();
  }

  private handleError(e: { error?: unknown }): void {
    console.warn('[map]', (e.error as Error | undefined)?.message ?? e.error);
    if (!this.errorNotified && typeof navigator !== 'undefined' && !navigator.onLine) {
      this.errorNotified = true;
      this.handlers.onError?.('Offline: only map areas you have already viewed are available.');
    }
  }

  /** Swaps the style (Noir / Light / Dark). Overlays are re-applied on style.load. */
  setTheme(theme: ThemeId): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.map.setStyle(getStyle(theme, this.lang), { diff: false });
  }

  /** Switches label language without reloading the style (text-field expressions). */
  setLang(lang: string): void {
    if (lang === this.lang) return;
    this.lang = lang;
    if (!this.map.isStyleLoaded()) return; // the next style build will use the new language
    for (const layer of this.map.getStyle().layers) {
      const meta = (layer as { metadata?: Record<string, unknown> }).metadata;
      if (layer.type === 'symbol' && meta?.['alpha-map:label']) {
        // labelField returns a style-spec expression; cast to the layout value type.
        this.map.setLayoutProperty(layer.id, 'text-field', labelField(lang) as never);
      }
    }
  }

  /** The first symbol layer: route/overlay lines are inserted beneath labels. */
  private firstSymbolLayerId(): string | undefined {
    return this.map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  }

  private addOverlayLayers(): void {
    const m = this.map;
    const before = this.firstSymbolLayerId();
    const addSource = (id: string) => {
      if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    };
    const addLayer = (layer: Record<string, unknown>) => m.addLayer(layer as unknown as LayerSpec, before);

    // Location halo (under everything else)
    addSource('loc-acc');
    addLayer({ id: 'loc-acc-fill', type: 'fill', source: 'loc-acc', paint: { 'fill-color': '#2f80ff', 'fill-opacity': 0.14 } });
    addLayer({
      id: 'loc-acc-line',
      type: 'line',
      source: 'loc-acc',
      paint: { 'line-color': '#2f80ff', 'line-width': 1.2, 'line-opacity': 0.55 },
    });

    // Distance tool road path (white) and dashed straight lines (yellow)
    addSource('dist-road');
    addLayer({ id: 'dist-road-line', type: 'line', source: 'dist-road', layout: ROUND, paint: { 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 0.85 } });
    addSource('dist-straight');
    addLayer({
      id: 'dist-straight-line',
      type: 'line',
      source: 'dist-straight',
      paint: { 'line-color': '#ffd400', 'line-width': 2.2, 'line-dasharray': [1.2, 1.4] },
    });

    // Routes: alternatives in grey (tappable), selected route bright yellow on a dark casing
    addSource('route-alt');
    // Alternatives: a grey line with a contrasting casing (black on dark maps, white on
    // light ones) so they stay visible on top of grey roads.
    // Per theme: a grey band with a dark outline (light maps: grey with a dark outline too),
    // deliberately darker than the light Noir roads so alternatives stand out from them.
    const alt = this.theme === 'normal'
      ? { fill: '#9e9e9e', outline: '#3d3d3d' }
      : { fill: this.theme === 'noir' ? '#7a7a7a' : '#a6a6a6', outline: '#000000' };
    addLayer({ id: 'route-alt-casing', type: 'line', source: 'route-alt', layout: ROUND, paint: { 'line-color': alt.outline, 'line-width': ALT_CASING, 'line-opacity': 0.9 } });
    addLayer({ id: 'route-alt-line', type: 'line', source: 'route-alt', layout: ROUND, paint: { 'line-color': alt.fill, 'line-width': ALT_WIDTH, 'line-opacity': 1 } });
    addSource('route-sel');
    addLayer({ id: 'route-sel-casing', type: 'line', source: 'route-sel', layout: ROUND, paint: { 'line-color': '#000000', 'line-width': SELECTED_CASING, 'line-opacity': 0.6 } });
    addLayer({ id: 'route-sel-line', type: 'line', source: 'route-sel', layout: ROUND, paint: { 'line-color': '#ffd400', 'line-width': SELECTED_WIDTH } });
  }

  /* ============================ overlay data ============================ */

  /** Pushes cached overlay data into the GeoJSON sources. */
  private syncOverlays(): void {
    const o = this.overlay;
    const sel = o.routes[o.selected];
    this.setSourceData('loc-acc', featureCollection(
      o.location ? [polygonFeature(circleRing(o.location, Math.max(o.location.accuracy, 8)))] : [],
    ));
    this.setSourceData('route-alt', featureCollection(
      o.routes.flatMap((c, i) => (i === o.selected ? [] : [lineFeature(c, { index: i })])),
    ));
    this.setSourceData('route-sel', featureCollection(sel ? [lineFeature(sel, { index: o.selected })] : []));
    this.setSourceData('dist-straight', featureCollection(o.distance.length > 1 ? [lineFeature(o.distance)] : []));
    this.setSourceData('dist-road', featureCollection(o.road && o.road.length > 1 ? [lineFeature(o.road)] : []));
  }

  private setSourceData(id: string, data: FeatureCollection): void {
    const source = this.map.getSource(id) as unknown as GeoJsonSourceLike | undefined;
    source?.setData(data);
  }

  /* ============================ markers ============================ */

  private upsertMarker(key: string, at: LatLng | null, spec: MarkerSpec): void {
    if (!at) {
      this.removeMarker(key);
      return;
    }
    const current = this.markers.get(key);
    if (current && current.getElement().dataset.sig === spec.sig) {
      current.setLngLat([at.lng, at.lat]);
      return;
    }
    this.removeMarker(key);

    // MapLibre applies its own CSS transform to the element it is given in order to place
    // the marker. Animations and rotations (pin drop, teardrop shape) therefore live on a
    // child element, so they can never fight with the positioning.
    const root = document.createElement('div');
    root.className = 'mk';
    root.dataset.sig = spec.sig;
    const visual = document.createElement('div');
    visual.className = spec.className;
    visual.innerHTML = spec.html;
    root.appendChild(visual);
    // Keep marker taps from also reaching the map's tap handler.
    root.addEventListener('click', (ev) => ev.stopPropagation());

    const marker = new Marker({
      element: root,
      anchor: spec.anchor,
      offset: spec.offset,
      draggable: spec.draggable ?? false,
    })
      .setLngLat([at.lng, at.lat])
      .addTo(this.map);
    if (spec.draggable && spec.onDragEnd) {
      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        spec.onDragEnd?.({ lat: ll.lat, lng: ll.lng });
      });
    }
    this.markers.set(key, marker);
  }

  private removeMarker(key: string): void {
    this.markers.get(key)?.remove();
    this.markers.delete(key);
  }

  /* ============================ public API ============================ */

  /** Live location dot + accuracy halo. Pass null to hide. */
  setLocation(fix: GeoFix | null): void {
    this.overlay.location = fix;
    this.upsertMarker('location', fix, {
      className: 'loc-dot',
      html: '<span class="loc-core"></span>',
      anchor: 'center',
      sig: 'loc',
    });
    this.syncOverlays();
  }

  /** Pin for the selected place. Pass null to remove. */
  setPin(at: LatLng | null): void {
    this.upsertMarker('pin', at, { className: 'pin pin-place', html: '', anchor: 'bottom', offset: PIN_OFFSET, sig: 'pin' });
  }

  /** Ring highlighting the step the user tapped in the turn list. */
  setStepFocus(at: LatLng | null): void {
    this.upsertMarker('step', at, { className: 'step-ring', html: '', anchor: 'center', sig: 'step' });
  }

  /** Route lines (index 0 = shortest) with the selected one highlighted, plus A/B pins. */
  setRoutes(routes: Coords[], selected: number, start: LatLng | null, end: LatLng | null): void {
    this.overlay.routes = routes;
    this.overlay.selected = selected;
    this.upsertMarker('route-start', start, { className: 'pin pin-start', html: '<span>A</span>', anchor: 'bottom', offset: PIN_OFFSET, sig: 'start' });
    this.upsertMarker('route-end', end, { className: 'pin pin-end', html: '<span>B</span>', anchor: 'bottom', offset: PIN_OFFSET, sig: 'end' });
    this.syncOverlays();
  }

  /** Distance-tool points (lettered, draggable) with the straight polyline and road path. */
  setDistance(points: DistancePoint[], road: Coords | null): void {
    this.overlay.distance = points.map((p): [number, number] => [p.lng, p.lat]);
    this.overlay.road = road;

    const keep = new Set<string>();
    points.forEach((p, i) => {
      const key = `pt-${p.id}`;
      const letter = letterFor(i);
      keep.add(key);
      this.upsertMarker(key, p, {
        className: 'pin pin-point',
        html: `<span>${letter}</span>`,
        anchor: 'bottom',
        offset: PIN_OFFSET,
        sig: `pt-${letter}`,
        draggable: true,
        onDragEnd: (at) => this.handlers.onPointDrag?.(p.id, at),
      });
    });
    for (const key of [...this.markers.keys()]) {
      if (key.startsWith('pt-') && !keep.has(key)) this.removeMarker(key);
    }
    this.syncOverlays();
  }

  /** Smoothly flies to a point (default zoom keeps the current zoom if it is already close). */
  flyTo(at: LatLng, zoom?: number): void {
    this.map.flyTo({
      center: [at.lng, at.lat],
      zoom: zoom ?? Math.max(this.map.getZoom(), 13),
      speed: 1.3,
      curve: 1.42,
      essential: true,
    });
  }

  /** Fits the camera to a set of [lng, lat] coordinates, respecting UI padding. */
  fitTo(coords: Coords, padding: Padding): void {
    if (coords.length === 0) return;
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
    this.map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding, maxZoom: 15.5, duration: 900 },
    );
  }

  /** 3D view on/off: tilts the camera so extruded buildings are visible. */
  setTilt(on: boolean): void {
    this.map.easeTo({ pitch: on ? 60 : 0, bearing: on ? this.map.getBearing() : 0, duration: 700 });
  }

  zoomBy(delta: number): void {
    this.map.easeTo({ zoom: this.map.getZoom() + delta, duration: 350 });
  }

  /* ============================ input ============================ */

  private handleClick(e: { point: { x: number; y: number }; lngLat: { lat: number; lng: number } }): void {
    const { x, y } = e.point;

    // 1) Tapping an alternative route selects it.
    if (this.map.getLayer('route-alt-line')) {
      const hits = this.map.queryRenderedFeatures(
        [
          [x - 10, y - 10],
          [x + 10, y + 10],
        ],
        { layers: ['route-alt-line'] },
      );
      const index = hits.length ? Number(hits[0].properties?.index) : NaN;
      if (Number.isInteger(index)) {
        this.handlers.onRouteSelect?.(index);
        return;
      }
    }

    // 2) Any other tap reports the location and the features beneath it.
    const features: TapFeature[] = this.map.queryRenderedFeatures([x, y]).map((f) => ({
      sourceLayer: f.sourceLayer,
      properties: (f.properties ?? {}) as Record<string, unknown>,
    }));
    this.handlers.onTap?.({ lat: e.lngLat.lat, lng: e.lngLat.lng, features });
  }

  /* ============================ cleanup ============================ */

  destroy(): void {
    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();
    this.map.remove();
  }
}
