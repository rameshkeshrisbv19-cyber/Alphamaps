/**
 * Floating map controls on the right edge: my location, distance tool,
 * 3D buildings and zoom. Touch targets are 48 px. On phones the stack rises
 * above the bottom sheet while a panel is open (CSS class .is-raised).
 */
import { Box, LoaderCircle, LocateFixed, Minus, Plus, Ruler } from 'lucide-react';
import type { GeoStatus } from '../types';

interface MapButtonsProps {
  geoStatus: GeoStatus;
  hasFix: boolean;
  measuring: boolean;
  tilted: boolean;
  sheetOpen: boolean;
  onLocate: () => void;
  onToggleMeasure: () => void;
  onToggleTilt: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function MapButtons(p: MapButtonsProps) {
  const locating = p.geoStatus === 'requesting';
  const blocked = p.geoStatus === 'denied' || p.geoStatus === 'unsupported' || p.geoStatus === 'insecure';

  return (
    <div className={`fab-stack ${p.sheetOpen ? 'is-raised' : ''}`}>
      <button
        type="button"
        onClick={p.onLocate}
        aria-label="Show my location"
        title={blocked ? 'Location is blocked in browser settings' : 'My location'}
        className={`fab ${p.hasFix ? 'ui-primary' : 'ui-btn'} ${blocked ? 'fab-blocked' : ''}`}
      >
        {locating ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
      </button>

      <button
        type="button"
        onClick={p.onToggleMeasure}
        aria-pressed={p.measuring}
        aria-label="Distance tool"
        title="Distance tool"
        className={`fab ${p.measuring ? 'ui-btn-active' : 'ui-btn'}`}
      >
        <Ruler className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={p.onToggleTilt}
        aria-pressed={p.tilted}
        aria-label="Toggle 3D buildings"
        title="3D buildings"
        className={`fab ${p.tilted ? 'ui-btn-active' : 'ui-btn'}`}
      >
        <Box className="h-5 w-5" />
      </button>

      <div className="fab-zoom ui-surface">
        <button type="button" onClick={p.onZoomIn} aria-label="Zoom in" className="fab-zoom-btn">
          <Plus className="h-5 w-5" />
        </button>
        <span className="fab-zoom-sep" aria-hidden="true" />
        <button type="button" onClick={p.onZoomOut} aria-label="Zoom out" className="fab-zoom-btn">
          <Minus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
