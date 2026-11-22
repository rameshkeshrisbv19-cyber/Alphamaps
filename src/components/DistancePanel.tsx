/**
 * Distance tool: tap the map to add lettered points (drag pins to move them).
 * Shows straight-line (Haversine) and driving distances per leg and in total,
 * with km / mi units.
 */
import { LocateFixed, Trash2 } from 'lucide-react';
import { formatDistance, haversine, letterFor } from '../lib/geo';
import type { DistancePoint, RoadState, Units } from '../types';

interface DistancePanelProps {
  points: DistancePoint[];
  units: Units;
  road: RoadState;
  locating: boolean;
  onUnits: (units: Units) => void;
  onUseLocation: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
}

export function DistancePanel({
  points,
  units,
  road,
  locating,
  onUnits,
  onUseLocation,
  onClear,
  onRemove,
}: DistancePanelProps) {
  // Straight-line legs between consecutive points (Haversine, metres).
  const straightLegs = points.slice(1).map((p, i) => haversine(points[i], p));
  const straightTotal = straightLegs.reduce((sum, d) => sum + d, 0);

  const roadTotalText =
    road.status === 'ok'
      ? formatDistance(road.total, units)
      : road.status === 'loading'
        ? 'Calculating…'
        : road.status === 'error'
          ? 'Unavailable'
          : '—';

  const roadLegText = (i: number) => {
    if (road.status === 'ok' && road.legs[i] !== undefined) return formatDistance(road.legs[i], units);
    if (road.status === 'loading') return '…';
    return 'n/a';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm ui-muted">Tap the map to add points. Drag a pin to move it.</p>
        <div className="seg w-[108px] shrink-0" role="group" aria-label="Units">
          <button type="button" aria-pressed={units === 'km'} onClick={() => onUnits('km')}>
            km
          </button>
          <button type="button" aria-pressed={units === 'mi'} onClick={() => onUnits('mi')}>
            mi
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onUseLocation}
          className="ui-primary flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          {locating ? 'Locating…' : 'My location → A'}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={points.length === 0}
          className="ui-btn flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear
        </button>
      </div>

      <div className="ui-card grid grid-cols-2 gap-3 p-3.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] ui-muted">Straight line</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums">
            {points.length > 1 ? formatDistance(straightTotal, units) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] ui-muted">By road</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums">{points.length > 1 ? roadTotalText : '—'}</p>
          {road.status === 'error' && road.error && <p className="mt-1 text-xs text-red-400">{road.error}</p>}
        </div>
      </div>

      {points.length === 0 ? (
        <p className="ui-card p-4 text-sm ui-muted">No points yet. Tap the map to place point A.</p>
      ) : (
        <ol className="space-y-2">
          {points.map((p, i) => (
            <li key={p.id} className="ui-card flex items-start gap-3 p-3">
              <span className="pin-badge">{letterFor(i)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.fromLocation ? 'My location' : `Point ${letterFor(i)}`}</p>
                <p className="font-mono text-[11px] tabular-nums ui-muted">
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </p>
                {i > 0 && (
                  <p className="mt-1 text-xs ui-muted">
                    {letterFor(i - 1)} → {letterFor(i)} · straight{' '}
                    <b className="text-current">{formatDistance(straightLegs[i - 1], units)}</b> · road{' '}
                    <b className="text-current">{roadLegText(i - 1)}</b>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                aria-label={`Remove point ${letterFor(i)}`}
                className="ui-btn grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="text-[11px] leading-relaxed ui-muted">
        Straight line = great-circle (Haversine) distance. Road = driving route through the points in order, via OSRM.
      </p>
    </div>
  );
}
