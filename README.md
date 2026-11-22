# Alpha Maps — a fast world map PWA

A responsive, installable, offline-capable map built with **React + Vite + TypeScript**, **MapLibre GL JS** and **OpenStreetMap vector tiles**. It opens on a full black-and-grey globe with country, continent, ocean and place names, and adds places, routes, distances, live location and search.

## Features

- **Fast start.** A branded, animated boot screen using the supplied Alpha Maps artwork disappears on the first complete frame (not when every tile has finished). The map is tuned for mobile: capped device-pixel ratio, no tile cross-fade, no expired-tile refresh, parallel tile workers on multi-core devices, a bounded tile cache and a stale-while-revalidate service worker.
- **Globe on start.** The whole Earth is shown, sized to the screen, with country, continent, ocean and sea names. Zoom in for cities, streets, points of interest and buildings.
- **Three themes**, switched with the theme button and remembered between visits:
  - **Noir:** black land, `#05070a` water, light-grey roads (`#b5b5b5` major, `#8a8a8a` minor), dark-grey buildings (`#2a2a2a`) with a faint light outline, silver labels, no coloured land use and no POI icons. Public route numbers are warm amber.
  - **Light:** a bright street map with cream land, blue water, white roads and dark labels.
  - **Dark:** a low-glare charcoal map.
- **Exact names, not approximations.**
  - Place and street labels use the OSM `name:xx` tag for the selected language and fall back to the local `name`, `name:latin` and `name:en` — so a place keeps its real local name instead of disappearing.
  - Roads are drawn from `transportation_name` with the exact OSM road name.
  - Motorways, trunks and primary routes also show the **public route number** from the OSM `ref` tag (I‑5, US 101, M1, A14 …), in a distinct shield-like colour.
  - Tapping a road shows its exact name and, when signposted, the route number; turn-by-turn steps show both too.
- **Boundaries and buildings.** Country outlines — including coastal and island outlines such as India and Sri Lanka — have a dark casing and a near-white line at every zoom; state lines are dashed grey. Buildings are visible from zoom 13 in a light grey that stays dimmer than the roads, with a subtle outline and height-lit 3D extrusions from zoom 14.5. OpenStreetMap building footprints begin at zoom 13, so very small villages need that zoom level to show individual homes.
- **Minimisable turn-by-turn.** The corner button in Directions minimises the sheet to a small floating window showing the next manoeuvre, distance to it, travel mode and live GPS speed. Expand it again or close it from the mini window.
- **Live speed.** The mini directions window shows speed from the device GPS (km/h or mph) alongside Car, Bike or Walk mode.
- **3D buildings.** Flat buildings from zoom 13, extruded 3D buildings from zoom 15. The **3D** button tilts the camera.
- **Label language.** Local (native), English, Hindi, Urdu, Arabic, Bengali, Chinese, Japanese, Russian, Spanish, French, German and Portuguese. Labels use the `name:xx` field and fall back to `name`.
- **My location.** A pulsing blue dot with an accuracy circle, a live position watch, and fly-to on press. Denied or unavailable permission shows a clear message.
- **Distance tool.** Tap to add up to 26 lettered points (A, B, C…). Pins are draggable. The tool shows straight-line (Haversine) and road distances for each leg and in total, can use "My location → A", has a clear button, and switches between km and miles.
- **Place card and directions.** Tap any place, or pick a search result, for its name, coordinates and a **Directions** button.
  - Routes start from your location or from a point you pick on the map.
  - Travel modes: car, bike, walk.
  - Alternatives are drawn in grey and the selected route in yellow. Tap an alternative (on the map or in the list) to select it.
  - Route notes: *Shortest*, *Fastest*, *Fewer turns*, *Avoids highways* (with an ORS key).
  - Turn-by-turn list with icons, street names and route numbers. Tap a step to zoom to it.
  - Live traffic is not included. Times are estimates.
- **Search.** Photon geocoding, debounced and biased to your location. Taps without a name are reverse-geocoded with Nominatim.
- **PWA.** Web-app manifest, service worker, installable, offline app shell and a cache of viewed map tiles.
- **Attribution.** OpenStreetMap, OpenFreeMap, OpenMapTiles and MapLibre credits are always visible.
- **Error handling.** Offline state, no route found, rate limits, location permission, and request timeouts each have a message.

