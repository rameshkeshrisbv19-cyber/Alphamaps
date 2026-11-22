/**
 * App — the single page. It composes the map, the search and settings chrome,
 * and the bottom-sheet / side-panel views, and owns all application state.
 * MapController owns everything that touches MapLibre.
 *
 * Interaction mode is derived from state:
 *  - browse    : a tap opens the place card
 *  - measure   : a tap adds a distance-tool point (Distance panel open)
 *  - pickStart : a tap sets the directions start (after "Pick on map")
 */
import { useEffect, useRef, useState } from 'react';
import { MapController, type InitialView, type Padding, type TapEvent } from './map/MapController';
import { THEME_OPTIONS } from './map/styles';
import { SearchBox } from './components/SearchBox';
import { SettingsBar } from './components/SettingsBar';
import { MapButtons } from './components/MapButtons';
import { Sheet } from './components/Sheet';
import { PlacePanel } from './components/PlacePanel';
import { DirectionsPanel } from './components/DirectionsPanel';
import { MiniDirections } from './components/MiniDirections';
import { DistancePanel } from './components/DistancePanel';
import { Attribution } from './components/Attribution';
import { ToastView } from './components/Feedback';
import { LocationWatcher, type GeoErrorInfo } from './lib/location';
import { reversePlace, type PlaceResult } from './lib/geocode';
import { fetchRoadLegs, fetchRoutes } from './lib/routing';
import { ApiError, errorMessage, isAbortError } from './lib/http';
import { pickNamedPlace } from './lib/places';
import { globeZoomFor } from './lib/geo';
import { KEYS, readPref, writePref } from './lib/storage';
import type {
  DistancePoint,
  GeoFix,
  GeoState,
  LatLng,
  PanelKind,
  PlaceInfo,
  RoadState,
  RouteQuery,
  RouteResult,
  RouteStep,
  ThemeId,
  Toast,
  ToastTone,
  TravelMode,
  Units,
} from './types';

/** Maximum points in the distance tool. */
const MAX_POINTS = 26;

const IDLE_ROUTES: RouteResult = { status: 'idle', routes: [], selected: 0 };
const IDLE_ROAD: RoadState = { status: 'idle', legs: [], total: 0, coords: [] };

/** Handlers the map calls. Stored in a ref so the map always sees the latest closures. */
interface HandlerSet {
  onTap: (e: TapEvent) => void;
  onRoute: (index: number) => void;
  onDrag: (id: string, at: LatLng) => void;
  onFix: (fix: GeoFix) => void;
  onGeoError: (err: GeoErrorInfo) => void;
}

/* ------------------------------ helpers ------------------------------ */

const urlParam = (name: string): string | null => new URLSearchParams(window.location.search).get(name);

const normalizeTheme = (value: string): ThemeId =>
  value === 'normal' || value === 'dark' || value === 'noir' ? value : 'noir';

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Removes the static boot splash from index.html once the map is ready. */
function dismissBoot(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('hide');
  window.setTimeout(() => boot.remove(), 500);
}

/** Keeps routes clear of the bottom sheet (phones) or the side panel (desktop). */
function fitPadding(): Padding {
  return window.matchMedia('(min-width: 768px)').matches
    ? { top: 90, bottom: 60, left: 440, right: 80 }
    : { top: 130, bottom: 340, left: 40, right: 40 };
}

/**
 * Initial camera: the whole globe, sized to the screen so it is fully visible.
 * Supports deep links: ?lat=..&lng=..&z=..
 */
function initialView(host: HTMLElement): InitialView {
  const lat = parseFloat(urlParam('lat') ?? '');
  const lng = parseFloat(urlParam('lng') ?? '');
  const z = parseFloat(urlParam('z') ?? '');
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, zoom: Number.isFinite(z) ? z : 15 };
  }
  const width = host.clientWidth || window.innerWidth;
  const height = host.clientHeight || window.innerHeight;
  return { lat: 18, lng: 12, zoom: globeZoomFor(width, height) };
}

