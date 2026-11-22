/**
 * Picks the most useful name from the vector features under a tap.
 * Points of interest win over roads, which win over large areas.
 * For roads the exact OSM name is preferred, with the public route number
 * (the number on the shield) shown alongside it.
 */
import type { TapFeature } from '../types';
import { localizedName, routeRef } from './languages';

/** Source layers in priority order (OpenMapTiles layer names). */
const PRIORITY = [
  'poi',
  'place',
  'mountain_peak',
  'park',
  'water_name',
  'aerodrome_label',
  'transportation_name',
  'waterway',
];

export interface NamedPlace {
  name: string;
  subtitle: string;
}

/** "motorway_link" → "Motorway link" */
const humanize = (value: unknown): string =>
  typeof value === 'string' && value
    ? value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
    : '';

const join = (...parts: string[]) => parts.filter(Boolean).join(' ');

export function pickNamedPlace(features: TapFeature[], lang: string): NamedPlace | null {
  for (const layer of PRIORITY) {
    for (const f of features) {
      if (f.sourceLayer !== layer) continue;
      const props = f.properties;
      const ref = routeRef(props);
      const name = localizedName(props, lang) ?? (layer === 'transportation_name' ? ref : undefined);
      if (!name) continue;

      if (layer === 'transportation_name') {
        const kind = humanize(props.class);
        return {
          name,
          subtitle: join('Road', kind, ref && ref !== name ? `· ${ref}` : ''),
        };
      }

      const kind = humanize(props.class);
      return { name, subtitle: join(kind, ref && ref !== name ? `· ${ref}` : '') };
    }
  }
  return null;
}
