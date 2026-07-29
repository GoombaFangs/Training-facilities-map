/**
 * Offline-only map tiles (TMS) served from public/Israel/.
 * No remote tile servers — the map does not require internet.
 *
 * Tiles exist up to zoom 10 (maxNativeZoom). Higher zoom levels
 * overscale those tiles so users can pick points more precisely.
 */

export const TILE_CONFIG = {
  url: '/Israel/{z}/{x}/{y}.png',
  options: {
    minZoom: 8,
    maxZoom: 12,
    maxNativeZoom: 10,
    tms: true,
    attribution: '',
  },
};

export function getTileConfig() {
  return TILE_CONFIG;
}
