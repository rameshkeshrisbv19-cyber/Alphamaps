/**
 * Live location: a thin wrapper around navigator.geolocation.watchPosition.
 * It keeps a single watch alive and turns browser errors into friendly messages.
 */
import type { GeoFix, GeoStatus } from '../types';

export interface GeoErrorInfo {
  status: GeoStatus;
  message: string;
}

export class LocationWatcher {
  private watchId: number | null = null;

  get active(): boolean {
    return this.watchId !== null;
  }

  start(onFix: (fix: GeoFix) => void, onError: (err: GeoErrorInfo) => void): void {
    if (this.watchId !== null) return; // already watching — keep the existing watch
    if (!window.isSecureContext) {
      onError({ status: 'insecure', message: 'Location needs a secure (HTTPS) connection.' });
      return;
    }
    if (!('geolocation' in navigator)) {
      onError({ status: 'unsupported', message: 'This browser does not support location.' });
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) =>
        onFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.stop(); // the browser will not deliver fixes until permission changes
          onError({
            status: 'denied',
            message: 'Location permission is blocked. Allow location for this site in your browser settings.',
          });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          onError({ status: 'unavailable', message: 'Your position is unavailable right now. Check GPS or Wi-Fi.' });
        } else {
          // TIMEOUT — keep watching, just tell the UI we are still searching.
          onError({ status: 'timeout', message: 'Still looking for your position…' });
        }
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 },
    );
  }

  stop(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }
}
