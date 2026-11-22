/**
 * Search box. Debounced Photon lookups (450 ms), every keystroke aborts the
 * previous request, and results appear in a dropdown. Choosing one hands the
 * place back to the app.
 */
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPin, Search, X } from 'lucide-react';
import { searchPlaces, type PlaceResult } from '../lib/geocode';
import { errorMessage, isAbortError } from '../lib/http';
import type { LatLng } from '../types';

interface SearchBoxProps {
  lang: string;
  near: LatLng | null;
  onSelect: (place: PlaceResult) => void;
}

const DEBOUNCE_MS = 450;

export function SearchBox({ lang, near, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce keystrokes. A new query (or unmount) aborts the request in flight.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchPlaces(term, { lang, near, signal: controller.signal });
        setResults(found);
        setStatus(found.length ? 'idle' : 'empty');
      } catch (err) {
        if (isAbortError(err)) return;
        setStatus('error');
        setMessage(errorMessage(err));
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `near` only biases ranking, so it is deliberately not a dependency.
  }, [query, lang]);

  const choose = (place: PlaceResult) => {
    setQuery('');
    setResults([]);
    setStatus('idle');
    setFocused(false);
    inputRef.current?.blur();
    onSelect(place);
  };

  const showList = focused && query.trim().length >= 2;

  return (
    <div className="relative w-full">
      <div className="ui-surface flex h-12 items-center gap-2.5 rounded-2xl px-3.5 shadow-lg shadow-black/30">
        <Search className="h-5 w-5 shrink-0 ui-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          // Small delay so a tap on a result still registers before the list hides.
          onBlur={() => window.setTimeout(() => setFocused(false), 180)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) choose(results[0]);
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search places or addresses"
          aria-label="Search places"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          className="ui-input min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
        {status === 'loading' && (
          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin ui-muted" aria-label="Searching" />
        )}
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="ui-btn grid h-8 w-8 shrink-0 place-items-center rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showList && (
        <ul className="ui-surface sheet-enter absolute left-0 right-0 top-[3.75rem] z-50 max-h-72 overflow-y-auto rounded-2xl p-1.5 shadow-2xl">
          {status === 'loading' && results.length === 0 && <li className="px-3 py-3 text-sm ui-muted">Searching…</li>}
          {status === 'error' && <li className="px-3 py-3 text-sm text-red-400">{message}</li>}
          {status === 'empty' && (
            <li className="px-3 py-3 text-sm ui-muted">No places found for “{query.trim()}”.</li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => choose(r)}
                className="flex min-h-[52px] w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-black/5 active:scale-[0.99] dark:hover:bg-white/5"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 ui-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{r.name}</span>
                  {r.subtitle && <span className="block truncate text-xs ui-muted">{r.subtitle}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