## Quick start

```bash
npm install
npm run dev       # development server (the service worker is disabled here)
npm run build     # production build -> dist/index.html (one self-contained file)
npm run preview   # serves the production build with the service worker active
```

Deep links are supported: `?lat=40.758&lng=-73.9855&z=16&theme=dark&lang=hi` opens that view directly. `theme` accepts `noir`, `normal` (Light) or `dark`.

## Configuration

Everything you may need to change is in **`src/config.ts`**:

| Constant | What it does |
|---|---|
| `MAPTILER_KEY` | Optional. Empty uses OpenFreeMap, which needs no key. |
| `ORS_API_KEY` | Optional. Empty uses OSRM for routing. With a key, OpenRouteService handles all modes and adds "Avoids highways". |
| `TILE_ENDPOINTS`, `ROUTING`, `GEOCODING` | Service URLs and the geocoding rate interval. |

### Getting the free keys (both optional)

**MapTiler (vector tiles and fonts)**
1. Create a free account at <https://cloud.maptiler.com/>.
2. Open *Account → API keys* and copy the default key.
3. Paste it into `MAPTILER_KEY` in `src/config.ts` and rebuild.
4. In the MapTiler dashboard, restrict the key to your site's domain. Any key in a static site is visible to visitors.

**OpenRouteService (routing, including "Avoids highways")**
1. Sign up at <https://openrouteservice.org/dev/#/signup> (free tier).
2. Copy the token from your dashboard.
3. Paste it into `ORS_API_KEY` in `src/config.ts` and rebuild.

Without any keys the app still works: OpenFreeMap tiles, OSRM routing (car through the public demo server, bike and walk through the FOSSGIS OSRM profiles), Photon search and Nominatim reverse lookups.

### Usage policies of the free services

- **Nominatim** (reverse lookups): at most 1 request per second, with an identifiable client. The app throttles to about 1.1 s and caches results. Heavy use needs your own Nominatim instance.
- **Photon** (search): a public fair-use instance. For production traffic, set `GEOCODING.photon` to your own instance or a commercial provider.
- **OSRM demo** (`router.project-osrm.org`): demonstration only, and it serves the car profile only. For production, self-host OSRM or use OpenRouteService.
- **FOSSGIS** bike and walk profiles (`routing.openstreetmap.de`): fair use only.
- **OpenFreeMap**: free. Check their terms for heavy use.

## Deploying for free

The build produces a single self-contained `dist/index.html` (MapLibre, its worker, CSS and JavaScript are all inlined). The PWA files (`manifest.json`, `sw.js` and `icons/`) are copied next to it. Any static host works. Location, the service worker and installation all require HTTPS, which all three hosts below provide.

### GitHub Pages

1. Push the project to a GitHub repository.
2. **Project page** (`https://USER.github.io/REPO/`): set the base path in `vite.config.ts`. The config already has `plugins` and an `alias`, so add `base` alongside them:
   ```ts
   export default defineConfig({
     base: '/REPO/', // your repository name
     // ...existing plugins and resolve.alias stay unchanged
   });
   ```
   Then change the absolute paths in `index.html` to relative ones: `/manifest.json` becomes `./manifest.json`, and `/icons/...` becomes `./icons/...`. A user or organisation site named `USER.github.io` keeps `base: '/'`.
