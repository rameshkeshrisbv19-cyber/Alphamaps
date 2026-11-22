/**
 * Required map credits, always visible at the bottom edge of the screen.
 * OpenStreetMap data (ODbL), OpenMapTiles/OpenFreeMap tiles and MapLibre.
 */
export function Attribution() {
  return (
    <footer className="attribution fixed inset-x-0 bottom-0 z-10 flex h-6 items-center justify-center gap-1.5 px-2 text-[10px] leading-none">
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap contributors
      </a>
      <span aria-hidden="true">·</span>
      <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
        OpenFreeMap
      </a>
      <span aria-hidden="true">·</span>
      <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">
        © OpenMapTiles
      </a>
      <span aria-hidden="true" className="hidden sm:inline">·</span>
      <a href="https://maplibre.org/" target="_blank" rel="noreferrer" className="hidden sm:inline">
        MapLibre
      </a>
    </footer>
  );
}
