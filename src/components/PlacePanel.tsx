/**
 * Place card shown when the map is tapped or a search result is chosen:
 * name, subtitle, coordinates, and the Directions / Measure actions.
 */
import { LoaderCircle, Navigation, Ruler } from 'lucide-react';
import type { PlaceInfo } from '../types';

interface PlacePanelProps {
  place: PlaceInfo;
  onDirections: () => void;
  onMeasure: () => void;
}

export function PlacePanel({ place, onDirections, onMeasure }: PlacePanelProps) {
  return (
    <div className="space-y-4">
      <div className="ui-card p-4">
        <p className="text-xl font-semibold leading-snug">{place.name}</p>
        {place.subtitle && <p className="mt-1 text-sm ui-muted">{place.subtitle}</p>}
        {place.loading && (
          <p className="mt-2 flex items-center gap-2 text-sm ui-muted">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            Looking up the address…
          </p>
        )}
        <p className="mt-3 font-mono text-xs tabular-nums ui-muted">
          {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onDirections}
          className="ui-primary flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold"
        >
          <Navigation className="h-5 w-5" aria-hidden="true" />
          Directions
        </button>
        <button
          type="button"
          onClick={onMeasure}
          className="ui-btn flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold"
        >
          <Ruler className="h-5 w-5" aria-hidden="true" />
          Measure
        </button>
      </div>
    </div>
  );
}
