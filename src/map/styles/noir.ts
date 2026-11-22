/**
 * Noir theme — the default. Pure black land, near-black water, light-grey roads (#b5b5b5 major /
 * #8a8a8a minor), dark-grey buildings (#2a2a2a) with a faint light outline,
 * silver labels and no coloured land use or POI icons.
 *
 * "Noir" is deliberately monochrome: black, silver and a single warm route
 * highlight. Buildings extrude in 3D from zoom 15.
 */
import type { StyleSpecification } from 'maplibre-gl';
import { buildStyle, type Palette } from './builder';

export const NOIR_PALETTE: Palette = {
  id: 'noir',
  name: 'Noir',
  background: '#000000',
  landcover: '#050505',
  landuse: '#060606',
  park: '#0a0a0a',
  water: '#05070a',
  waterway: '#05070a',
  building: '#2a2a2a',
  buildingOutline: '#4a4a4a',
  extrusion: '#2a2a2a',
  extrusionOpacity: 1,
  roadMajor: '#b5b5b5',
  roadMinor: '#8a8a8a',
  roadPath: '#4a4a4a',
  roadCasing: null,
  rail: '#5a5a5a',
  boundaryCountry: '#3c3c3c',
  boundaryState: '#262626',
  label: '#d6d6d6',
  labelMinor: '#a6a6a6',
  labelHalo: '#000000',
  roadLabel: '#c4c4c4',
  routeLabel: '#f4c95d',
  waterLabel: '#8e98a5',
  poi: null,
  // Black space around the globe: no blue atmosphere glow.
  sky: {
    'sky-color': '#000000',
    'horizon-color': '#000000',
    'fog-color': '#000000',
    'fog-ground-blend': 0.5,
    'horizon-fog-blend': 0.5,
    'sky-horizon-blend': 0.5,
    'atmosphere-blend': 0,
  },
};

/** Full MapLibre style JSON for the Noir theme. */
export function noirStyle(lang: string): StyleSpecification {
  return buildStyle(NOIR_PALETTE, lang);
}
