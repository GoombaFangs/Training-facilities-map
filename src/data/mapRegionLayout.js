import { AREAS } from '../config/constants.js';
import { getData, setData } from './dataStore.js';

/**
 * Latitude bands for Israel (decimal degrees).
 * North: lat >= northFromLat
 * South: lat < southBelowLat
 * Center: everything between
 */
export const DEFAULT_MAP_REGION_LAYOUT = {
  /** Approx. Hadera / coastal north line */
  northFromLat: 32.5,
  /** Approx. Ashkelon / northern Negev line */
  southBelowLat: 31.5,
};

/**
 * @typedef {{ northFromLat: number, southBelowLat: number }} MapRegionLayout
 */

/**
 * @returns {MapRegionLayout}
 */
export function loadMapRegionLayout() {
  const data = getData('map-region-layout');
  if (data) {
    return normalizeMapRegionLayout(data);
  }
  return { ...DEFAULT_MAP_REGION_LAYOUT };
}

/**
 * @param {MapRegionLayout} layout
 * @returns {MapRegionLayout}
 */
export function saveMapRegionLayout(layout) {
  const normalized = normalizeMapRegionLayout(layout);
  setData('map-region-layout', normalized);
  return normalized;
}

/**
 * @param {unknown} data
 * @returns {MapRegionLayout}
 */
export function normalizeMapRegionLayout(data) {
  const defaults = DEFAULT_MAP_REGION_LAYOUT;
  if (!data || typeof data !== 'object') return { ...defaults };

  const northFromLat = Number(/** @type {Record<string, unknown>} */ (data).northFromLat);
  const southBelowLat = Number(/** @type {Record<string, unknown>} */ (data).southBelowLat);

  return {
    northFromLat: Number.isFinite(northFromLat) ? northFromLat : defaults.northFromLat,
    southBelowLat: Number.isFinite(southBelowLat) ? southBelowLat : defaults.southBelowLat,
  };
}

/**
 * @param {MapRegionLayout} layout
 * @returns {string | null} error message in Hebrew, or null if valid
 */
export function validateMapRegionLayout(layout) {
  const { northFromLat, southBelowLat } = normalizeMapRegionLayout(layout);
  if (!(northFromLat > southBelowLat)) {
    return 'קו הצפון חייב להיות גבוה יותר מקו הדרום (מספר גדול יותר)';
  }
  if (northFromLat < 29 || northFromLat > 34 || southBelowLat < 29 || southBelowLat > 34) {
    return 'קווי הרוחב צריכים להיות בטווח סביר לישראל (בערך 29–34)';
  }
  return null;
}

/**
 * Resolve area label from latitude using saved layout.
 * @param {number} lat
 * @param {MapRegionLayout} [layout]
 * @returns {string}
 */
export function resolveAreaFromLat(lat, layout = loadMapRegionLayout()) {
  const { northFromLat, southBelowLat } = normalizeMapRegionLayout(layout);
  const value = Number(lat);
  if (!Number.isFinite(value)) return AREAS[1]?.value ?? 'מרכז';

  if (value >= northFromLat) return AREAS.find((a) => a.id === 'zafon')?.value ?? 'צפון';
  if (value < southBelowLat) return AREAS.find((a) => a.id === 'darom')?.value ?? 'דרום';
  return AREAS.find((a) => a.id === 'mercaz')?.value ?? 'מרכז';
}
