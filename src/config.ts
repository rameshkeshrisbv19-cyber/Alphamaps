/**
 * ============================================================================
 *  CENTRAL CONFIGURATION
 *  Everything you might need to change (keys, endpoints, defaults) lives here.
 * ============================================================================
 */

/**
 * OPTIONAL — MapTiler free key (https://cloud.maptiler.com → Account → API keys).
 * Leave empty to use OpenFreeMap (free, no key, OpenMapTiles schema).
 * When set, vector tiles and glyphs are served by MapTiler instead.
 */
export const MAPTILER_KEY = '';

/**
 * OPTIONAL — OpenRouteService free key (https://openrouteservice.org/dev/#/signup).
 * Leave empty to route with OSRM only. With a key, ORS handles car/bike/walk and
 * adds a true "Avoids highways" option through its `avoid_features` parameter.
 */
export const ORS_API_KEY = '';

export const APP_NAME = 'Alpha Maps';

/** Attribution stored on the vector source. The visible footer lists every credit. */
export const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const OPENFREEMAP = {
  tileJson: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
};

const MAPTILER = {
  tileJson: `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}`,
  glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}`,
};

/** Active vector-tile provider: MapTiler when a key is set, otherwise OpenFreeMap. */
export const TILE_ENDPOINTS = MAPTILER_KEY ? MAPTILER : OPENFREEMAP;

/**
 * Routing back-ends (all OSRM-compatible, all CORS-enabled).
 * The OSRM demo server only serves the car profile, so bike and walk use the
 * FOSSGIS OSRM instances. ORS (with a key) replaces these when configured.
 */
export const ROUTING = {
  car: 'https://router.project-osrm.org',
  bike: 'https://routing.openstreetmap.de/routed-bike',
  walk: 'https://routing.openstreetmap.de/routed-foot',
  ors: 'https://api.openrouteservice.org',
};

/**
 * Geocoding. Photon powers search (typeahead-friendly); Nominatim powers reverse
 * lookups for tapped points. Nominatim's policy allows max 1 request/second, so
 * every geocoding call goes through one shared throttle.
 */
export const GEOCODING = {
  photon: 'https://photon.komoot.io/api/',
  nominatim: 'https://nominatim.openstreetmap.org',
  minIntervalMs: 1100,
};
