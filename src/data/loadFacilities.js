import { loadStoredFacilities, saveFacilities } from './storage.js';

const DATA_URL = '/data/data.geojson';

export async function loadFacilities() {
  const stored = loadStoredFacilities();
  if (stored) {
    return ensureFeatureIds(stored);
  }

  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load facilities: ${response.status}`);
  }

  const data = await response.json();

  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Invalid GeoJSON: expected a FeatureCollection');
  }

  return ensureFeatureIds(data);
}

/**
 * @param {GeoJSON.FeatureCollection} data
 */
export function ensureFeatureIds(data) {
  data.features.forEach((feature) => {
    if (!feature.properties) feature.properties = {};
    if (!feature.properties.id) {
      feature.properties.id = createId();
    }
  });
  return data;
}

export function createId() {
  return `fac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {GeoJSON.FeatureCollection} data
 * @param {GeoJSON.Feature} feature
 */
export function addFacility(data, feature) {
  data.features.push(feature);
  saveFacilities(data);
  return data;
}

/**
 * @param {GeoJSON.FeatureCollection} data
 * @param {string} id
 * @param {GeoJSON.Feature} updated
 */
export function updateFacility(data, id, updated) {
  const index = data.features.findIndex((f) => f.properties?.id === id);
  if (index === -1) return data;
  data.features[index] = updated;
  saveFacilities(data);
  return data;
}

/**
 * @param {GeoJSON.FeatureCollection} data
 * @param {string} id
 */
export function deleteFacility(data, id) {
  data.features = data.features.filter((f) => f.properties?.id !== id);
  saveFacilities(data);
  return data;
}

/**
 * Build a GeoJSON feature from form values.
 * @param {object} values
 * @param {string} [existingId]
 */
export function buildFeatureFromForm(values, existingId) {
  const trainingOptions = String(values.trainingOptions || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const imgArr = String(values.imgArr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    type: 'Feature',
    properties: {
      id: existingId || createId(),
      nameOfFacility: values.nameOfFacility.trim(),
      unitOwningTheFacility: values.unitOwningTheFacility.trim(),
      statusOfFacility: values.statusOfFacility || 'פעיל',
      phoneOfFacility: String(values.phoneOfFacility || '').trim(),
      locationOfFacility: values.locationOfFacility.trim(),
      areaInTheCountry: values.areaInTheCountry,
      TypesOfFacilities: [
        {
          typeOfFacility: values.typeOfFacility,
          specificTypeOfFacility: values.specificTypeOfFacility.trim(),
          trainingOptions,
          trainingFrame: values.trainingFrame.trim(),
          imgArr,
          comments: values.comments.trim(),
        },
      ],
    },
    geometry: {
      type: 'Point',
      coordinates: [Number(values.lng), Number(values.lat)],
    },
  };
}
