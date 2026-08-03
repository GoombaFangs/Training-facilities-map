const STORAGE_KEY = 'training-facilities-managers';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   password: string,
 *   facilityIds: string[],
 * }} FacilityManager
 */

/**
 * @returns {FacilityManager[]}
 */
export function loadFacilityManagers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => normalizeManager(item))
      .filter((item) => item.name && item.password);
  } catch {
    return [];
  }
}

/**
 * @param {FacilityManager[]} managers
 */
export function saveFacilityManagers(managers) {
  const cleaned = managers
    .map((item) => normalizeManager(item))
    .filter((item) => item.name && item.password);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
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
