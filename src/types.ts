/**
 * Shared domain types used by the map, routing, geocoding and UI layers.
 * Kept free of MapLibre/React imports so every layer can depend on it.
 */

export type ThemeId = 'noir' | 'normal' | 'dark';
export type Units = 'km' | 'mi';
export type TravelMode = 'car' | 'bike' | 'walk';
export type PanelKind = 'place' | 'directions' | 'distance' | null;
export type ToastTone = 'info' | 'error' | 'success';

export interface LatLng {
  lat: number;
  lng: number;
}

/** A feature found under a tap, as plain data (keeps MapLibre types out of the UI). */
export interface TapFeature {
  sourceLayer?: string;
  properties: Record<string, unknown>;
}

export interface GeoFix extends LatLng {
  /** Accuracy radius in metres (drawn as the translucent halo). */
  accuracy: number;
  heading: number | null;
}

export type GeoStatus =
  | 'idle'
  | 'requesting'
  | 'watching'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported'
  | 'insecure';

export interface GeoState {
  status: GeoStatus;
  fix: GeoFix | null;
  message?: string;
}

/** The place card / pin currently shown on the map. */
export interface PlaceInfo extends LatLng {
  name: string;
  subtitle?: string;
  loading?: boolean;
}

export type StepIcon =
  | 'straight'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'slight-left'
  | 'left'
  | 'sharp-left'
  | 'uturn'
  | 'roundabout'
  | 'merge'
  | 'fork'
  | 'ramp'
  | 'depart'
  | 'arrive';

export interface RouteStep {
  id: string;
  text: string;
  street: string;
  distance: number; // metres
  duration: number; // seconds
  icon: StepIcon;
  lat: number;
  lng: number;
}

export interface RouteOption {
  id: string;
  provider: 'OSRM' | 'OpenRouteService';
  distance: number; // metres
  duration: number; // seconds (estimate — no live traffic)
  turns: number;
  coords: [number, number][]; // GeoJSON order: [lng, lat]
  steps: RouteStep[];
  tags: string[]; // e.g. 'avoids-highways'
  note: string; // "Shortest", "Fewer turns", "Avoids highways" …
}

/** What the user asked for: where from, where to, and how. */
export interface RouteQuery {
  start: (LatLng & { label: string }) | null;
  end: LatLng & { name: string };
  mode: TravelMode;
  /** True while we wait for a GPS fix to fill in the start point. */
  wantsLocation: boolean;
}

export interface RouteResult {
  status: 'idle' | 'loading' | 'ok' | 'error';
  routes: RouteOption[];
  selected: number;
  error?: string;
}

/** A point in the distance tool. Points are labelled A, B, C… by order. */
export interface DistancePoint extends LatLng {
  id: string;
  fromLocation?: boolean;
}

/** Road (driving) distances between consecutive distance-tool points. */
export interface RoadState {
  status: 'idle' | 'loading' | 'ok' | 'error';
  legs: number[]; // metres between consecutive points
  total: number; // metres
  coords: [number, number][];
  error?: string;
}

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}
