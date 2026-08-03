import { getCatalogList, getFacilityTypeCssClass } from '../data/optionCatalogs.js';
import { state } from '../state.js';

/** @type {(() => void) | null} */
let filtersOnChange = null;
let filterTogglesBound = false;

/**
 * @param {{
 *   onChange: () => void
 * }} options
 */
export function initFilters({ onChange }) {
  filtersOnChange = onChange;
  renderFilterOptions();
  if (!filterTogglesBound) {
    bindFilterToggles();
    filterTogglesBound = true;
  }
  bindCheckboxes(onChange);
}

/** Rebuild filter checkboxes from the current option catalogs. */
export function reloadFilters() {
  const previousTypes = [...state.filterTypes];
  const previousAreas = [...state.filterAreas];

  document.getElementById('filterTags').innerHTML = '';
  state.filterTypes = [];
  state.filterAreas = [];

  renderFilterOptions();
  bindCheckboxes(filtersOnChange ?? (() => {}));

  const noop = () => {};
  previousTypes.forEach((value) => {
    const input = document.querySelector(
      `#filterOptionsType input[data-filter-value="${cssEscape(value)}"]`,
    );
    if (input instanceof HTMLInputElement) {
      input.checked = true;
      handleCheckboxChange(input, noop);
    }
  });
  previousAreas.forEach((value) => {
    const input = document.querySelector(
      `#filterOptionsArea input[data-filter-value="${cssEscape(value)}"]`,
    );
    if (input instanceof HTMLInputElement) {
      input.checked = true;
      handleCheckboxChange(input, noop);
    }
  });

  updateFilterTagsMargin();
}

function renderFilterOptions() {
  const typeContainer = document.getElementById('filterOptionsType');
  const areaContainer = document.getElementById('filterOptionsArea');

  const types = getCatalogList('facilityTypes');
  const areas = getCatalogList('areas');

  typeContainer.innerHTML = types
    .map((value, index) => {
      const id = `filterType_${index}`;
      const cssClass = getFacilityTypeCssClass(value);
      return `
      <span>
        <input
          id="${id}"
          type="checkbox"
          data-filter-kind="type"
          data-filter-value="${escapeAttr(value)}"
        />
        <p class="${cssClass}">${escapeHtml(value)}</p>
      </span>
    `;
    })
    .join('');

  areaContainer.innerHTML = areas
    .map((value, index) => {
      const id = `filterArea_${index}`;
      return `
      <span>
        <input
          id="${id}"
          type="checkbox"
          data-filter-kind="area"
          data-filter-value="${escapeAttr(value)}"
        />
        <p>${escapeHtml(value)}</p>
      </span>
    `;
    })
    .join('');
}

function bindFilterToggles() {
  document.querySelectorAll('.filteringHeader').forEach((header) => {
    header.addEventListener('click', () => {
      const isType = header.id === 'filterTypeHeader';
      toggleFilterPanel(isType ? 'type' : 'area');
    });
  });
}

function toggleFilterPanel(kind) {
  const isType = kind === 'type';
  const filterId = isType ? 'filterType' : 'filterArea';
  const optionsId = isType ? 'filterOptionsType' : 'filterOptionsArea';
  const iconId = isType ? 'filterTypeIcon' : 'filterAreaIcon';
  const openKey = isType ? 'isFilterTypeOpen' : 'isFilterAreaOpen';

  state[openKey] = !state[openKey];
  const open = state[openKey];

  document.getElementById(filterId).classList.toggle('is-open', open);
  document.getElementById(optionsId).style.display = open ? 'flex' : 'none';
  document.getElementById(iconId).style.backgroundColor = open
    ? '#06838b'
    : '#015497';
}

/**
 * @param {() => void} onChange
 */
function bindCheckboxes(onChange) {
  document
    .querySelectorAll(
      '#filterOptionsType input[type="checkbox"], #filterOptionsArea input[type="checkbox"]',
    )
    .forEach((input) => {
      input.addEventListener('change', (event) => {
        handleCheckboxChange(event.target, onChange);
      });
    });
}

/**
 * @param {HTMLInputElement} input
 * @param {() => void} onChange
 */
function handleCheckboxChange(input, onChange) {
  const kind = input.dataset.filterKind;
  const value = input.dataset.filterValue ?? '';
  if (!value) return;

  if (input.checked) {
    if (kind === 'type') {
      if (!state.filterTypes.includes(value)) state.filterTypes.push(value);
    } else if (kind === 'area') {
      if (!state.filterAreas.includes(value)) state.filterAreas.push(value);
    }
    addFilterTag(input.id, value, kind, onChange);
  } else {
    removeFilterTag(input.id, onChange);
  }

  onChange();
}

/**
 * @param {string} inputId
 * @param {string} label
 * @param {string} kind
 * @param {() => void} onChange
 */
function addFilterTag(inputId, label, kind, onChange) {
  const tagId = `${inputId}Tag`;
  if (document.getElementById(tagId)) return;

  const tags = document.getElementById('filterTags');
  const tag = document.createElement('span');
  tag.className = 'filterTag';
  tag.id = tagId;
  tag.dataset.filterKind = kind;
  tag.dataset.filterValue = label;

  const close = document.createElement('p');
  close.className = 'tagClose';
  close.innerHTML = '&times;';
  close.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFilterTag(inputId, onChange);
    onChange();
  });

  const text = document.createElement('p');
  text.className = 'tagText';
  text.textContent = label;

  tag.appendChild(close);
  tag.appendChild(text);
  tags.appendChild(tag);
}

/**
 * @param {string} inputId
 * @param {() => void} onChange
 */
function removeFilterTag(inputId, onChange) {
  const tag = document.getElementById(`${inputId}Tag`);
  const kind = tag?.dataset.filterKind;
  const value = tag?.dataset.filterValue;
  tag?.remove();

  const checkbox = document.getElementById(inputId);
  if (checkbox) checkbox.checked = false;

  if (kind === 'type' && value) {
    state.filterTypes = state.filterTypes.filter((v) => v !== value);
  } else if (kind === 'area' && value) {
    state.filterAreas = state.filterAreas.filter((v) => v !== value);
  }
}

export function updateFilterTagsMargin() {
  const tags = document.getElementById('filterTags');
  const hasFilters =
    state.filterTypes.length > 0 || state.filterAreas.length > 0;
  tags.style.marginTop = hasFilters ? '2vh' : '0';
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
