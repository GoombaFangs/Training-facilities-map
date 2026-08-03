import L from 'leaflet';
import { MAP_BOUNDS, DEFAULT_VIEW } from '../config/mapBounds.js';
import { getTileConfig } from '../config/tileConfig.js';
import { state } from '../state.js';
import { loadIsraelBoundary, addIsraelOutsideMask } from '../data/israelBoundary.js';

export function createMap(containerId = 'map') {
  const bounds = L.latLngBounds(
    L.latLng(...MAP_BOUNDS.southWest),
    L.latLng(...MAP_BOUNDS.northEast),
  );

  const tiles = getTileConfig();

  const map = L.map(containerId, {
    maxBounds: bounds,
    maxBoundsViscosity: 1.0,
    attributionControl: false,
    zoomControl: false,
    minZoom: tiles.options.minZoom,
    maxZoom: tiles.options.maxZoom,
  }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);

  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.tileLayer(tiles.url, tiles.options).addTo(map);

  state.map = map;

  loadIsraelBoundary()
    .then(() => {
      addIsraelOutsideMask(map);
    })
    .catch((error) => {
      console.error(error);
    });

  return map;
}
