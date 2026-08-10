import { getData, setData } from './dataStore.js';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   personalNumber: string,
 *   password: string,
 *   facilityIds: string[],
 * }} FacilityManager
 */

/**
 * @returns {FacilityManager[]}
 */
export function loadFacilityManagers() {
  const data = getData('managers');
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => normalizeManager(item))
    .filter((item) => item.name && item.password);
}

/**
 * @param {FacilityManager[]} managers
 */
export function saveFacilityManagers(managers) {
  const cleaned = managers
    .map((item) => normalizeManager(item))
    .filter((item) => item.name && item.personalNumber && item.password);
  setData('managers', cleaned);
  return cleaned;
}

/**
 * @param {unknown} item
 * @returns {FacilityManager}
 */
function normalizeManager(item) {
  const raw = item && typeof item === 'object' ? item : {};
  const facilityIds = Array.isArray(raw.facilityIds)
    ? [...new Set(raw.facilityIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];

  return {
    id: String(raw.id ?? '').trim() || createManagerId(),
    name: String(raw.name ?? '').trim(),
    personalNumber: String(raw.personalNumber ?? '').trim(),
    password: String(raw.password ?? ''),
    facilityIds,
  };
}

/**
 * @param {string} password
 * @returns {FacilityManager | null}
 */
export function findFacilityManagerByPassword(password) {
  const needle = String(password ?? '');
  if (!needle) return null;
  return loadFacilityManagers().find((m) => m.password === needle) ?? null;
}

/**
 * @param {string} name
 * @returns {FacilityManager | null}
 */
export function findFacilityManagerByName(name) {
  const needle = String(name ?? '').trim().toLowerCase();
  if (!needle) return null;
  return (
    loadFacilityManagers().find((m) => m.name.trim().toLowerCase() === needle) ?? null
  );
}

/**
 * @param {string} personalNumber
 * @returns {FacilityManager | null}
 */
export function findFacilityManagerByPersonalNumber(personalNumber) {
  const needle = String(personalNumber ?? '').trim();
  if (!needle) return null;
  return loadFacilityManagers().find((m) => m.personalNumber === needle) ?? null;
}

export function createManagerId() {
  return `mgr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * First letter of a Hebrew/English name for the role badge.
 * @param {string} name
 */
export function getManagerInitial(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed ? trimmed.charAt(0) : 'מ';
}
