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
 * @param {Partial<CustomOptions>} additions
 * @returns {{ saved: CustomOptions, addedCount: number }}
 */
export function addCustomValues(additions) {
  const current = loadCustomOptions();
  let addedCount = 0;

  const beforeLoc = current.locations.length;
  current.locations = mergeUnique(current.locations, additions.locations ?? []);
  addedCount += current.locations.length - beforeLoc;

  const beforeTypes = current.facilityTypes.length;
  current.facilityTypes = mergeUnique(
    current.facilityTypes,
    additions.facilityTypes ?? [],
  );
  addedCount += current.facilityTypes.length - beforeTypes;

  const beforeFrames = current.trainingFrames.length;
  current.trainingFrames = mergeUnique(
    current.trainingFrames,
    additions.trainingFrames ?? [],
  );
  addedCount += current.trainingFrames.length - beforeFrames;

  const beforeOpts = current.trainingOptions.length;
  current.trainingOptions = mergeUnique(
    current.trainingOptions,
    additions.trainingOptions ?? [],
  );
  addedCount += current.trainingOptions.length - beforeOpts;

  for (const [key, values] of Object.entries(additions.specificTypes ?? {})) {
    const facilityKey = String(key).trim();
    if (!facilityKey) continue;
    const before = (current.specificTypes[facilityKey] ?? []).length;
    current.specificTypes[facilityKey] = mergeUnique(
      current.specificTypes[facilityKey] ?? [],
      values ?? [],
    );
    addedCount += current.specificTypes[facilityKey].length - before;
  }

  saveCustomOptions(current);
  return { saved: current, addedCount };
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
