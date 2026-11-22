/**
 * Noir theme — the default. A dark grey land base (#0e0e0e) with near-black water
 * (#05070a) so the whole country remains visible even between mapped landcover
 * polygons. Light-grey roads (#c4c4c4 major / #9a9a9a minor), clearly visible
 * grey buildings (#8a8a8a) with a light outline, and 3D extrusions that get
 * lighter with height. Country outlines are near-white (#e0e0e0) with a dark
 * casing; state lines are dashed grey. Silver labels and no coloured land use
 * or POI icons.
 *
 * "Noir" is deliberately monochrome: black, silver and a single warm route
 * highlight. Buildings appear from zoom 13 and extrude in 3D from zoom 14.5.
 */
import type { StyleSpecification } from 'maplibre-gl';
import { buildStyle, type Palette } from './builder';

export const NOIR_PALETTE: Palette = {
  id: 'noir',
  name: 'Noir',
  background: '#0e0e0e',
  landcover: '#101010',
  landuse: '#111111',
  park: '#151515',
  water: '#05070a',
  waterway: '#05070a',
  building: '#8a8a8a',
  buildingOutline: '#a0a0a0',
  extrusion: '#7a7a7a',
  extrusionOpacity: 0.98,
  roadMajor: '#c4c4c4',
  roadMinor: '#9a9a9a',
  roadPath: '#5f5f5f',
  roadCasing: null,
  rail: '#6a6a6a',
  boundaryCountry: '#e0e0e0',
  boundaryState: '#9a9a9a',
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
