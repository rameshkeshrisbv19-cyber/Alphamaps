/**
 * Noir theme — the default. Pure black land, near-black water, light-grey roads
 * (#c4c4c4 major / #9a9a9a minor), clearly visible grey buildings (#6f6f6f)
 * with a light outline and dark-grey 3D extrusions. Country outlines are
 * mid-grey and state lines are dashed grey. Silver labels and no coloured
 * land use or POI icons.
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
  landcover: '#0a0a0a',
  landuse: '#0b0b0b',
  park: '#0e0e0e',
  water: '#05070a',
  waterway: '#05070a',
  building: '#6f6f6f',
  buildingOutline: '#a3a3a3',
  extrusion: '#666666',
  extrusionOpacity: 0.97,
  roadMajor: '#c4c4c4',
  roadMinor: '#9a9a9a',
  roadPath: '#5f5f5f',
  roadCasing: null,
  rail: '#6a6a6a',
  boundaryCountry: '#8f8f8f',
  boundaryState: '#5a5a5a',
  label: '#e0e0e0',
  labelMinor: '#b0b0b0',
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
