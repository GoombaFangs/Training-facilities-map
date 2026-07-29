import 'leaflet/dist/leaflet.css';
import './styles/main.css';

import { createMap } from './map/createMap.js';
import { addMarkers } from './map/markers.js';
import { loadFacilities } from './data/loadFacilities.js';
import { filterFacilities } from './data/filterFacilities.js';
import { searchFacilities } from './data/searchFacilities.js';
import { state } from './state.js';
import { showRoleGate, isAdmin } from './auth/roleGate.js';
import { initSidebar } from './ui/sidebar.js';
import { initFilters, updateFilterTagsMargin } from './ui/filters.js';
import { renderCards } from './ui/cards.js';
import { openPopup } from './ui/popup.js';
import { initFacilityForm, openEditForm } from './ui/facilityForm.js';
import { initAdminToolbar, updateRoleUi } from './ui/adminToolbar.js';
import { showMarkerActionMenu } from './ui/markerActions.js';

async function init() {
  createMap('map');
  initSidebar({ onSearch: refreshView });
  initFilters({ onChange: refreshView });
  initFacilityForm({ onSaved: refreshView });
  initAdminToolbar();

  try {
    state.facilitiesData = await loadFacilities();
  } catch (error) {
    console.error(error);
  }

  await startSession();
}

async function startSession() {
  const shell = document.getElementById('appShell');
  shell.classList.remove('is-ready');

  await showRoleGate();

  updateRoleUi();
  refreshView();

  requestAnimationFrame(() => {
    shell.classList.add('is-ready');
    state.map?.invalidateSize();
  });
}

function refreshView() {
  if (!state.facilitiesData) return;

  const filtered = filterFacilities(
    state.facilitiesData,
    state.filterTypes,
    state.filterAreas,
  );
  const visible = searchFacilities(filtered, state.searchQuery);

  updateFilterTagsMargin();
  renderCards(
    document.getElementById('cards'),
    visible,
    openPopup,
    refreshView,
  );

  const hasActiveFilters =
    state.filterTypes.length > 0 ||
    state.filterAreas.length > 0 ||
    state.searchQuery.trim().length > 0;

  const visibleNames = hasActiveFilters
    ? new Set(visible.map((f) => f.properties.nameOfFacility))
    : null;

  addMarkers(state.facilitiesData, onMarkerClick, visibleNames);
}

function onMarkerClick(feature, layer) {
  if (isAdmin()) {
    showMarkerActionMenu(feature, layer, {
      onView: openPopup,
      onEdit: openEditForm,
    });
    return;
  }
  openPopup(feature);
}

document.addEventListener('DOMContentLoaded', init);
