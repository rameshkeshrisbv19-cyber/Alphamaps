/**
 * Theme registry. Each theme is a separate style-JSON builder.
 *   Noir  — monochrome black/silver (default)
 *   Light — a bright street map
 *   Dark  — a low-glare charcoal map
 * Add a new theme by creating a Palette file and registering it here.
 */
import type { StyleSpecification } from 'maplibre-gl';
import type { ThemeId } from '../../types';
import { noirStyle } from './noir';
import { normalStyle } from './normal';
import { darkStyle } from './dark';

export const THEME_OPTIONS: { id: ThemeId; label: string; color: string }[] = [
  { id: 'noir', label: 'Noir', color: '#000000' },
  { id: 'normal', label: 'Light', color: '#f2efe9' },
  { id: 'dark', label: 'Dark', color: '#1b1f24' },
];

/** Returns the MapLibre style JSON for a theme and label language. */
export function getStyle(theme: ThemeId, lang: string): StyleSpecification {
  switch (theme) {
    case 'normal':
      return normalStyle(lang);
    case 'dark':
      return darkStyle(lang);
    default:
      return noirStyle(lang);
  }
}
