const STORAGE_KEY = 'training-facilities-custom-options';

/**
 * @typedef {{
 *   locations: string[],
 *   facilityTypes: string[],
 *   specificTypes: Record<string, string[]>,
 *   trainingFrames: string[],
 *   trainingOptions: string[],
 * }} CustomOptions
 */

/** @returns {CustomOptions} */
function emptyOptions() {
  return {
    locations: [],
    facilityTypes: [],
    specificTypes: {},
    trainingFrames: [],
    trainingOptions: [],
  };
}

/**
 * Legacy custom-options store (additions only). Still read when seeding catalogs.
 * @returns {CustomOptions}
 */
export function loadCustomOptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyOptions();
    const data = JSON.parse(raw);
    return {
      locations: normalizeList(data.locations),
      facilityTypes: normalizeList(data.facilityTypes),
      specificTypes: normalizeSpecificMap(data.specificTypes),
      trainingFrames: normalizeList(data.trainingFrames),
      trainingOptions: normalizeList(data.trainingOptions),
    };
  } catch {
    return emptyOptions();
  }
}

/**
 * @param {CustomOptions} data
 */
export function saveCustomOptions(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Merge unique trimmed strings, keeping base order then new items.
 * @param {string[]} base
 * @param {string[]} extra
 */
export function mergeUnique(base, extra) {
  const seen = new Set();
  const result = [];

  for (const value of [...base, ...extra]) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
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
 * @returns {Record<string, string[]>}
 */
function normalizeSpecificMap(value) {
  if (!value || typeof value !== 'object') return {};
  /** @type {Record<string, string[]>} */
  const result = {};
  for (const [key, list] of Object.entries(value)) {
    const trimmedKey = String(key).trim();
    if (!trimmedKey) continue;
    result[trimmedKey] = normalizeList(list);
  }
  return result;
}
