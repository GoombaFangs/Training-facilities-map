import { loadStoredFacilities, saveFacilities } from './storage.js';
import { migrateStatusValue } from '../config/constants.js';

const DATA_URL = '/data/data.geojson';

export async function loadFacilities() {
  const stored = loadStoredFacilities();
  if (stored) {
    return ensureFeatureIds(stored, { persistIfMigrated: true });
  }

  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load facilities: ${response.status}`);
  }

  const data = await response.json();

  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Invalid GeoJSON: expected a FeatureCollection');
  }

  return ensureFeatureIds(data, { persistIfMigrated: true });
}

/**
 * @param {GeoJSON.FeatureCollection} data
 * @param {{ persistIfMigrated?: boolean }} [options]
 */
export function ensureFeatureIds(data, options = {}) {
  let migrated = false;

  data.features.forEach((feature) => {
    if (!feature.properties) feature.properties = {};
    if (!feature.properties.id) {
      feature.properties.id = createId();
    }

    const prevStatus = feature.properties.statusOfFacility;
    const nextStatus = migrateStatusValue(prevStatus);
    if (nextStatus && nextStatus !== prevStatus) {
      feature.properties.statusOfFacility = nextStatus;
      migrated = true;
    }

    const types = feature.properties.TypesOfFacilities;
    if (Array.isArray(types)) {
      types.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        if (!entry.statusOfFacility && feature.properties.statusOfFacility) {
          entry.statusOfFacility = feature.properties.statusOfFacility;
          migrated = true;
        }
        if (!entry.locationOfFacility && feature.properties.locationOfFacility) {
          entry.locationOfFacility = feature.properties.locationOfFacility;
          migrated = true;
        }
        const prevTypeStatus = entry.statusOfFacility;
        const nextTypeStatus = migrateStatusValue(prevTypeStatus);
        if (nextTypeStatus && nextTypeStatus !== prevTypeStatus) {
          entry.statusOfFacility = nextTypeStatus;
          migrated = true;
        }
      });
    }
  });

  if (migrated && options.persistIfMigrated) {
    saveFacilities(data);
  }

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
  const facilities = Array.isArray(values.facilities) ? values.facilities : [];

  const types = facilities.map((facility) => {
    const trainingOptions = String(facility.trainingOptions || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const imgArr = Array.isArray(facility.imgArr)
      ? facility.imgArr.filter(Boolean)
      : String(facility.imgArr || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    return {
      name: String(facility.name || facility.typeOfFacility || '').trim(),
      statusOfFacility: String(facility.statusOfFacility || 'פעיל').trim(),
      locationOfFacility: String(facility.locationOfFacility || '').trim(),
      typeOfFacility: facility.typeOfFacility,
      specificTypeOfFacility: String(facility.specificTypeOfFacility || '').trim(),
      trainingOptions,
      trainingFrame: String(facility.trainingFrame || '').trim(),
      contactName: String(facility.contactName || '').trim(),
      contactRank: String(facility.contactRank || '').trim(),
      contactPhone: String(facility.contactPhone || '').trim(),
      imgArr,
      comments: String(facility.comments || '').trim(),
    };
  });

  const primary = types[0] ?? {};

  return {
    type: 'Feature',
    properties: {
      id: existingId || createId(),
      nameOfFacility: values.nameOfFacility.trim(),
      unitOwningTheFacility: values.unitOwningTheFacility.trim(),
      statusOfFacility: primary.statusOfFacility || 'פעיל',
      phoneOfFacility: String(values.phoneOfFacility || '').trim(),
      contactNameOfFacility: String(values.contactNameOfFacility || '').trim(),
      contactRoleOfFacility: String(values.contactRoleOfFacility || '').trim(),
      locationOfFacility: primary.locationOfFacility || '',
      areaInTheCountry: values.areaInTheCountry,
      TypesOfFacilities: types,
    },
    geometry: {
      type: 'Point',
      coordinates: [Number(values.lng), Number(values.lat)],
    },
  };
}