/** Puts a GPS fix into distance point A (replacing A if it exists). */
function withLocationAsA(prev: DistancePoint[], fix: GeoFix): DistancePoint[] {
  const point: DistancePoint = { id: prev[0]?.id ?? newId(), lat: fix.lat, lng: fix.lng, fromLocation: true };
  return prev.length ? [point, ...prev.slice(1)] : [point];
}

/* ================================ App ================================ */

export default function App() {
  /* ---------- persisted preferences (URL params override for sharing) ---------- */
  const [theme, setTheme] = useState<ThemeId>(() => normalizeTheme(urlParam('theme') ?? readPref(KEYS.theme, 'noir')));
  const [lang, setLang] = useState<string>(() => urlParam('lang') ?? readPref(KEYS.lang, 'local'));
  const [units, setUnits] = useState<Units>(() => (readPref(KEYS.units, 'km') === 'mi' ? 'mi' : 'km'));

  /* ---------- map ---------- */
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapController | null>(null);
  const [map, setMap] = useState<MapController | null>(null);
  const [tilted, setTilted] = useState(false);

  /* ---------- location ---------- */
  const [geo, setGeo] = useState<GeoState>({ status: 'idle', fix: null });
  const watcherRef = useRef<LocationWatcher | null>(null);
  const flyOnFixRef = useRef(false); // fly to the next fix (set by "My location")
  const pointFromFixRef = useRef(false); // put the next fix into distance point A

  /* ---------- panels & tools ---------- */
  const [panel, setPanel] = useState<PanelKind>(null);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [query, setQuery] = useState<RouteQuery | null>(null);
  const [result, setResult] = useState<RouteResult>(IDLE_ROUTES);
  const [picking, setPicking] = useState(false);
  const [points, setPoints] = useState<DistancePoint[]>([]);
  const [road, setRoad] = useState<RoadState>(IDLE_ROAD);
  const [stepFocus, setStepFocus] = useState<LatLng | null>(null);
  const [directionsMinimized, setDirectionsMinimized] = useState(false);

  /* ---------- feedback ---------- */
  const [toast, setToast] = useState<Toast | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const placeSeq = useRef(0);
  const placeAbort = useRef<AbortController | null>(null);

  const showToast = (text: string, tone: ToastTone = 'info') => setToast({ id: Date.now(), text, tone });

  /* ============================ event handlers ============================ */

  /** Tap on the map: depends on the current interaction mode. */
  const addPoint = (at: LatLng) => {
    if (points.length >= MAX_POINTS) {
      showToast(`You can measure up to ${MAX_POINTS} points.`);
      return;
    }
    setPoints((prev) => [...prev, { id: newId(), lat: at.lat, lng: at.lng }]);
  };

  /** Opens the place card for a tap: a named feature if one is under the finger, else reverse geocoding. */
  const openPlace = (e: TapEvent) => {
    const seq = ++placeSeq.current;
    placeAbort.current?.abort();
    const at = { lat: e.lat, lng: e.lng };
    const named = pickNamedPlace(e.features, lang);
    setPanel('place');

    if (named) {
      setPlace({ ...at, name: named.name, subtitle: named.subtitle });
      return;
    }

    setPlace({ ...at, name: 'Dropped pin', subtitle: 'Looking up the address…', loading: true });
    const controller = new AbortController();
    placeAbort.current = controller;
    reversePlace(at, lang, controller.signal)
      .then((r) => {
        if (seq !== placeSeq.current) return; // a newer tap has superseded this lookup
        setPlace((p) =>
          p && p.lat === at.lat && p.lng === at.lng
            ? {
                ...p,
                name: r?.name ?? 'Dropped pin',
                subtitle: r ? r.subtitle || r.kind : 'No address found here',
                loading: false,
              }
            : p,
        );
      })
      .catch((err) => {
        if (isAbortError(err) || seq !== placeSeq.current) return;
        setPlace((p) => (p ? { ...p, subtitle: errorMessage(err), loading: false } : p));
      });
  };

  const handleTap = (e: TapEvent) => {
    if (panel === 'distance') {
      addPoint(e);
      return;
    }
    if (picking) {
      setPicking(false);
      setQuery((q) =>
        q ? { ...q, start: { lat: e.lat, lng: e.lng, label: 'Chosen start point' }, wantsLocation: false } : q,
      );
      return;
    }
    openPlace(e);
  };

  /** Tapping an alternative route (or its chip) makes it the selected, bright route. */
  const selectRoute = (index: number) => {
    setResult((r) => (index >= 0 && index < r.routes.length ? { ...r, selected: index } : r));
  };

  const movePoint = (id: string, at: LatLng) => {
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, lat: at.lat, lng: at.lng, fromLocation: false } : p)));
  };

  /* ---------- location ---------- */

  const handleFix = (fix: GeoFix) => {
    setGeo({ status: 'watching', fix });
    if (flyOnFixRef.current) {
      flyOnFixRef.current = false;
      mapRef.current?.flyTo(fix, 16);
    }
    if (pointFromFixRef.current) {
      pointFromFixRef.current = false;
      setPoints((prev) => withLocationAsA(prev, fix));
    }
    setQuery((q) =>
      q && q.wantsLocation && !q.start
        ? { ...q, wantsLocation: false, start: { lat: fix.lat, lng: fix.lng, label: 'My location' } }
        : q,
    );
  };

  const handleGeoError = (err: GeoErrorInfo) => {
    flyOnFixRef.current = false;
    pointFromFixRef.current = false;
    if (err.status === 'timeout') {
      // Still searching: keep the watch alive and show the hint.
      setGeo((g) => ({ ...g, message: err.message }));
      return;
    }
    setGeo((g) => ({ ...g, status: err.status, message: err.message }));
    setQuery((q) => (q && q.wantsLocation ? { ...q, wantsLocation: false } : q));
    showToast(err.message, 'error');
  };

  /** Starts (or keeps) the live position watch. */
  const startLocation = () => {
    if (!watcherRef.current) watcherRef.current = new LocationWatcher();
    setGeo((g) => ({ ...g, status: g.fix ? 'watching' : 'requesting', message: undefined }));
    watcherRef.current.start(
      (fix) => handlers.current.onFix(fix),
      (err) => handlers.current.onGeoError(err),
    );
  };

  /** "My location" button: fly to the user now, or as soon as the first fix arrives. */
  const locateMe = () => {
    if (geo.fix) mapRef.current?.flyTo(geo.fix, 16);
    else flyOnFixRef.current = true;
    startLocation();
  };

  const useLocationForStart = () => {
    const fix = geo.fix;
    if (fix) {
      setQuery((q) =>
        q ? { ...q, start: { lat: fix.lat, lng: fix.lng, label: 'My location' }, wantsLocation: false } : q,
      );
    } else {
      setQuery((q) => (q ? { ...q, wantsLocation: true } : q));
      startLocation();
    }
  };

  const useLocationForA = () => {
    const fix = geo.fix;
    if (fix) {
      setPoints((prev) => withLocationAsA(prev, fix));
    } else {
      pointFromFixRef.current = true;
      startLocation();
      showToast('Waiting for your GPS fix…');
    }
  };

  /* ---------- directions ---------- */

  const openDirections = (target: PlaceInfo) => {
    const fix = geo.fix;
    setQuery({
      start: fix ? { lat: fix.lat, lng: fix.lng, label: 'My location' } : null,
      end: { lat: target.lat, lng: target.lng, name: target.name },
      mode: 'car',
      wantsLocation: !fix,
    });
    setPicking(false);
    setPanel('directions');
    setDirectionsMinimized(false);
    if (!fix) startLocation();
  };

  const closeDirections = () => {
    setPanel(null);
    setQuery(null);
    setResult(IDLE_ROUTES);
    setPicking(false);
    setStepFocus(null);
    setDirectionsMinimized(false);
  };

  const focusStep = (step: RouteStep) => {
    setStepFocus({ lat: step.lat, lng: step.lng });
    mapRef.current?.flyTo(step, 17);
  };

  /* ---------- place card, search & distance tool ---------- */

  const closePlace = () => {
    placeAbort.current?.abort();
    setPanel(null);
    setPlace(null);
  };

  const handleSearchPick = (r: PlaceResult) => {
    mapRef.current?.flyTo(r, 15);
    setPlace({ lat: r.lat, lng: r.lng, name: r.name, subtitle: r.subtitle || r.kind });
    setPanel('place');
  };

  /** Opens the distance tool; optionally seeds it with a point (e.g. the place card). */
  const measureFrom = (at: LatLng | null) => {
    setPlace(null);
    setPanel('distance');
    setPicking(false);
    if (at) addPoint(at);
  };

  const toggleMeasure = () => {
    if (panel === 'distance') setPanel(null);
    else measureFrom(null);
  };

  const toggleTilt = () => {
    const next = !tilted;
    setTilted(next);
    mapRef.current?.setTilt(next);
  };

  // Keep the latest handlers reachable from the (once-created) map controller.
  const handlers = useRef<HandlerSet>({
    onTap: () => undefined,
    onRoute: () => undefined,
    onDrag: () => undefined,
    onFix: () => undefined,
    onGeoError: () => undefined,
  });
  handlers.current = {
    onTap: handleTap,
    onRoute: selectRoute,
    onDrag: movePoint,
    onFix: handleFix,
    onGeoError: handleGeoError,
  };

  /* ================================ effects ================================ */

  /* Create the map once. Cleanup destroys it (safe under React StrictMode). */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let controller: MapController;
    try {
      controller = new MapController(
        host,
        { theme, lang, view: initialView(host) },
        {
          onTap: (e) => handlers.current.onTap(e),
          onRouteSelect: (i) => handlers.current.onRoute(i),
          onPointDrag: (id, at) => handlers.current.onDrag(id, at),
          onReady: dismissBoot,
          onError: (message) => showToast(message, 'error'),
        },
      );
    } catch (err) {
      // WebGL can be disabled or unavailable (old GPU, locked-down browser).
      console.error('[map] could not start', err);
      dismissBoot();
      showToast('The map could not start. Enable WebGL or hardware acceleration and reload.', 'error');
      return;
    }
    mapRef.current = controller;
    setMap(controller);
    return () => {
      controller.destroy();
      mapRef.current = null;
      setMap(null);
    };
    // Created once on purpose; later theme/language changes are applied by the effects below.
  }, []);

  /* Theme and language: apply to the map and remember the choice. */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_OPTIONS.find((t) => t.id === theme)?.color ?? '#000000');
    writePref(KEYS.theme, theme);
    map?.setTheme(theme);
  }, [theme, map]);

  useEffect(() => {
    writePref(KEYS.lang, lang);
    map?.setLang(lang);
  }, [lang, map]);

  useEffect(() => {
    writePref(KEYS.units, units);
  }, [units]);

  /* Reflect the overlays in the map whenever the related state changes. */
  useEffect(() => {
    map?.setLocation(geo.fix);
  }, [map, geo.fix]);

  useEffect(() => {
    map?.setPin(place ? { lat: place.lat, lng: place.lng } : null);
  }, [map, place?.lat, place?.lng]);

  useEffect(() => {
    map?.setStepFocus(stepFocus);
  }, [map, stepFocus]);

  useEffect(() => {
    map?.setRoutes(
      result.routes.map((r) => r.coords),
      result.selected,
      query?.start ?? null,
      query?.end ?? null,
    );
  }, [map, result, query]);

  useEffect(() => {
    map?.setDistance(points, road.status === 'ok' ? road.coords : null);
  }, [map, points, road]);

  /* Fetch route alternatives whenever the query (start / end / mode) changes. */
  useEffect(() => {
    if (!query || !query.start) {
      setResult(IDLE_ROUTES);
      return;
    }
    const controller = new AbortController();
    setResult({ status: 'loading', routes: [], selected: 0 });
    fetchRoutes(query.start, query.end, query.mode, controller.signal)
      .then((routes) => {
        setResult({ status: 'ok', routes, selected: 0 });
        if (routes.length) mapRef.current?.fitTo(routes.flatMap((r) => r.coords), fitPadding());
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setResult({ status: 'error', routes: [], selected: 0, error: errorMessage(err) });
        if (err instanceof ApiError && err.kind === 'ratelimit') showToast(err.message, 'error');
      });
    return () => controller.abort();
  }, [query]);

  /* Road distances for the distance tool (debounced, so dragging does not spam the API). */
  useEffect(() => {
    if (points.length < 2) {
      setRoad(IDLE_ROAD);
      return;
    }
    const controller = new AbortController();
    setRoad((r) => ({ ...r, status: 'loading', error: undefined }));
    const timer = window.setTimeout(() => {
      fetchRoadLegs(points, controller.signal)
        .then((r) => setRoad({ status: 'ok', legs: r.legs, total: r.total, coords: r.coords }))
        .catch((err) => {
          if (isAbortError(err)) return;
          setRoad({ status: 'error', legs: [], total: 0, coords: [], error: errorMessage(err) });
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [points]);

  /* If the user already granted location, start watching silently (no prompt). */
  useEffect(() => {
    let active = true;
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (active && status.state === 'granted') startLocation();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      watcherRef.current?.stop();
    };
    // startLocation only uses refs and setters, so running this once is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Online / offline status. */
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      showToast('Back online.', 'success');
    };
    const goOffline = () => {
      setOnline(false);
      showToast("You're offline. Cached map areas still work.", 'info');
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  /* Toasts disappear by themselves. */
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.tone === 'error' ? 6000 : 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ================================ render ================================ */

  const measuring = panel === 'distance';

  return (
    <div className="app-root">
      <div ref={hostRef} className="map-host" role="region" aria-label="Interactive world map" />

      <div className="top-search">
        <SearchBox lang={lang} near={geo.fix} onSelect={handleSearchPick} />
      </div>

      <div className="top-settings">
        <SettingsBar theme={theme} lang={lang} online={online} onThemeChange={setTheme} onLangChange={setLang} />
      </div>

      <MapButtons
        geoStatus={geo.status}
        hasFix={geo.fix !== null}
        measuring={measuring}
        tilted={tilted}
        sheetOpen={panel !== null}
        onLocate={locateMe}
        onToggleMeasure={toggleMeasure}
        onToggleTilt={toggleTilt}
        onZoomIn={() => mapRef.current?.zoomBy(1)}
        onZoomOut={() => mapRef.current?.zoomBy(-1)}
      />

      {picking && (
        <div className="pick-banner ui-btn-active" role="status">
          Tap the map to choose your starting point
        </div>
      )}

      {panel === 'place' && place && (
        <Sheet title="Place" onClose={closePlace}>
          <PlacePanel place={place} onDirections={() => openDirections(place)} onMeasure={() => measureFrom(place)} />
        </Sheet>
      )}

      {panel === 'directions' && query && !directionsMinimized && (
        <Sheet
          title="Directions"
          subtitle={`To ${query.end.name}`}
          onClose={closeDirections}
          onMinimize={() => setDirectionsMinimized(true)}
          minimizeLabel="Minimize directions"
        >
          <DirectionsPanel
            query={query}
            result={result}
            units={units}
            picking={picking}
            geoStatus={geo.status}
            geoMessage={geo.message}
            fix={geo.fix}
            onMode={(mode: TravelMode) => setQuery((q) => (q ? { ...q, mode } : q))}
            onSelect={selectRoute}
            onStep={focusStep}
            onUseLocation={useLocationForStart}
            onPickStart={() => {
              setPicking(true);
              showToast('Tap the map to choose your starting point');
            }}
            onCancelPick={() => setPicking(false)}
            onRetry={() => setQuery((q) => (q ? { ...q } : q))}
          />
        </Sheet>
      )}

      {panel === 'directions' && query && directionsMinimized && (
        <MiniDirections
          query={query}
          result={result}
          fix={geo.fix}
          units={units}
          onExpand={() => setDirectionsMinimized(false)}
          onClose={closeDirections}
        />
      )}

      {panel === 'distance' && (
        <Sheet
          title="Distance"
          subtitle={`${points.length} point${points.length === 1 ? '' : 's'}`}
          onClose={() => setPanel(null)}
        >
          <DistancePanel
            points={points}
            units={units}
            road={road}
            locating={geo.status === 'requesting'}
            onUnits={setUnits}
            onUseLocation={useLocationForA}
            onClear={() => setPoints([])}
            onRemove={(id) => setPoints((prev) => prev.filter((p) => p.id !== id))}
          />
        </Sheet>
      )}

      <Attribution />
      <ToastView toast={toast} />
    </div>
  );
}
