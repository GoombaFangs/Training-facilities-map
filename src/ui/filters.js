import { getCatalogList, getFacilityTypeCssClass, getStatusCssClass } from '../data/optionCatalogs.js';
import { AREAS } from '../config/constants.js';
import { state } from '../state.js';

/** @type {(() => void) | null} */
let filtersOnChange = null;
let filtersUiBound = false;

/** @typedef {'types' | 'areas' | 'statuses' | 'trainingTypes' | 'trainingFrames' | 'trainingOptions'} FilterKind */

/** @type {{ kind: FilterKind, stateKey: keyof typeof state, catalog?: string, fixedValues?: string[], label: string, containerId: string }[]} */
const FILTER_SECTIONS = [
  {
    kind: 'statuses',
    stateKey: 'filterStatuses',
    catalog: 'statuses',
    label: 'סטטוס',
    containerId: 'filterChipsStatuses',
  },
  {
    kind: 'areas',
    stateKey: 'filterAreas',
    fixedValues: AREAS.map((a) => a.value),
    label: 'אזור בארץ',
    containerId: 'filterChipsAreas',
  },
  {
    kind: 'types',
    stateKey: 'filterTypes',
    catalog: 'facilityTypes',
    label: 'סוג מתקן',
    containerId: 'filterChipsTypes',
  },
  {
    kind: 'trainingTypes',
    stateKey: 'filterTrainingTypes',
    catalog: 'trainingTypes',
    label: 'סוג אימון',
    containerId: 'filterChipsTrainingTypes',
  },
  {
    kind: 'trainingFrames',
    stateKey: 'filterTrainingFrames',
    catalog: 'trainingFrames',
    label: 'מסגרת מתאמנת',
    containerId: 'filterChipsTrainingFrames',
  },
  {
    kind: 'trainingOptions',
    stateKey: 'filterTrainingOptions',
    catalog: 'trainingOptions',
    label: 'סוגי אימון',
    containerId: 'filterChipsTrainingOptions',
  },
];

/**
 * @param {{ onChange: () => void }} options
 */
export function initFilters({ onChange }) {
  filtersOnChange = onChange;
  renderAllFilterSections();
  if (!filtersUiBound) {
    bindFilterUi();
    filtersUiBound = true;
  }
  syncFilterPanelOpen();
  renderActiveFilterTags();
  updateFilterChrome();
}

/** Rebuild filter chips from catalogs while preserving valid selections. */
export function reloadFilters() {
  const snapshot = snapshotFilters();
  clearFilterState();
  renderAllFilterSections();

  for (const section of FILTER_SECTIONS) {
    const previous = snapshot[section.stateKey] ?? [];
    previous.forEach((value) => {
      const input = document.querySelector(
        `#${section.containerId} input[data-filter-value="${cssEscape(value)}"]`,
      );
      if (input instanceof HTMLInputElement) {
        input.checked = true;
        toggleFilterValue(section.kind, value, true, false);
      }
    });
  }

  renderActiveFilterTags();
  updateFilterChrome();
}

/**
 * @returns {{
 *   types: string[],
 *   areas: string[],
 *   statuses: string[],
 *   trainingTypes: string[],
 *   trainingFrames: string[],
 *   trainingOptions: string[],
 * }}
 */
export function getActiveFilters() {
  return {
    types: [...state.filterTypes],
    areas: [...state.filterAreas],
    statuses: [...state.filterStatuses],
    trainingTypes: [...state.filterTrainingTypes],
    trainingFrames: [...state.filterTrainingFrames],
    trainingOptions: [...state.filterTrainingOptions],
  };
}

export function getActiveFilterCount() {
  return FILTER_SECTIONS.reduce(
    (sum, section) => sum + (/** @type {string[]} */ (state[section.stateKey])?.length ?? 0),
    0,
  );
}

export function hasActiveFiltersOrSearch() {
  return getActiveFilterCount() > 0 || state.searchQuery.trim().length > 0;
}

/**
 * Update results line under the toolbar.
 * @param {number} shown
 * @param {number} total
 */
export function updateFilterResultsMeta(shown, total) {
  const el = document.getElementById('filterResultsMeta');
  if (!el) return;

  if (shown === total && !hasActiveFiltersOrSearch()) {
    el.textContent = total === 0 ? 'אין מתקנים במערכת' : `${total} מתקנים`;
    return;
  }

  el.textContent = `מציג ${shown} מתוך ${total}`;
}

/** @deprecated kept for callers that still import the old name */
export function updateFilterTagsMargin() {
  updateFilterChrome();
}

function bindFilterUi() {
  document.getElementById('filterPanelToggle')?.addEventListener('click', () => {
    state.isFilterPanelOpen = !state.isFilterPanelOpen;
    syncFilterPanelOpen();
  });

  document.getElementById('filterClearAll')?.addEventListener('click', () => {
    clearAllFilters();
    filtersOnChange?.();
  });

  document.getElementById('filterPanelClose')?.addEventListener('click', () => {
    state.isFilterPanelOpen = false;
    syncFilterPanelOpen();
  });

  const searchInput = document.getElementById('search');
  const searchClear = document.getElementById('searchClear');
  searchInput?.addEventListener('input', () => {
    syncSearchClearButton();
  });
  searchClear?.addEventListener('click', () => {
    if (!(searchInput instanceof HTMLInputElement)) return;
    searchInput.value = '';
    state.searchQuery = '';
    syncSearchClearButton();
    searchInput.focus();
    filtersOnChange?.();
  });

  document.querySelectorAll('[data-filter-section-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.filterSection');
      if (!section) return;
      const open = section.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  syncSearchClearButton();
}

