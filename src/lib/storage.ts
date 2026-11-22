/** Tiny localStorage wrapper that never throws (private mode / blocked storage). */

export const KEYS = {
  theme: 'alpha-map.theme',
  lang: 'alpha-map.lang',
  units: 'alpha-map.units',
} as const;

export function readPref(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the preference simply isn't remembered */
  }
}
