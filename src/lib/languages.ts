/**
 * Label languages. Each option maps to an OpenMapTiles `name:xx` field. When a
 * place has no name in the chosen language we fall back to its local `name`.
 */

export interface LanguageOption {
  code: string;
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'local', label: 'Local (native)' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी · Hindi' },
  { code: 'ur', label: 'اردو · Urdu' },
  { code: 'ar', label: 'العربية · Arabic' },
  { code: 'bn', label: 'বাংলা · Bengali' },
  { code: 'zh', label: '中文 · Chinese' },
  { code: 'ja', label: '日本語 · Japanese' },
  { code: 'ru', label: 'Русский · Russian' },
  { code: 'es', label: 'Español · Spanish' },
  { code: 'fr', label: 'Français · French' },
  { code: 'de', label: 'Deutsch · German' },
  { code: 'pt', label: 'Português · Portuguese' },
];

/** MapLibre expression for `text-field`: name:xx → name → name:latin → name:en. */
export function labelField(lang: string): unknown {
  if (!lang || lang === 'local') {
    return ['coalesce', ['get', 'name'], ['get', 'name:latin'], ['get', 'name:en']];
  }
  return ['coalesce', ['get', `name:${lang}`], ['get', 'name'], ['get', 'name:latin'], ['get', 'name:en']];
}

/** The same fallback rule for plain objects (tapped features, search results). */
export function localizedName(props: Record<string, unknown>, lang: string): string | undefined {
  const keys =
    !lang || lang === 'local'
      ? ['name', 'name:latin', 'name:en']
      : [`name:${lang}`, 'name', 'name:latin', 'name:en'];
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

/** A public route number / shield (OpenMapTiles `ref`). */
export function routeRef(props: Record<string, unknown>): string | undefined {
  const value = props.ref ?? props['ref:en'];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
