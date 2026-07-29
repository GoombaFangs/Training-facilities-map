import {
  FACILITY_TYPES,
  AREAS,
  getFacilityTypeByInputId,
  getAreaByInputId,
} from '../config/constants.js';
import { state } from '../state.js';

/**
 * @param {{
 *   onChange: () => void
 * }} options
 */
export function initFilters({ onChange }) {
  renderFilterOptions();
  bindFilterToggles();
  bindCheckboxes(onChange);
}

function renderFilterOptions() {
  const typeContainer = document.getElementById('filterOptionsType');
  const areaContainer = document.getElementById('filterOptionsArea');

  typeContainer.innerHTML = FACILITY_TYPES.map(
    (t) => `
      <span>
        <input id="${t.inputId}" type="checkbox" data-filter-kind="type" />
        <p>${t.label}</p>
      </span>
    `,
  ).join('');

  areaContainer.innerHTML = AREAS.map(
    (a) => `
      <span>
        <input id="${a.inputId}" type="checkbox" data-filter-kind="area" />
        <p>${a.label}</p>
      </span>
    `,
  ).join('');
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

function bindCheckboxes(onChange) {
  document
    .querySelectorAll('#filterOptionsType input[type="checkbox"], #filterOptionsArea input[type="checkbox"]')
    .forEach((input) => {
      input.addEventListener('change', (event) => {
        handleCheckboxChange(event.target, onChange);
      });
    });
}

function handleCheckboxChange(input, onChange) {
  const typeMeta = getFacilityTypeByInputId(input.id);
  const areaMeta = getAreaByInputId(input.id);

  if (input.checked) {
    if (typeMeta) {
      if (!state.filterTypes.includes(typeMeta.value)) {
        state.filterTypes.push(typeMeta.value);
      }
      addFilterTag(input.id, typeMeta.label, onChange);
    } else if (areaMeta) {
      if (!state.filterAreas.includes(areaMeta.value)) {
        state.filterAreas.push(areaMeta.value);
      }
      addFilterTag(input.id, areaMeta.label, onChange);
    }
  } else {
    removeFilterTag(input.id, onChange);
  }

  onChange();
}

function addFilterTag(inputId, label, onChange) {
  const tagId = `${inputId.slice(0, -5)}Tag`;
  if (document.getElementById(tagId)) return;

  const tags = document.getElementById('filterTags');
  const tag = document.createElement('span');
  tag.className = 'filterTag';
  tag.id = tagId;

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

function removeFilterTag(inputId, onChange) {
  const tagId = `${inputId.slice(0, -5)}Tag`;
  document.getElementById(tagId)?.remove();

  const checkbox = document.getElementById(inputId);
  if (checkbox) checkbox.checked = false;

  const typeMeta = getFacilityTypeByInputId(inputId);
  const areaMeta = getAreaByInputId(inputId);

  if (typeMeta) {
    state.filterTypes = state.filterTypes.filter((v) => v !== typeMeta.value);
  } else if (areaMeta) {
    state.filterAreas = state.filterAreas.filter((v) => v !== areaMeta.value);
  }
}

export function updateFilterTagsMargin() {
  const tags = document.getElementById('filterTags');
  const hasFilters =
    state.filterTypes.length > 0 || state.filterAreas.length > 0;
  tags.style.marginTop = hasFilters ? '2vh' : '0';
}
