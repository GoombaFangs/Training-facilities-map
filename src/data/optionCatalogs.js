import {
  FACILITY_TYPES,
  AREAS,
  FACILITY_STATUSES,
  LOCATIONS,
  TRAINING_TYPE_OPTIONS,
  TRAINING_FRAMES,
  TRAINING_OPTIONS,
  migrateStatusValue,
} from '../config/constants.js';
import { loadCustomOptions, mergeUnique } from './customOptions.js';

const STORAGE_KEY = 'training-facilities-option-catalogs';

/** @typedef {'locations' | 'areas' | 'statuses' | 'facilityTypes' | 'trainingTypes' | 'trainingFrames' | 'trainingOptions'} CatalogKey */

/** @type {CatalogKey[]} */
export const CATALOG_KEYS = [
  'locations',
  'areas',
  'statuses',
  'facilityTypes',
  'trainingTypes',
  'trainingFrames',
  'trainingOptions',
];

/** @type {Record<CatalogKey, string>} */
export const CATALOG_LABELS = {
  locations: 'מיקום / בסיס',
  areas: 'אזור בארץ',
  statuses: 'סטטוס',
  facilityTypes: 'סוג מתקן',
  trainingTypes: 'סוג אימון',
  trainingFrames: 'מסגרת מתאמנת',
  trainingOptions: 'סוגי אימון',
};

/**
 * @returns {Record<CatalogKey, string[]>}
 */
export function defaultOptionCatalogs() {
  return {
    locations: [...LOCATIONS],
    areas: AREAS.map((a) => a.value),
    statuses: FACILITY_STATUSES.map((s) => s.value),
    facilityTypes: FACILITY_TYPES.map((t) => t.value),
    trainingTypes: [...TRAINING_TYPE_OPTIONS],
    trainingFrames: [...TRAINING_FRAMES],
    trainingOptions: [...TRAINING_OPTIONS],
  };
}

/**
 * @returns {Record<CatalogKey, string[]>}
 */
export function loadOptionCatalogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeCatalogs(parsed);
      const migrated = migrateStatusCatalog(normalized);
      if (migrated.changed) {
        saveOptionCatalogs(migrated.catalogs);
      }
      return migrated.catalogs;
    }
  } catch {
    /* fall through to seed */
  }

  const seeded = seedFromDefaultsAndLegacyCustoms();
  saveOptionCatalogs(seeded);
  return seeded;
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

  catalogs.locations = mergeUnique(catalogs.locations, legacy.locations);
  catalogs.facilityTypes = mergeUnique(catalogs.facilityTypes, legacy.facilityTypes);
  catalogs.trainingFrames = mergeUnique(catalogs.trainingFrames, legacy.trainingFrames);
  catalogs.trainingOptions = mergeUnique(catalogs.trainingOptions, legacy.trainingOptions);

  const legacyTrainingTypes = Object.values(legacy.specificTypes ?? {}).flat();
  catalogs.trainingTypes = mergeUnique(catalogs.trainingTypes, legacyTrainingTypes);

  return catalogs;
}

/**
 * @param {Record<CatalogKey, string[]>} data
 */
export function saveOptionCatalogs(data) {
  const normalized = normalizeCatalogs(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetOptionCatalogs() {
  const defaults = defaultOptionCatalogs();
  saveOptionCatalogs(defaults);
  return defaults;
}

/**
 * @param {CatalogKey} key
 * @returns {string[]}
 */
export function getCatalogList(key) {
  const catalogs = loadOptionCatalogs();
  return [...(catalogs[key] ?? [])];
}

/**
 * Append new values to catalog lists (used by “שמור ערכים חדשים”).
 * @param {Partial<{
 *   locations: string[],
 *   facilityTypes: string[],
 *   trainingFrames: string[],
 *   trainingOptions: string[],
 *   trainingTypes: string[],
 *   specificTypes: Record<string, string[]>,
 * }>} additions
 * @returns {{ saved: Record<CatalogKey, string[]>, addedCount: number }}
 */
export function appendToOptionCatalogs(additions) {
  const current = loadOptionCatalogs();
  let addedCount = 0;

  /** @type {CatalogKey[]} */
  const simpleKeys = ['locations', 'facilityTypes', 'trainingFrames', 'trainingOptions'];
  for (const key of simpleKeys) {
    const extra = additions[key] ?? [];
    const before = current[key].length;
    current[key] = mergeUnique(current[key], extra);
    addedCount += current[key].length - before;
  }

  const trainingTypeExtras = [
    ...(additions.trainingTypes ?? []),
    ...Object.values(additions.specificTypes ?? {}).flat(),
  ];
  const beforeTypes = current.trainingTypes.length;
  current.trainingTypes = mergeUnique(current.trainingTypes, trainingTypeExtras);
  addedCount += current.trainingTypes.length - beforeTypes;

  saveOptionCatalogs(current);
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
  return FACILITY_STATUSES.find((s) => s.value === migrated)?.cssClass ?? 'statusInactive';
}
