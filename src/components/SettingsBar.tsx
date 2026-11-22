/**
 * Settings chips: the map-theme button (cycles Noir → Light → Dark), the
 * label-language dropdown, and an "Offline" badge when the network is down.
 */
import { ChevronDown, Eclipse, Moon, Sun, WifiOff, type LucideIcon } from 'lucide-react';
import { LANGUAGES } from '../lib/languages';
import type { ThemeId } from '../types';

const THEME_META: Record<ThemeId, { label: string; Icon: LucideIcon; next: ThemeId }> = {
  noir: { label: 'Noir', Icon: Eclipse, next: 'normal' },
  normal: { label: 'Light', Icon: Sun, next: 'dark' },
  dark: { label: 'Dark', Icon: Moon, next: 'noir' },
};

interface SettingsBarProps {
  theme: ThemeId;
  lang: string;
  online: boolean;
  onThemeChange: (theme: ThemeId) => void;
  onLangChange: (lang: string) => void;
}

export function SettingsBar({ theme, lang, online, onThemeChange, onLangChange }: SettingsBarProps) {
  const meta = THEME_META[theme];
  const Icon = meta.Icon;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onThemeChange(meta.next)}
        aria-label={`Map theme: ${meta.label}. Tap to switch theme`}
        title="Switch map theme"
        className="ui-btn flex h-10 items-center gap-2 rounded-2xl px-3.5 text-sm font-semibold shadow-lg shadow-black/20"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {meta.label}
      </button>

      <label className="ui-btn relative flex h-10 items-center rounded-2xl pl-3.5 pr-9 text-sm font-medium shadow-lg shadow-black/20">
        <span className="sr-only">Label language</span>
        <select
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
          className="max-w-[9.5rem] appearance-none truncate bg-transparent outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 ui-muted" aria-hidden="true" />
      </label>

      {!online && (
        <span
          role="status"
          className="flex h-10 items-center gap-1.5 rounded-2xl bg-amber-400 px-3 text-xs font-bold text-black"
        >
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          Offline
        </span>
      )}
    </div>
  );
}
