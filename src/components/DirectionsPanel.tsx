/**
 * Directions panel: start point, travel mode, route alternatives (tap to select),
 * turn-by-turn steps (tap to zoom to the manoeuvre) and the estimates disclaimer.
 */
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Bike,
  Car,
  CornerUpLeft,
  CornerUpRight,
  Crosshair,
  Flag,
  Footprints,
  Gauge,
  LoaderCircle,
  LocateFixed,
  LogOut,
  Merge,
  Navigation,
  Repeat,
  RotateCw,
  Split,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { formatDistance, formatDuration, formatSpeed } from '../lib/geo';
import type { GeoFix, GeoStatus, RouteQuery, RouteResult, RouteStep, StepIcon, TravelMode, Units } from '../types';

export const MODES: { id: TravelMode; label: string; Icon: LucideIcon }[] = [
  { id: 'car', label: 'Car', Icon: Car },
  { id: 'bike', label: 'Bike', Icon: Bike },
  { id: 'walk', label: 'Walk', Icon: Footprints },
];

export const STEP_ICONS: Record<StepIcon, LucideIcon> = {
  straight: ArrowUp,
  'slight-right': ArrowUpRight,
  right: CornerUpRight,
  'sharp-right': ArrowDownRight,
  'slight-left': ArrowUpLeft,
  left: CornerUpLeft,
  'sharp-left': ArrowDownLeft,
  uturn: Undo2,
  roundabout: RotateCw,
  merge: Merge,
  fork: Split,
  ramp: LogOut,
  depart: Navigation,
  arrive: Flag,
};

interface DirectionsPanelProps {
  query: RouteQuery;
  result: RouteResult;
  units: Units;
  picking: boolean;
  geoStatus: GeoStatus;
  geoMessage?: string;
  fix: GeoFix | null;
  onMode: (mode: TravelMode) => void;
  onSelect: (index: number) => void;
  onStep: (step: RouteStep) => void;
  onUseLocation: () => void;
  onPickStart: () => void;
  onCancelPick: () => void;
  onRetry: () => void;
}

export function DirectionsPanel(props: DirectionsPanelProps) {
  const { query, result, units, picking } = props;
  const selected = result.routes[result.selected];
  const modeLabel = MODES.find((m) => m.id === query.mode)?.label.toLowerCase() ?? 'travel';

  return (
    <div className="space-y-4">
      {/* Start point: my location or a point picked on the map */}
      <section className="ui-card p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] ui-muted">From</p>
        {query.start ? (
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate font-medium">{query.start.label}</p>
            <button
              type="button"
              onClick={props.onPickStart}
              className="shrink-0 text-sm font-semibold underline underline-offset-4"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="mt-2 space-y-2.5">
            <p className="text-sm ui-muted">
              {props.geoStatus === 'requesting' ? 'Waiting for your GPS fix…' : 'Choose where you are starting from.'}
            </p>
            {props.geoMessage && <p className="text-xs text-amber-500">{props.geoMessage}</p>}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={props.onUseLocation}
                className="ui-btn flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
              >
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                My location
              </button>
              <button
                type="button"
                onClick={props.onPickStart}
                className="ui-btn flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
              >
                <Crosshair className="h-4 w-4" aria-hidden="true" />
                Pick on map
              </button>
            </div>
          </div>
        )}
        {picking && (
          <div className="ui-btn-active mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold">
            <span>Tap the map to set the start</span>
            <button type="button" onClick={props.onCancelPick} className="underline underline-offset-4">
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Travel mode */}
      <div className="seg" role="group" aria-label="Travel mode">
        {MODES.map(({ id, label, Icon }) => (
          <button key={id} type="button" aria-pressed={query.mode === id} onClick={() => props.onMode(id)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Live GPS speed */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-2" style={{ borderColor: 'var(--ui-border)' }}>
        <span className="flex items-center gap-2 text-sm ui-muted">
          <Gauge className="h-4 w-4" aria-hidden="true" />
          Current speed
        </span>
        <span className="text-sm font-bold tabular-nums">{formatSpeed(props.fix?.speed, units)}</span>
      </div>

      {/* Route alternatives */}
      {result.status === 'loading' && (
        <div className="ui-card flex items-center gap-3 p-4 text-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Finding routes…
        </div>
      )}
      {result.status === 'error' && (
        <ErrorBox message={result.error ?? 'Could not find a route.'} onRetry={props.onRetry} />
      )}
      {result.status === 'ok' && result.routes.length === 0 && (
        <ErrorBox message="No route found between these points." onRetry={props.onRetry} />
      )}
      {result.status === 'ok' && result.routes.length > 0 && (
        <section aria-label="Route options" className="space-y-2.5">
          {result.routes.map((r, i) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={i === result.selected}
              onClick={() => props.onSelect(i)}
              className="route-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{r.note}</p>
                  <p className="mt-0.5 text-xs ui-muted">
                    via {r.provider} · {r.turns} turn{r.turns === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold tabular-nums">{formatDuration(r.duration)}</p>
                  <p className="text-xs ui-muted tabular-nums">{formatDistance(r.distance, units)}</p>
                </div>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* Turn-by-turn steps for the selected route */}
      {result.status === 'ok' && selected && selected.steps.length > 0 && (
        <section aria-label="Turn-by-turn steps">
          <h3 className="mb-1 px-1 text-[11px] font-bold uppercase tracking-[0.16em] ui-muted">Turn by turn</h3>
          <ol className="space-y-0.5">
            {selected.steps.map((s) => {
              const Icon = STEP_ICONS[s.icon];
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => props.onStep(s)} className="step-row">
                    <span className="step-icon">
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-snug">{s.text}</span>
                      {s.street && <span className="block truncate text-xs ui-muted">{s.street}</span>}
                    </span>
                    {s.distance > 0 && (
                      <span className="shrink-0 pt-0.5 text-xs font-medium tabular-nums ui-muted">
                        {formatDistance(s.distance, units)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <p className="text-[11px] leading-relaxed ui-muted">
        Live traffic is not included. Times are estimates for {modeLabel} travel at typical speeds. Route data ©
        OpenStreetMap contributors.
      </p>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="leading-snug">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
        >
          <Repeat className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </div>
  );
}
