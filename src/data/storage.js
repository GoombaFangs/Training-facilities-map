import { getData, setData, clearData } from './dataStore.js';

/**
 * @returns {GeoJSON.FeatureCollection | null}
 */
export function loadStoredFacilities() {
  const data = getData('facilities');
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    return null;
  }
  return data;
}

/**
 * @param {GeoJSON.FeatureCollection} data
 */
export function saveFacilities(data) {
  setData('facilities', data);
}

export function clearStoredFacilities() {
  clearData('facilities');
}
