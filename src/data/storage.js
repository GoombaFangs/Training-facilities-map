const STORAGE_KEY = 'training-facilities-data';

/**
 * @returns {GeoJSON.FeatureCollection | null}
 */
export function loadStoredFacilities() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {GeoJSON.FeatureCollection} data
 */
export function saveFacilities(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearStoredFacilities() {
  localStorage.removeItem(STORAGE_KEY);
}
