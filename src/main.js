import 'leaflet/dist/leaflet.css';
import './styles/main.css';

import { createMap } from './map/createMap.js';
import { addMarkers, highlightFacilityOnMap, focusFacilityOnMap } from './map/markers.js';
import { loadFacilities } from './data/loadFacilities.js';
import { filterFacilities } from './data/filterFacilities.js';
import { searchFacilities } from './data/searchFacilities.js';
import { state } from './state.js';
import { showRoleGate, isAdmin, isManagedFacility, getActiveFacilityManager } from './auth/roleGate.js';
import { initSidebar } from './ui/sidebar.js';
import {
  initFilters,
  reloadFilters,
  getActiveFilters,
  hasActiveFiltersOrSearch,
  updateFilterResultsMeta,
  applyFilterSnapshot,
  getViewPreferencesSnapshot,
  applySearchQuery,
} from './ui/filters.js';
import {
  getManagerPreferenceKey,
  loadManagerPreferences,
  saveCurrentManagerPreferences,
} from './data/managerPreferences.js';
import { renderCards } from './ui/cards.js';
import { openPopup, closePopup } from './ui/popup.js';
import { initFacilityForm, openEditForm, refreshFacilityFormOptions } from './ui/facilityForm.js';
import { initAdminToolbar, updateRoleUi } from './ui/adminToolbar.js';
import { showMarkerActionMenu } from './ui/markerActions.js';
import { initSettingsPanel } from './ui/settingsPanel.js';
import { initMessagesPanel, updateMessagesBadge } from './ui/messagesPanel.js';
import { loadMapRegionLayout, resolveAreaFromLat } from './data/mapRegionLayout.js';
import { saveFacilities } from './data/storage.js';
import {
  initDataStore,
  isApiAvailable,
  startDataPolling,
  flushPendingSaves,
} from './data/dataStore.js';
import { ensureFeatureIds } from './data/loadFacilities.js';

/** @type {number} */
let cardPopupTimer = 0;
/** @type {number} */
let savePreferencesTimer = 0;
const CARD_POPUP_DELAY_MS = 2800;
const SAVE_PREFERENCES_DELAY_MS = 300;

async function init() {
  createMap('map');
  initSidebar({ onSearch: onViewPreferencesChanged });
  initFilters({ onChange: onViewPreferencesChanged });
  initFacilityForm({
    onSaved: (meta) => {
      refreshView();
      if (meta?.isNew && meta.id) {
        // Wait a frame so markers exist in the DOM after refresh
        requestAnimationFrame(() => {
          highlightFacilityOnMap(meta.id);
        });
      }
    },
  });
  initSettingsPanel({
    onCatalogsChanged: () => {
      refreshFacilityFormOptions();
      reloadFilters();
      refreshView();
    },
  });
  initMessagesPanel();
  initAdminToolbar();

  await initDataStore();

  try {
    state.facilitiesData = await loadFacilities();
    syncFacilityAreasFromLayout();
  } catch (error) {
    console.error(error);
  }

  startDataPolling({
    onFacilitiesUpdate: (data) => {
      state.facilitiesData = ensureFeatureIds(data, { persistIfMigrated: false });
      refreshView();
    },
    onReportsUpdate: () => {
      updateMessagesBadge();
    },
  });

  if (!isApiAvailable()) {
    console.info(
      'Local API unavailable — using browser storage. For multi-user LAN deployment, run: npm run start',
    );
  }

  window.addEventListener('beforeunload', () => {
    flushPendingSaves();
  });

  await startSession();
}

/**
 * Keep stored facility areas aligned with the configured latitude bands.
 */
function syncFacilityAreasFromLayout() {
  if (!state.facilitiesData?.features) return;

  const layout = loadMapRegionLayout();
  let changed = false;

  for (const feature of state.facilitiesData.features) {
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat)) continue;
    const area = resolveAreaFromLat(lat, layout);
    if (feature.properties?.areaInTheCountry !== area) {
      feature.properties.areaInTheCountry = area;
      changed = true;
    }
  }

  if (changed) saveFacilities(state.facilitiesData);
}

function onViewPreferencesChanged() {
  scheduleSaveViewPreferences();
  refreshView();
}

function scheduleSaveViewPreferences() {
  window.clearTimeout(savePreferencesTimer);
  savePreferencesTimer = window.setTimeout(() => {
    const snapshot = getViewPreferencesSnapshot();
    saveCurrentManagerPreferences(snapshot);
  }, SAVE_PREFERENCES_DELAY_MS);
}

function applySavedViewPreferences() {
  const prefs = loadManagerPreferences(getManagerPreferenceKey());
  if (!prefs) return;

  if (prefs.filters) {
    applyFilterSnapshot(prefs.filters);
  }

  if (typeof prefs.searchQuery === 'string') {
    applySearchQuery(prefs.searchQuery);
  }
}

async function startSession() {
  const shell = document.getElementById('appShell');
  shell.classList.remove('is-ready');

  await showRoleGate();

  applySavedViewPreferences();
  updateRoleUi();
  refreshView();

  requestAnimationFrame(() => {
    shell.classList.add('is-ready');
    state.map?.invalidateSize();
  });
}

function refreshView() {
  if (!state.facilitiesData) return;

  const filtered = filterFacilities(state.facilitiesData, getActiveFilters());
  const visible = searchFacilities(filtered, state.searchQuery);

  // Facility managers only see their assigned facilities in the sidebar list
  const listFeatures = getActiveFacilityManager()
    ? visible.filter((feature) => isManagedFacility(feature.properties?.id))
    : visible;

  const totalForRole = getActiveFacilityManager()
    ? (state.facilitiesData.features ?? []).filter((feature) =>
        isManagedFacility(feature.properties?.id),
      ).length
    : (state.facilitiesData.features ?? []).length;

  updateFilterResultsMeta(listFeatures.length, totalForRole);
  renderCards(
    document.getElementById('cards'),
    listFeatures,
    onCardClick,
    refreshView,
  );

  const visibleNames = hasActiveFiltersOrSearch()
    ? new Set(visible.map((f) => f.properties.nameOfFacility))
    : null;

  addMarkers(state.facilitiesData, onMarkerClick, visibleNames);
}

/**
 * Sidebar card: zoom to facility first, then open details after a short pause.
 * @param {GeoJSON.Feature} feature
 */
function onCardClick(feature) {
  closePopup();
  window.clearTimeout(cardPopupTimer);
  focusFacilityOnMap(feature);

  cardPopupTimer = window.setTimeout(() => {
    cardPopupTimer = 0;
    openPopup(feature);
  }, CARD_POPUP_DELAY_MS);
}

function onMarkerClick(feature, layer) {
  window.clearTimeout(cardPopupTimer);
  cardPopupTimer = 0;

  if (isAdmin() && isManagedFacility(feature.properties?.id)) {
    showMarkerActionMenu(feature, layer, {
      onView: openPopup,
      onEdit: openEditForm,
    });
    return;
  }
  openPopup(feature);
}

document.addEventListener('DOMContentLoaded', init);
