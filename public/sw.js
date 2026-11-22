/*
 * Alpha Maps service worker — offline-first app shell plus a map-tile cache.
 *
 *  - Page navigations: network-first so a new Vercel deployment is picked up
 *    immediately, with the cached app shell as the offline fallback.
 *  - Other same-origin files: stale-while-revalidate.
 *    The app starts instantly from cache and updates in the background.
 *  - Map vector tiles and glyphs (OpenFreeMap / MapTiler, *.pbf): cache-first,
 *    capped at MAX_TILES entries so storage stays bounded.
 *  - Other map metadata (TileJSON): network-first, cached as a fallback.
 *  - Routing and geocoding APIs are never cached here: they are live,
 *    rate-limited and the app already caches results in memory.
 */

const VERSION = 'v4';
const SHELL_CACHE = `alpha-map-shell-${VERSION}`;
const TILE_CACHE = `alpha-map-tiles-${VERSION}`;
const MAX_TILES = 2000;
const TILE_HOSTS = ['tiles.openfreemap.org', 'api.maptiler.com'];
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/app-logo-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individual adds so a missing optional file never blocks installation.
      await Promise.all(SHELL_FILES.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          // Remove Alpha Maps caches from previous versions.
          .filter((key) => key.startsWith('alpha-map-') && key !== SHELL_CACHE && key !== TILE_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 1) The app itself: latest deployment first, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request, SHELL_CACHE));
    return;
  }

  // 2) Same-origin static files (manifest, icons, …).
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // 3) Map data from the tile providers.
  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(url.pathname.endsWith('.pbf') ? cacheFirst(request) : networkFirst(request));
  }
});

/** Network-first for the app shell, with an offline cache fallback. */
async function networkFirstNavigation(request, cacheName) {
  const cache = await caches.open(cacheName);
  const shellUrl = new URL('./index.html', self.registration.scope).href;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
      cache.put(shellUrl, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(shellUrl)) || offlineResponse();
  }
}

/** Returns the cached copy immediately (if any) and refreshes it in the background. */
async function staleWhileRevalidate(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  const cached = (await cache.match(request)) || (fallbackUrl ? await cache.match(fallbackUrl) : undefined);
  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await refresh) || offlineResponse();
}

/** Cache-first for immutable tiles and glyphs; evicts the oldest entries beyond MAX_TILES. */
async function cacheFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const response = await fetchWithRetry(request, 2);
    if (response.ok) {
      cache.put(request, response.clone());
      trim(cache, MAX_TILES);
    }
    return response;
  } catch {
    return offlineResponse();
  }
}

/** Network-first with a cached fallback (used for TileJSON, which can change). */
async function networkFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  try {
    const response = await fetchWithRetry(request, 2);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || offlineResponse();
  }
}

/** A small retry helps tiles arrive on slow or flaky mobile connections. */
async function fetchWithRetry(request, attempts) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(request);
      if (response.ok || response.status < 500) return response;
      last = response;
    } catch (err) {
      last = err;
    }
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
  }
  if (last instanceof Response) return last;
  throw last;
}

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
  }
}

function offlineResponse() {
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}
