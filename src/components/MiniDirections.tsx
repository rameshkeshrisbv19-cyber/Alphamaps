/**
 * Minimised directions window. Stays on screen while the user drives/walks:
 * shows the next manoeuvre, the distance to it, the travel mode and the live
 * GPS speed. The full directions sheet can be restored at any time.
 */
import { Gauge, LoaderCircle, Maximize2, TriangleAlert, X } from 'lucide-react';
import { formatDistance, formatSpeed, haversine } from '../lib/geo';
import type { GeoFix, RouteQuery, RouteResult, RouteStep, Units } from '../types';
import { MODES, STEP_ICONS } from './DirectionsPanel';

interface MiniDirectionsProps {
  query: RouteQuery;
  result: RouteResult;
  fix: GeoFix | null;
  units: Units;
  onExpand: () => void;
  onClose: () => void;
}

const FALLBACK_TEXT: Record<string, string> = {
  depart: 'Start your journey',
  arrive: 'You have arrived',
  straight: 'Continue straight',
};

export function MiniDirections({ query, result, fix, units, onExpand, onClose }: MiniDirectionsProps) {
  const selected = result.routes[result.selected];
  const steps = selected?.steps ?? [];
  const mode = MODES.find((m) => m.id === query.mode) ?? MODES[0];
  const ModeIcon = mode.Icon;

  const origin = fix ?? query.start ?? query.end;
  let next: RouteStep | undefined;
  let nextDistance = 0;

  if (steps.length === 1) {
    next = steps[0];
    nextDistance = fix ? haversine(origin, next) : next.distance;
  } else if (steps.length > 1) {
    if (fix) {
      // The next manoeuvre is the closest upcoming step (ignore the start).
      let best = Infinity;
      for (let i = 1; i < steps.length; i++) {
        const d = haversine(origin, steps[i]);
        if (d > 20 && d < best) {
          best = d;
          next = steps[i];
        }
      }
      if (!next) next = steps[steps.length - 1];
      nextDistance = best === Infinity ? haversine(origin, next) : best;
    } else {
      // No fix yet: show the first turn and the distance to it (the departure
      // step carries the distance from the start to the first manoeuvre).
      next = steps[1] ?? steps[0];
      nextDistance = steps[1] ? steps[0].distance : next.distance;
    }
  }

  const arrived = !!next && (next.icon === 'arrive' || (fix !== null && nextDistance < 20));
  const instruction = arrived
    ? 'You have arrived'
    : result.status === 'loading'
      ? 'Finding your route…'
      : result.status === 'error'
        ? 'Route unavailable'
        : next
          ? next.text || FALLBACK_TEXT[next.icon] || 'Continue'
          : 'Follow the highlighted route';

  const detail = arrived
    ? 'You have reached your destination'
    : result.status === 'error'
      ? result.error ?? 'Please try again.'
      : next?.street
        ? next.street
        : selected
          ? `${mode.label} route · ${selected.turns} turn${selected.turns === 1 ? '' : 's'}`
          : 'Calculating directions…';

  const distanceText = arrived
    ? 'Arrived'
    : result.status === 'loading'
      ? 'Calculating…'
      : fix
        ? nextDistance < 25
          ? 'Now'
          : `in ${formatDistance(nextDistance, units)}`
        : next
          ? formatDistance(next.distance, units)
          : '—';

  const speed = formatSpeed(fix?.speed, units);
  const TurnIcon = next ? STEP_ICONS[next.icon] : MODES[0].Icon;

  return (
    <section className="mini-directions ui-surface" aria-label="Directions (minimised)">
      <header className="mini-directions-head">
        <span className="mini-mode">
          <ModeIcon className="h-4 w-4" aria-hidden="true" />
          {mode.label}
        </span>
        <span className="mini-speed" title="Speed from GPS">
          <Gauge className="h-4 w-4" aria-hidden="true" />
          {speed}
        </span>
        <div className="mini-actions">
          <button type="button" onClick={onExpand} aria-label="Expand directions" title="Expand directions">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} aria-label="Close directions" title="Close directions">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mini-directions-main">
        <span className="mini-turn">
          {result.status === 'loading' ? (
            <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : result.status === 'error' ? (
            <TriangleAlert className="h-6 w-6" aria-hidden="true" />
          ) : (
            <TurnIcon className="h-6 w-6" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mini-instruction">{instruction}</p>
          <p className="mini-detail">{detail}</p>
        </div>
      </div>

      <footer className="mini-directions-foot">
        <span className="mini-distance">{distanceText}</span>
        <span className="mini-gps">
          <span className={`mini-gps-dot ${fix ? 'is-live' : ''}`} aria-hidden="true" />
          {fix ? 'Live GPS' : 'Waiting for GPS'}
        </span>
      </footer>
    </section>
  );
}