3. Create `.github/workflows/pages.yml`:
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   concurrency:
     group: pages
     cancel-in-progress: true
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: npm
         - run: npm ci
         - run: npm run build
         - uses: actions/upload-pages-artifact@v3
           with:
             path: dist
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```
4. In *Settings → Pages*, set **Source** to **GitHub Actions**. Every push to `main` redeploys.

### Netlify

1. *Add new site → Import an existing project* and select the repository.
2. Build command `npm run build`, publish directory `dist`. If the default Node.js is older than 18, set `NODE_VERSION` to `20` under *Environment variables*.
3. Deploy. Each push to the branch redeploys. For a one-off deploy you can also drag the `dist` folder onto the *Deploys* page.

### Vercel

1. *Add New → Project* and import the repository.
2. Framework preset **Vite**, build command `npm run build`, output directory `dist`.
3. Deploy. Each push to the branch redeploys.

The included `vercel.json` already sets the Vite framework, `npm run build` and `dist` output, so a fresh import needs no extra configuration.

### Installing the app

- **Chrome or Edge (desktop and Android):** use the install icon in the address bar, or the browser menu → *Install app*.
- **iOS Safari:** *Share → Add to Home Screen*.

After one visit while online, the app shell and the map areas you viewed are cached. To check offline use, reload with the network disabled (DevTools → Network → Offline). Search and routing still need a connection.

## Architecture

```
index.html                  title, PWA meta and links, branded instant boot splash
vercel.json                 Vercel build/output settings and service-worker headers
public/
  manifest.json             installable web-app manifest
  sw.js                     service worker: offline app shell + map tile cache
  icons/                    192, 512, maskable 512 and Apple-touch PNG icons
src/
  config.ts                 all keys, endpoints and limits (edit here)
  main.tsx                  React root; registers the service worker in production
  App.tsx                   app state; connects the map, search, panels and location
  index.css                 UI theme tokens (chrome matches the map theme), layout, motion
  types.ts                  shared types
  map/
    MapController.ts        MapLibre wrapper: globe, overlays, markers, tap handling
    styles/
      builder.ts            shared layer recipe → MapLibre style JSON (OpenMapTiles schema)
      noir.ts               Noir palette and style (default theme)
      normal.ts             Light palette and style
      dark.ts               Dark palette and style
      index.ts              theme registry
  lib/
    routing.ts              OSRM and ORS routes, turn texts, route notes, road distances
    geocode.ts              Photon search and Nominatim reverse lookup (throttled, cached)
    location.ts             geolocation watch and friendly error messages
    places.ts               picks the best name under a tap (name + public road ref)
    languages.ts            label languages, name:xx fallback and road refs
    geo.ts                  Haversine, unit formatting, accuracy circle, globe zoom
    http.ts                 fetch with timeout, offline and rate-limit errors; throttle; cache
    storage.ts              saved preferences (theme, language, units)
  components/               search, settings chips, map buttons, bottom sheet, panels, minimised directions, toast, credits
```

**Changing colours or adding a theme.** Each theme is a *palette* object in `src/map/styles/*.ts`. Edit a colour there and the map and chrome update together. To add a theme, copy one palette file, register it in `src/map/styles/index.ts` (and `THEME_OPTIONS` in the same file), and add its UI tokens in `src/index.css`.

**Languages.** The list is in `src/lib/languages.ts`. A language is added by its OpenStreetMap code, for example `fr` for `name:fr`.

**Road numbers.** The `label-road-ref` layer in `builder.ts` reads the OpenMapTiles `ref` field. To change how shields look, edit that layer or add `routeLabel` to a palette.

## Notes and limitations

- **Live traffic is not included.** Times are estimates based on typical speeds.
- **"Avoids highways"** needs `ORS_API_KEY`. The public OSRM servers have no avoid options.
- **Bike and walk** routes from the public servers often come back as a single route, without alternatives.
- **Offline** works for the app shell and the map areas you have viewed. The cache keeps up to about 2,000 tiles and glyphs (`MAX_TILES` in `public/sw.js`).
- **Label language** comes from OpenStreetMap data. Places without a tag in the chosen language fall back to the local name, then the Latin and English names.
- **Route numbers** appear only where OpenStreetMap has a `ref` tag. Not every road is signposted.
- **Single-file build.** Inlining MapLibre and its worker makes `dist/index.html` about 2 MB (about 560 KB gzipped). That is what allows one-file hosting. To serve the worker as a separate file instead, host a copy of `maplibre-gl-worker.mjs` and pass its URL to `setWorkerUrl` in `src/map/MapController.ts`.
- **Keys in static sites are public.** Restrict them by domain and by quota in each provider's dashboard.
- **MapTiler and OpenRouteService** need your own keys. Their code paths are implemented but have not been exercised against the live services.
