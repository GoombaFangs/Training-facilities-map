import { state } from '../state.js';

const STORAGE_KEY = 'training-facilities-manager-preferences';

/**
 * @typedef {{
 *   filterTypes: string[],
 *   filterAreas: string[],
 *   filterStatuses: string[],
 *   filterTrainingTypes: string[],
 *   filterTrainingFrames: string[],
 *   filterTrainingOptions: string[],
 * }} FilterSnapshot
 */

/**
 * @typedef {{
 *   filters: FilterSnapshot,
 *   searchQuery: string,
 *   updatedAt: number,
 * }} ManagerViewPreferences
 */

/**
 * Resolve the storage key for the currently logged-in user.
 * @returns {string}
 */
export function getManagerPreferenceKey() {
  if (state.facilityManager?.id) return state.facilityManager.id;
  if (state.role === 'admin') return 'main-admin';
  return 'guest';
}

/**
 * @returns {Record<string, ManagerViewPreferences>}
 */
function loadAllPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, ManagerViewPreferences>} all
 */
function saveAllPreferences(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * @param {string} [key]
 * @returns {ManagerViewPreferences | null}
 */
export function loadManagerPreferences(key = getManagerPreferenceKey()) {
  const stored = loadAllPreferences()[key];
  if (!stored) return null;
  return normalizePreferences(stored);
}

/**
 * @param {string} key
 * @param {Partial<ManagerViewPreferences>} prefs
 */
export function saveManagerPreferences(key, prefs) {
  const all = loadAllPreferences();
  all[key] = normalizePreferences({
    ...all[key],
    ...prefs,
    updatedAt: Date.now(),
  });
  saveAllPreferences(all);
}

/**
 * @param {Partial<ManagerViewPreferences>} prefs
 */
export function saveCurrentManagerPreferences(prefs) {
  saveManagerPreferences(getManagerPreferenceKey(), prefs);
}

/**
 * @param {unknown} item
 * @returns {ManagerViewPreferences}
 */
function normalizePreferences(item) {
  const raw = item && typeof item === 'object' ? item : {};
  const filters =
    raw.filters && typeof raw.filters === 'object' ? raw.filters : {};

  return {
    filters: {
      filterTypes: normalizeStringArray(filters.filterTypes),
      filterAreas: normalizeStringArray(filters.filterAreas),
      filterStatuses: normalizeStringArray(filters.filterStatuses),
      filterTrainingTypes: normalizeStringArray(filters.filterTrainingTypes),
      filterTrainingFrames: normalizeStringArray(filters.filterTrainingFrames),
      filterTrainingOptions: normalizeStringArray(filters.filterTrainingOptions),
    },
    searchQuery: String(raw.searchQuery ?? ''),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}
