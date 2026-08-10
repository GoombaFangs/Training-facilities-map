import {
  FACILITY_TYPES,
  FACILITY_STATUSES,
  TRAINING_TYPE_OPTIONS,
  TRAINING_FRAMES,
  TRAINING_OPTIONS,
  migrateStatusValue,
} from '../config/constants.js';
import { loadCustomOptions, mergeUnique } from './customOptions.js';
import { getData, setData } from './dataStore.js';

/** Editable option lists shown in settings — synced with selectable form fields. */
/** @typedef {'statuses' | 'facilityTypes' | 'trainingTypes' | 'trainingFrames' | 'trainingOptions'} CatalogKey */

/** @type {CatalogKey[]} */
export const CATALOG_KEYS = [
  'facilityTypes',
  'statuses',
  'trainingTypes',
  'trainingFrames',
  'trainingOptions',
];

/** @type {Record<CatalogKey, string>} */
export const CATALOG_LABELS = {
  facilityTypes: 'סוג מתקן',
  statuses: 'סטטוס',
  trainingTypes: 'סוג אימון',
  trainingFrames: 'מסגרת מתאמנת',
  trainingOptions: 'סוגי אימון',
};

const HIDDEN_KEY = 'hidden';

/**
 * @returns {Record<CatalogKey, string[]>}
 */
export function defaultHiddenCatalogs() {
  return Object.fromEntries(CATALOG_KEYS.map((key) => [key, []]));
}

/**
 * @returns {Record<CatalogKey, string[]>}
 */
export function defaultOptionCatalogs() {
  return {
    facilityTypes: FACILITY_TYPES.map((t) => t.value),
    statuses: FACILITY_STATUSES.map((s) => s.value),
    trainingTypes: [...TRAINING_TYPE_OPTIONS],
    trainingFrames: [...TRAINING_FRAMES],
    trainingOptions: [...TRAINING_OPTIONS],
  };
}

/**
 * @returns {{ catalogs: Record<CatalogKey, string[]>, hidden: Record<CatalogKey, string[]> }}
 */
export function loadOptionCatalogsData() {
  const stored = getData('option-catalogs');
  if (stored && typeof stored === 'object') {
    const parsed = /** @type {Record<string, unknown>} */ (stored);
    const normalized = normalizeCatalogs(parsed);
    const hidden = normalizeHidden(parsed[HIDDEN_KEY]);
    const migrated = migrateStatusCatalog(normalized);
    if (migrated.changed) {
      saveOptionCatalogs(migrated.catalogs, hidden);
    }
    return { catalogs: migrated.catalogs, hidden };
  }

  const seeded = seedFromDefaultsAndLegacyCustoms();
  saveOptionCatalogs(seeded);
  return { catalogs: seeded, hidden: defaultHiddenCatalogs() };
}

/**
 * @returns {Record<CatalogKey, string[]>}
 */
export function loadOptionCatalogs() {
  return loadOptionCatalogsData().catalogs;
}

/**
 * @returns {Record<CatalogKey, string[]>}
 */
export function loadHiddenCatalogs() {
  return loadOptionCatalogsData().hidden;
}

/**
 * Rename legacy status labels inside a saved catalog.
 * @param {Record<CatalogKey, string[]>} catalogs
 */
function migrateStatusCatalog(catalogs) {
  let changed = false;
  const statuses = (catalogs.statuses ?? []).map((value) => {
    const next = migrateStatusValue(value);
    if (next !== value) changed = true;
    return next;
  });
  return {
    changed,
    catalogs: {
      ...catalogs,
      statuses: mergeUnique([], statuses),
    },
  };
}

/**
 * First-run seed: defaults + any values previously saved via “שמור ערכים חדשים”.
 * @returns {Record<CatalogKey, string[]>}
 */
function seedFromDefaultsAndLegacyCustoms() {
  const catalogs = defaultOptionCatalogs();
  const legacy = loadCustomOptions();

  catalogs.facilityTypes = mergeUnique(catalogs.facilityTypes, legacy.facilityTypes);
  catalogs.trainingFrames = mergeUnique(catalogs.trainingFrames, legacy.trainingFrames);
  catalogs.trainingOptions = mergeUnique(catalogs.trainingOptions, legacy.trainingOptions);

  const legacyTrainingTypes = Object.values(legacy.specificTypes ?? {}).flat();
  catalogs.trainingTypes = mergeUnique(catalogs.trainingTypes, legacyTrainingTypes);

  return catalogs;
}

/**
 * @param {Record<CatalogKey, string[]>} data
 * @param {Record<CatalogKey, string[]> | undefined} hidden
 */
export function saveOptionCatalogs(data, hidden) {
  const normalized = normalizeCatalogs(data);
  let normalizedHidden = normalizeHidden(hidden);
  if (hidden === undefined) {
    const stored = getData('option-catalogs');
    if (stored && typeof stored === 'object') {
      normalizedHidden = normalizeHidden(
        /** @type {Record<string, unknown>} */ (stored)[HIDDEN_KEY],
      );
    }
  }
  setData('option-catalogs', { ...normalized, [HIDDEN_KEY]: normalizedHidden });
  return normalized;
}

