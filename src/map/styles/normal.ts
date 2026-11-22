/**
 * Light theme — a standard light street map: cream land, blue water, white roads
 * with grey casings, coloured parks, dark labels with light halos.
 */
import type { StyleSpecification } from 'maplibre-gl';
import { buildStyle, type Palette } from './builder';

export const NORMAL_PALETTE: Palette = {
  id: 'normal',
  name: 'Light',
  background: '#f2efe9',
  landcover: '#e4ebd7',
  landuse: '#e9e5dc',
  park: '#cfe6b8',
  water: '#a6cfe6',
  waterway: '#a6cfe6',
  building: '#dcd4c8',
  buildingOutline: '#bfb3a3',
  extrusion: '#e2d9cb',
  extrusionOpacity: 0.92,
  roadMajor: '#ffffff',
  roadMinor: '#ffffff',
  roadPath: '#e7e2d8',
  roadCasing: '#cfc8bb',
  rail: '#9f998f',
  boundaryCountry: '#9b9489',
  boundaryState: '#bdb6aa',
  label: '#2b2b2b',
  labelMinor: '#5a5a5a',
  labelHalo: '#f7f5f0',
  roadLabel: '#4f4f4f',
  routeLabel: '#1a5fb4',
  waterLabel: '#3d6f94',
  poi: '#c2655a',
  sky: {
    'sky-color': '#cfe3f3',
    'horizon-color': '#eef5fb',
    'fog-color': '#eef5fb',
    'fog-ground-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'sky-horizon-blend': 0.6,
    'atmosphere-blend': 0.6,
  },
};

/** Full MapLibre style JSON for the Light theme. */
export function normalStyle(lang: string): StyleSpecification {
  return buildStyle(NORMAL_PALETTE, lang);
}
