/**
 * Dark theme — a muted, low-glare street map: charcoal land, deep navy water,
 * slate roads, light labels with dark halos and warm POI dots.
 */
import type { StyleSpecification } from 'maplibre-gl';
import { buildStyle, type Palette } from './builder';

export const DARK_PALETTE: Palette = {
  id: 'dark',
  name: 'Dark',
  background: '#1b1f24',
  landcover: '#1e2328',
  landuse: '#21272d',
  park: '#1f2c24',
  water: '#0e1a2b',
  waterway: '#0e1a2b',
  building: '#262b31',
  buildingOutline: '#3a4149',
  extrusion: '#2a3037',
  extrusionOpacity: 0.95,
  roadMajor: '#6b7682',
  roadMinor: '#4a525b',
  roadPath: '#363d45',
  roadCasing: '#15181c',
  rail: '#4a525b',
  boundaryCountry: '#4a525b',
  boundaryState: '#353c44',
  label: '#dde3ea',
  labelMinor: '#9aa5b1',
  labelHalo: '#15181c',
  roadLabel: '#aab4be',
  routeLabel: '#ffd479',
  waterLabel: '#6f8fb2',
  poi: '#e0a458',
  sky: {
    'sky-color': '#0b0e12',
    'horizon-color': '#1b1f24',
    'fog-color': '#0b0e12',
    'fog-ground-blend': 0.5,
    'horizon-fog-blend': 0.5,
    'sky-horizon-blend': 0.5,
    'atmosphere-blend': 0.3,
  },
};

/** Full MapLibre style JSON for the Dark theme. */
export function darkStyle(lang: string): StyleSpecification {
  return buildStyle(DARK_PALETTE, lang);
}