export function resetOptionCatalogs() {
  const defaults = defaultOptionCatalogs();
  saveOptionCatalogs(defaults, defaultHiddenCatalogs());
  return defaults;
}

/**
 * @param {CatalogKey} key
 * @returns {string[]}
 */
export function getCatalogList(key) {
  const { catalogs } = loadOptionCatalogsData();
  return [...(catalogs[key] ?? [])];
}

/**
 * Count how many facilities use a catalog option value.
 * @param {CatalogKey} catalogKey
 * @param {string} value
 * @param {import('geojson').FeatureCollection | null | undefined} facilitiesData
 * @returns {number}
 */
export function countCatalogOptionUsage(catalogKey, value, facilitiesData) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 0;

  const features = facilitiesData?.features ?? [];
  let count = 0;

  for (const feature of features) {
    const props = feature.properties ?? {};
    const nested = props.TypesOfFacilities ?? [];

    switch (catalogKey) {
      case 'facilityTypes':
        if (nested.some((t) => String(t.typeOfFacility ?? '').trim() === trimmed)) count++;
        break;
      case 'statuses':
        if (
          String(props.statusOfFacility ?? '').trim() === trimmed ||
          nested.some((t) => String(t.statusOfFacility ?? '').trim() === trimmed)
        ) {
          count++;
        }
        break;
      case 'trainingTypes':
        if (nested.some((t) => String(t.specificTypeOfFacility ?? '').trim() === trimmed)) count++;
        break;
      case 'trainingFrames':
        if (nested.some((t) => String(t.trainingFrame ?? '').trim() === trimmed)) count++;
        break;
      case 'trainingOptions':
        if (
          nested.some((t) =>
            (t.trainingOptions ?? []).some((option) => String(option).trim() === trimmed),
          )
        ) {
          count++;
        }
        break;
      default:
        break;
    }
  }

  return count;
}

/**
 * Append new values to catalog lists (used by “שמור ערכים חדשים”).
 * @param {Partial<{
 *   facilityTypes: string[],
 *   trainingFrames: string[],
 *   trainingOptions: string[],
 *   trainingTypes: string[],
 *   specificTypes: Record<string, string[]>,
 * }>} additions
 * @returns {{ saved: Record<CatalogKey, string[]>, addedCount: number }}
 */
export function appendToOptionCatalogs(additions) {
  const { catalogs: current, hidden } = loadOptionCatalogsData();
  let addedCount = 0;

  /** @type {CatalogKey[]} */
  const simpleKeys = ['facilityTypes', 'trainingFrames', 'trainingOptions'];
  for (const key of simpleKeys) {
    const extra = additions[key] ?? [];
    const before = current[key].length;
    current[key] = mergeUnique(current[key], extra);
    addedCount += current[key].length - before;
    if (extra.length > 0) {
      const addedSet = new Set(extra.map(String));
      hidden[key] = (hidden[key] ?? []).filter((value) => !addedSet.has(value));
    }
  }

  const trainingTypeExtras = [
    ...(additions.trainingTypes ?? []),
    ...Object.values(additions.specificTypes ?? {}).flat(),
  ];
  const beforeTypes = current.trainingTypes.length;
  current.trainingTypes = mergeUnique(current.trainingTypes, trainingTypeExtras);
  addedCount += current.trainingTypes.length - beforeTypes;
  if (trainingTypeExtras.length > 0) {
    const addedSet = new Set(trainingTypeExtras.map(String));
    hidden.trainingTypes = (hidden.trainingTypes ?? []).filter((value) => !addedSet.has(value));
  }

  saveOptionCatalogs(current, hidden);
  return { saved: current, addedCount };
}

/**
 * @param {unknown} data
 * @returns {Record<CatalogKey, string[]>}
 */
function normalizeCatalogs(data) {
  const defaults = defaultOptionCatalogs();
  if (!data || typeof data !== 'object') return defaults;

  /** @type {Record<CatalogKey, string[]>} */
  const result = { ...defaults };

  for (const key of CATALOG_KEYS) {
    const list = normalizeList(/** @type {Record<string, unknown>} */ (data)[key]);
    result[key] = list.length > 0 ? list : defaults[key];
  }

  return result;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return mergeUnique([], value.map(String));
}

/**
 * @param {unknown} value
 * @returns {Record<CatalogKey, string[]>}
 */
function normalizeHidden(value) {
  const defaults = defaultHiddenCatalogs();
  if (!value || typeof value !== 'object') return defaults;

  /** @type {Record<CatalogKey, string[]>} */
  const result = { ...defaults };
  for (const key of CATALOG_KEYS) {
    result[key] = normalizeList(/** @type {Record<string, unknown>} */ (value)[key]);
  }
  return result;
}

/**
 * Resolve CSS class for a facility type value (known types keep their class).
 * @param {string} value
 */
export function getFacilityTypeCssClass(value) {
  return FACILITY_TYPES.find((t) => t.value === value)?.cssClass ?? 'facilityTypeCustom';
}

/**
 * Resolve CSS class for a status value.
 * @param {string} value
 */
export function getStatusCssClass(value) {
  const migrated = migrateStatusValue(value);
  return FACILITY_STATUSES.find((s) => s.value === migrated)?.cssClass ?? 'statusCustom';
}
