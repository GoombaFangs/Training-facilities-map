/**
 * Shared data layer for closed-network deployment.
 * Reads/writes through the local server API when available,
 * with in-memory cache for sync access and localStorage fallback for offline dev.
 */

/** @typedef {'facilities' | 'managers' | 'option-catalogs' | 'map-region-layout' | 'manager-reports'} DataKey */

/** @type {Record<DataKey, string>} */
export const LOCAL_STORAGE_KEYS = {
  facilities: 'training-facilities-data',
  managers: 'training-facilities-managers',
  'option-catalogs': 'training-facilities-option-catalogs',
  'map-region-layout': 'training-facilities-map-region-layout',
  'manager-reports': 'training-facilities-manager-reports',
};

/** @type {DataKey[]} */
export const DATA_KEYS = [
  'facilities',
  'managers',
  'option-catalogs',
  'map-region-layout',
  'manager-reports',
];

/** @type {Map<DataKey, unknown>} */
const cache = new Map();

/** @type {Map<DataKey, number>} */
const versions = new Map();

/** @type {Map<DataKey, ReturnType<typeof setTimeout>>} */
const saveTimers = new Map();

let apiAvailable = false;
let pollTimer = 0;

const SAVE_DEBOUNCE_MS = 400;
const POLL_INTERVAL_MS = 15000;

/**
 * @typedef {{
 *   onFacilitiesUpdate?: (data: GeoJSON.FeatureCollection) => void,
 *   onManagersUpdate?: (data: unknown[]) => void,
 *   onOptionCatalogsUpdate?: (data: unknown) => void,
 *   onMapLayoutUpdate?: (data: unknown) => void,
 *   onReportsUpdate?: (data: unknown[]) => void,
 * }} DataPollHandlers
 */

/** @type {DataPollHandlers} */
let pollHandlers = {};

/**
 * Initialize the data store — call once at app startup.
 * @returns {Promise<boolean>} true if server API is available
 */
export async function initDataStore() {
  apiAvailable = await checkApiHealth();

  if (apiAvailable) {
    await Promise.all(DATA_KEYS.map((key) => refreshKeyFromApi(key)));
    return true;
  }

  for (const key of DATA_KEYS) {
    const local = readLocalStorage(key);
    if (local !== null) {
      cache.set(key, local);
    }
  }

  return false;
}

/**
 * @returns {boolean}
 */
export function isApiAvailable() {
  return apiAvailable;
}

/**
 * @param {DataKey} key
 * @returns {unknown | null}
 */
export function getData(key) {
  return cache.has(key) ? cache.get(key) : null;
}

/**
 * @param {DataKey} key
 * @param {unknown} data
 */
export function setData(key, data) {
  cache.set(key, data);
  versions.set(key, Date.now());

  if (apiAvailable) {
    scheduleApiSave(key, data);
    return;
  }

  writeLocalStorage(key, data);
}

/**
 * @param {DataKey} key
 */
export function clearData(key) {
  cache.delete(key);
  versions.delete(key);

  if (!apiAvailable) {
    const lsKey = LOCAL_STORAGE_KEYS[key];
    if (lsKey) localStorage.removeItem(lsKey);
    return;
  }

  scheduleApiSave(key, null);
}

/**
 * @param {DataPollHandlers} handlers
 */
export function startDataPolling(handlers = {}) {
  pollHandlers = handlers;
  if (!apiAvailable) return;

  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => {
    pollForUpdates().catch((error) => {
      console.warn('Data poll failed:', error);
    });
  }, POLL_INTERVAL_MS);
}

/**
 * @param {DataPollHandlers} handlers
 */
export function updatePollHandlers(handlers) {
  pollHandlers = { ...pollHandlers, ...handlers };
}

export function stopDataPolling() {
  window.clearInterval(pollTimer);
  pollTimer = 0;
}

async function checkApiHealth() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    if (!response.ok) return false;
    const body = await response.json();
    return Boolean(body?.ok);
  } catch {
    return false;
  }
}

/**
 * @param {DataKey} key
 */
async function refreshKeyFromApi(key) {
  const response = await fetch(`/api/data/${key}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${key}: ${response.status}`);
  }

  const body = await response.json();
  cache.set(key, body.data);
  versions.set(key, Number(body.updatedAt) || Date.now());
}

async function pollForUpdates() {
  const response = await fetch('/api/meta', { cache: 'no-store' });
  if (!response.ok) return;

  /** @type {Record<string, { updatedAt: number }>} */
  const meta = await response.json();

  for (const key of DATA_KEYS) {
    const remoteVersion = Number(meta[key]?.updatedAt) || 0;
    const localVersion = versions.get(key) || 0;
    if (remoteVersion <= localVersion) continue;

    await refreshKeyFromApi(key);
    notifyDataChange(key);
  }
}

/**
 * @param {DataKey} key
 */
function notifyDataChange(key) {
  const data = cache.get(key);
  switch (key) {
    case 'facilities':
      pollHandlers.onFacilitiesUpdate?.(/** @type {GeoJSON.FeatureCollection} */ (data));
      break;
    case 'managers':
      pollHandlers.onManagersUpdate?.(/** @type {unknown[]} */ (data));
      break;
    case 'option-catalogs':
      pollHandlers.onOptionCatalogsUpdate?.(data);
      break;
    case 'map-region-layout':
      pollHandlers.onMapLayoutUpdate?.(data);
      break;
    case 'manager-reports':
      pollHandlers.onReportsUpdate?.(/** @type {unknown[]} */ (data));
      break;
    default:
      break;
  }
}

/**
 * @param {DataKey} key
 * @param {unknown} data
 */
function scheduleApiSave(key, data) {
  const existing = saveTimers.get(key);
  if (existing) window.clearTimeout(existing);

  saveTimers.set(
    key,
    window.setTimeout(() => {
      saveTimers.delete(key);
      persistToApi(key, data).catch((error) => {
        console.error(`Failed to save ${key}:`, error);
      });
    }, SAVE_DEBOUNCE_MS),
  );
}

/**
 * @param {DataKey} key
 * @param {unknown} data
 */
async function persistToApi(key, data) {
  const response = await fetch(`/api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    throw new Error(`Save failed for ${key}: ${response.status}`);
  }

  const body = await response.json();
  versions.set(key, Number(body.updatedAt) || Date.now());
}

/**
 * @param {DataKey} key
 */
function readLocalStorage(key) {
  const lsKey = LOCAL_STORAGE_KEYS[key];
  if (!lsKey) return null;

  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {DataKey} key
 * @param {unknown} data
 */
function writeLocalStorage(key, data) {
  const lsKey = LOCAL_STORAGE_KEYS[key];
  if (!lsKey) return;
  localStorage.setItem(lsKey, JSON.stringify(data));
}

/**
 * Flush pending saves immediately (e.g. before page unload).
 */
export async function flushPendingSaves() {
  const pending = [...saveTimers.entries()];
  saveTimers.clear();

  for (const [key, timerId] of pending) {
    window.clearTimeout(timerId);
    if (apiAvailable) {
      await persistToApi(key, cache.get(key));
    }
  }
}