function syncFilterPanelOpen() {
  const panel = document.getElementById('filterPanel');
  const toggle = document.getElementById('filterPanelToggle');
  const open = state.isFilterPanelOpen;
  if (panel) panel.hidden = !open;
  if (toggle) {
    toggle.classList.toggle('is-active', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

function syncSearchClearButton() {
  const searchInput = document.getElementById('search');
  const searchClear = document.getElementById('searchClear');
  if (!(searchInput instanceof HTMLInputElement) || !searchClear) return;
  searchClear.hidden = searchInput.value.trim().length === 0;
}

function renderAllFilterSections() {
  for (const section of FILTER_SECTIONS) {
    renderSectionChips(section);
  }
}

/**
 * @param {(typeof FILTER_SECTIONS)[number]} section
 */
function renderSectionChips(section) {
  const container = document.getElementById(section.containerId);
  if (!container) return;

  const values = section.fixedValues
    ? [...section.fixedValues]
    : getCatalogList(/** @type {any} */ (section.catalog));
  container.innerHTML = values
    .map((value, index) => {
      const id = `filter_${section.kind}_${index}`;
      const extraClass =
        section.kind === 'types'
          ? getFacilityTypeCssClass(value)
          : section.kind === 'statuses'
            ? getStatusCssClass(value)
            : '';

      return `
        <label class="filterChip ${extraClass}" for="${id}">
          <input
            id="${id}"
            type="checkbox"
            data-filter-kind="${section.kind}"
            data-filter-value="${escapeAttr(value)}"
          />
          <span>${escapeHtml(value)}</span>
        </label>
      `;
    })
    .join('');

  container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!(input instanceof HTMLInputElement)) return;
      const kind = /** @type {FilterKind} */ (input.dataset.filterKind);
      const value = input.dataset.filterValue ?? '';
      if (!kind || !value) return;
      toggleFilterValue(kind, value, input.checked, true);
    });
  });
}

/**
 * @param {FilterKind} kind
 * @param {string} value
 * @param {boolean} selected
 * @param {boolean} emitChange
 */
function toggleFilterValue(kind, value, selected, emitChange) {
  const section = FILTER_SECTIONS.find((item) => item.kind === kind);
  if (!section) return;

  /** @type {string[]} */
  const list = /** @type {string[]} */ (state[section.stateKey]);
  if (selected) {
    if (!list.includes(value)) list.push(value);
  } else {
    state[section.stateKey] = list.filter((item) => item !== value);
  }

  renderActiveFilterTags();
  updateFilterChrome();
  if (emitChange) filtersOnChange?.();
}

function renderActiveFilterTags() {
  const tags = document.getElementById('filterTags');
  if (!tags) return;

  /** @type {{ kind: FilterKind, value: string, label: string }[]} */
  const items = [];
  for (const section of FILTER_SECTIONS) {
    for (const value of /** @type {string[]} */ (state[section.stateKey])) {
      items.push({ kind: section.kind, value, label: `${section.label}: ${value}` });
    }
  }

  tags.innerHTML = items
    .map(
      (item) => `
      <button
        type="button"
        class="filterTag"
        data-filter-kind="${item.kind}"
        data-filter-value="${escapeAttr(item.value)}"
        title="הסר סינון"
      >
        <span class="tagText">${escapeHtml(item.label)}</span>
        <span class="tagClose" aria-hidden="true">&times;</span>
      </button>
    `,
    )
    .join('');

  tags.querySelectorAll('.filterTag').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = /** @type {FilterKind} */ (btn.dataset.filterKind);
      const value = btn.dataset.filterValue ?? '';
      if (!kind || !value) return;

      const input = document.querySelector(
        `input[data-filter-kind="${kind}"][data-filter-value="${cssEscape(value)}"]`,
      );
      if (input instanceof HTMLInputElement) input.checked = false;
      toggleFilterValue(kind, value, false, true);
    });
  });
}

function updateFilterChrome() {
  const count = getActiveFilterCount();
  const badge = document.getElementById('filterCountBadge');
  const activeBar = document.getElementById('filterActiveBar');
  const clearBtn = document.getElementById('filterClearAll');

  if (badge) {
    badge.hidden = count === 0;
    badge.textContent = String(count);
  }
  if (activeBar) activeBar.hidden = count === 0;
  if (clearBtn) clearBtn.hidden = count === 0;
}

function clearAllFilters() {
  clearFilterState();
  document
    .querySelectorAll('#filterPanel input[type="checkbox"]')
    .forEach((input) => {
      if (input instanceof HTMLInputElement) input.checked = false;
    });
  renderActiveFilterTags();
  updateFilterChrome();
}

function clearFilterState() {
  state.filterTypes = [];
  state.filterAreas = [];
  state.filterStatuses = [];
  state.filterTrainingTypes = [];
  state.filterTrainingFrames = [];
  state.filterTrainingOptions = [];
}

function snapshotFilters() {
  return {
    filterTypes: [...state.filterTypes],
    filterAreas: [...state.filterAreas],
    filterStatuses: [...state.filterStatuses],
    filterTrainingTypes: [...state.filterTrainingTypes],
    filterTrainingFrames: [...state.filterTrainingFrames],
    filterTrainingOptions: [...state.filterTrainingOptions],
  };
}

/**
 * @param {string} value
 */
function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * @param {string} value
 */
function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}
