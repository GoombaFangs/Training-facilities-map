import L from 'leaflet';
import {
  FACILITY_STATUSES,
} from '../config/constants.js';
import {
  getCatalogList,
  appendToOptionCatalogs,
} from '../data/optionCatalogs.js';
import { resolveAreaFromLat } from '../data/mapRegionLayout.js';
import { state } from '../state.js';
import { isAdmin, isManagedFacility, getActiveFacilityManager } from '../auth/roleGate.js';
import {
  addFacility,
  updateFacility,
  buildFeatureFromForm,
} from '../data/loadFacilities.js';
import { addFacilityChangeReport } from '../data/managerReports.js';
import { describeFacilityChanges } from '../data/facilityDiff.js';
import { closePopup } from './popup.js';
import {
  hasOpenMarkerMenu,
  closeMarkerActionMenu,
  consumeMapCreateSuppression,
} from './markerActions.js';
import { syncMapPinCursor, registerPinCursorContext } from './pinCursor.js';
import { isPointInIsrael } from '../data/israelBoundary.js';

const OTHER_VALUE = '__other__';
const OTHER_LABEL = 'אחר';
const MAX_UPLOAD_IMAGES = 8;
const MAX_IMAGE_EDGE = 1280;
const IMAGE_JPEG_QUALITY = 0.72;

let onSaved = () => {};
let editingId = null;
let mapClickHandler = null;
let adminMapCreateBound = false;
/** True while the wizard is hidden so the user can pick a point on the map. */
let pickingFromForm = false;
let pickEscapeHandler = null;
let currentStep = 1;
const TOTAL_STEPS = 3;
/**
 * Shared image gallery for step 3 — each image is assigned to a facility.
 * @type {{ src: string, facilityLocalId: string }[]}
 */
let uploadedImages = [];
let saveCustomsResetTimer = 0;
let isPinDropping = false;
let imageUploadBound = false;
let isClosingForm = false;
let formCloseTimer = 0;

/**
 * @typedef {{
 *   localId: string,
 *   name: string,
 *   statusOfFacility: string,
 *   locationOfFacility: string,
 *   typeOfFacility: string,
 *   specificTypeOfFacility: string,
 *   trainingFrame: string,
 *   trainingOptions: string[],
 *   contactName: string,
 *   contactRank: string,
 *   contactPhone: string,
 *   comments: string,
 *   imgArr: string[],
 * }} FacilityDraft
 */

/** @type {FacilityDraft[]} */
let draftFacilities = [];
let activeFacilityIndex = 0;
let facilityDraftSeq = 1;

/**
 * @param {{ onSaved: (meta?: { id: string, isNew: boolean }) => void }} options
 */
export function initFacilityForm({ onSaved: savedCb }) {
  onSaved = savedCb;

  registerPinCursorContext(() => ({
    isPinDropping,
    mapClickActive: Boolean(mapClickHandler) || pickingFromForm,
    adminMapCreateBound,
  }));

  document.getElementById('facilityFormCancel').addEventListener('click', closeForm);
  document.getElementById('facilityFormBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'facilityFormBackdrop') closeForm();
  });
  document.getElementById('facilityForm').addEventListener('submit', onSubmit);
  document.getElementById('pickOnMapBtn').addEventListener('click', startPickOnMap);
  document.getElementById('wizardNext').addEventListener('click', goNext);
  document.getElementById('wizardBack').addEventListener('click', goBack);
  document.getElementById('wizardSaveCustoms').addEventListener('click', onSaveCustomValues);
  document.getElementById('addFacilityToWaypointBtn')?.addEventListener('click', () => {
    syncFacilityListFromDom();
    draftFacilities.push(createEmptyFacilityDraft());
    renderWaypointFacilitiesList();
  });
  bindCoordinateInputs();

  document.querySelectorAll('select[data-other-for]').forEach((select) => {
    select.addEventListener('change', () => syncOtherInput(select));
  });

  document.querySelectorAll('.wizardStep').forEach((stepBtn) => {
    stepBtn.addEventListener('click', () => {
      const target = Number(stepBtn.dataset.step);
      if (target === currentStep) return;
      if (target < currentStep || validateUpTo(target - 1)) {
        prepareLeaveStep(currentStep);
        goToStep(target);
      }
    });
  });

  refillAllOptionLists();
  bindImageUpload();
  document.getElementById('formFacilityName')?.addEventListener('input', () => {
    if (currentStep === 3) updateFacilityPhotosMeta();
  });
  renderUploadedImages();
}

export function openCreateForm(coords = null) {
  editingId = null;
  document.getElementById('facilityFormTitle').textContent = 'הוספת נקודת ציון';
  document.getElementById('wizardSave').textContent = 'צור נקודת ציון';
  resetFormFields();

  if (coords) {
    setCoordinateInput('formLat', coords.lat);
    setCoordinateInput('formLng', coords.lng);
  }

  showForm();
}

/**
 * @param {GeoJSON.Feature} feature
 */
export function openEditForm(feature) {
  if (!isManagedFacility(feature?.properties?.id)) return;

  const props = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;

  editingId = props.id;
  document.getElementById('facilityFormTitle').textContent = 'עריכת נקודת ציון';
  document.getElementById('wizardSave').textContent = 'עדכן נקודת ציון';

  refillAllOptionLists();

  document.getElementById('formName').value = props.nameOfFacility ?? '';
  document.getElementById('formUnit').value = props.unitOwningTheFacility ?? '';
  document.getElementById('formPhone').value = props.phoneOfFacility ?? '';
  document.getElementById('formContactName').value = props.contactNameOfFacility ?? '';
  document.getElementById('formContactRole').value = props.contactRoleOfFacility ?? '';
  setCoordinateInput('formLat', Number(lat));
  setCoordinateInput('formLng', Number(lng));

  draftFacilities = (props.TypesOfFacilities ?? []).map((entry, index) =>
    facilityEntryToDraft(entry, index, props),
  );
  if (draftFacilities.length === 0) {
    draftFacilities = [createEmptyFacilityDraft()];
  }
  activeFacilityIndex = 0;
  renderWaypointFacilitiesList();

  showForm();
}

function showForm() {
  closePopup();
  pickingFromForm = false;
  stopPickOnMap();
  clearError();
  goToStep(1);
  updateLocationStatus();
  const backdrop = document.getElementById('facilityFormBackdrop');
  window.clearTimeout(formCloseTimer);
  isClosingForm = false;
  backdrop.hidden = false;
  backdrop.classList.remove('is-opening', 'is-closing');
  void backdrop.offsetWidth;
  backdrop.classList.add('is-opening');
  updateAdminMapHint();
  syncMapPinCursor();
}

/**
 * @param {{ animate?: boolean }} [options]
 */
export function closeForm(options = {}) {
  const { animate = true } = options;
  const backdrop = document.getElementById('facilityFormBackdrop');
  if (!backdrop || backdrop.hidden) {
    // Form may be hidden while picking on the map — still clear pick mode
    if (pickingFromForm || mapClickHandler) {
      pickingFromForm = false;
      stopPickOnMap();
    }
    updateAdminMapHint();
    syncMapPinCursor();
    return;
  }
  if (isClosingForm) return;

  pickingFromForm = false;
  stopPickOnMap();
  clearError();
  resetSaveCustomsButton();

  if (!animate) {
    finishCloseForm(backdrop);
    return;
  }

  isClosingForm = true;
  backdrop.classList.remove('is-opening');
  backdrop.classList.add('is-closing');

  const form = backdrop.querySelector('.facilityForm');
  const finish = (event) => {
    if (event && event.target !== form) return;
    form?.removeEventListener('animationend', finish);
    window.clearTimeout(formCloseTimer);
    finishCloseForm(backdrop);
  };

  form?.addEventListener('animationend', finish);
  window.clearTimeout(formCloseTimer);
  formCloseTimer = window.setTimeout(() => finish(), 380);
}

/**
 * @param {HTMLElement} backdrop
 */
function finishCloseForm(backdrop) {
  isClosingForm = false;
  window.clearTimeout(formCloseTimer);
  formCloseTimer = 0;
  backdrop.hidden = true;
  backdrop.classList.remove('is-opening', 'is-closing');
  updateAdminMapHint();
  syncMapPinCursor();
}

function resetFormFields() {
  refillAllOptionLists();
  document.getElementById('facilityForm').reset();
  document.getElementById('formStatus').selectedIndex = 0;
  document.getElementById('formLocation').value = '';
  document.getElementById('formTrainingFrame').selectedIndex = 0;
  document.querySelectorAll('.otherInput').forEach((input) => {
    input.value = '';
    input.hidden = true;
  });
  refreshSpecificTypes();
  setSelectedTrainingOptions([]);
  setUploadedImages([]);
  draftFacilities = [createEmptyFacilityDraft()];
  activeFacilityIndex = 0;
  renderWaypointFacilitiesList();
  resetSaveCustomsButton();
}

/**
 * @param {string} [typeOfFacility]
 * @returns {FacilityDraft}
 */
function createEmptyFacilityDraft(typeOfFacility) {
  const types = getMergedFacilityTypes();
  const frames = getMergedTrainingFrames();
  const statuses = getMergedStatuses();
  const type = String(typeOfFacility || types[0] || '').trim();
  return {
    localId: `fac_${Date.now()}_${facilityDraftSeq++}`,
    name: '',
    statusOfFacility: statuses[0] || FACILITY_STATUSES[0]?.value || 'פעיל',
    locationOfFacility: '',
    typeOfFacility: type,
    specificTypeOfFacility: '',
    trainingFrame: frames[0] || '',
    trainingOptions: [],
    contactName: '',
    contactRank: '',
    contactPhone: '',
    comments: '',
    imgArr: [],
  };
}

/**
 * @param {FacilityDraft} facility
 * @param {number} index
 * @returns {string}
 */
function getFacilityDraftLabel(facility, index) {
  const name = String(facility?.name || '').trim();
  if (name) return name;
  const type = String(facility?.typeOfFacility || '').trim();
  if (type) return type;
  return `מתקן ${index + 1}`;
}

/**
 * @param {FacilityDraft} facility
 * @param {string} typeValue
 * @param {number} index
 */
function applyFacilityType(facility, typeValue) {
  facility.typeOfFacility = String(typeValue || '').trim();
}

/**
 * @param {object} entry
 * @param {number} index
 * @param {object} [waypointProps]
 * @returns {FacilityDraft}
 */
function facilityEntryToDraft(entry, index, waypointProps = {}) {
  const options = Array.isArray(entry?.trainingOptions)
    ? entry.trainingOptions.map((item) => String(item).trim()).filter(Boolean)
    : String(entry?.trainingOptions ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    localId: `fac_edit_${index}_${facilityDraftSeq++}`,
    name: String(entry?.name || '').trim(),
    statusOfFacility: String(
      entry?.statusOfFacility || waypointProps.statusOfFacility || FACILITY_STATUSES[0]?.value || 'פעיל',
    ),
    locationOfFacility: String(
      entry?.locationOfFacility || waypointProps.locationOfFacility || '',
    ),
    typeOfFacility: String(entry?.typeOfFacility || entry?.name || '').trim(),
    specificTypeOfFacility: String(entry?.specificTypeOfFacility ?? ''),
    trainingFrame: String(entry?.trainingFrame ?? ''),
    trainingOptions: options,
    contactName: String(entry?.contactName ?? ''),
    contactRank: String(entry?.contactRank ?? ''),
    contactPhone: String(entry?.contactPhone ?? ''),
    comments: String(entry?.comments ?? ''),
    imgArr: Array.isArray(entry?.imgArr) ? entry.imgArr.filter(Boolean) : [],
  };
}

/**
 * @param {string} selectedValue
 * @returns {string}
 */
function buildFacilityTypeOptionsHtml(selectedValue) {
  const types = getMergedFacilityTypes();
  const selected = String(selectedValue || '').trim();
  const known = selected !== '' && types.includes(selected);
  const options = types.map(
    (value) =>
      `<option value="${escapeAttr(value)}"${known && value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`,
  );
  const useOther = selected !== '' && !known;
  options.push(
    `<option value="${OTHER_VALUE}"${useOther ? ' selected' : ''}>${OTHER_LABEL}</option>`,
  );
  return options.join('');
}

function syncFacilityListFromDom() {
  const list = document.getElementById('waypointFacilitiesList');
  if (!list) return;
  list.querySelectorAll('.waypointFacilityItem').forEach((row) => {
    const index = Number(row.dataset.index);
    const select = row.querySelector('.waypointFacilityType');
    const other = row.querySelector('.waypointFacilityTypeOther');
    if (
      !Number.isInteger(index) ||
      !draftFacilities[index] ||
      !(select instanceof HTMLSelectElement)
    ) {
      return;
    }
    const value =
      select.value === OTHER_VALUE
        ? other instanceof HTMLInputElement
          ? other.value.trim()
          : ''
        : select.value;
    applyFacilityType(draftFacilities[index], value, index);
  });
}

function renderWaypointFacilitiesList() {
  const list = document.getElementById('waypointFacilitiesList');
  if (!list) return;

  list.innerHTML = draftFacilities
    .map((facility, index) => {
      const selected = String(facility.typeOfFacility || '').trim();
      const types = getMergedFacilityTypes();
      const isOther = selected !== '' && !types.includes(selected);
      return `
      <li class="waypointFacilityItem" data-index="${index}">
        <span class="waypointFacilityIndex">${index + 1}</span>
        <div class="waypointFacilityTypeWrap">
          <select
            class="waypointFacilityType"
            aria-label="סוג מתקן ${index + 1}"
          >${buildFacilityTypeOptionsHtml(selected)}</select>
          <input
            type="text"
            class="waypointFacilityTypeOther otherInput"
            value="${escapeAttr(isOther ? selected : '')}"
            placeholder="הזינו סוג מתקן אחר"
            aria-label="סוג מתקן אחר ${index + 1}"
            ${isOther ? '' : 'hidden'}
          />
        </div>
        <button
          type="button"
          class="waypointFacilityRemove"
          data-index="${index}"
          aria-label="הסר מתקן ${index + 1}"
          ${draftFacilities.length <= 1 ? 'disabled' : ''}
        >×</button>
      </li>
    `;
    })
    .join('');

  list.querySelectorAll('.waypointFacilityType').forEach((select) => {
    select.addEventListener('change', () => {
      const row = select.closest('.waypointFacilityItem');
      const index = Number(row?.dataset.index);
      if (!Number.isInteger(index) || !draftFacilities[index]) return;
      const other = row.querySelector('.waypointFacilityTypeOther');
      if (other instanceof HTMLInputElement) {
        const isOther = select.value === OTHER_VALUE;
        other.hidden = !isOther;
        if (isOther) {
          other.focus();
          applyFacilityType(draftFacilities[index], other.value.trim(), index);
        } else {
          other.value = '';
          applyFacilityType(draftFacilities[index], select.value, index);
        }
      } else {
        applyFacilityType(draftFacilities[index], select.value, index);
      }
    });
  });

  list.querySelectorAll('.waypointFacilityTypeOther').forEach((input) => {
    input.addEventListener('input', () => {
      const row = input.closest('.waypointFacilityItem');
      const index = Number(row?.dataset.index);
      if (!Number.isInteger(index) || !draftFacilities[index]) return;
      applyFacilityType(draftFacilities[index], input.value.trim(), index);
    });
  });

  list.querySelectorAll('.waypointFacilityRemove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.index);
      if (!Number.isInteger(index) || draftFacilities.length <= 1) return;
      syncFacilityListFromDom();
      draftFacilities.splice(index, 1);
      if (activeFacilityIndex >= draftFacilities.length) {
        activeFacilityIndex = draftFacilities.length - 1;
      }
      renderWaypointFacilitiesList();
    });
  });
}

function renderFacilityEditorTabs(containerId = 'facilityEditorTabs') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = draftFacilities
    .map(
      (facility, index) => `
      <button
        type="button"
        class="facilityEditorTab${index === activeFacilityIndex ? ' is-active' : ''}"
        data-index="${index}"
        role="tab"
        aria-selected="${index === activeFacilityIndex ? 'true' : 'false'}"
      >${escapeHtml(getFacilityDraftLabel(facility, index))}</button>
    `,
    )
    .join('');

  container.querySelectorAll('.facilityEditorTab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.index);
      if (!Number.isInteger(index) || index === activeFacilityIndex) return;
      if (currentStep === 3) saveFacilityEditorToDraft();
      activeFacilityIndex = index;
      if (currentStep === 3) {
        renderFacilityEditorTabs('facilityEditorTabs');
        loadFacilityEditorFromDraft();
        renderUploadedImages();
      }
    });
  });
}

function saveFacilityEditorToDraft() {
  const facility = draftFacilities[activeFacilityIndex];
  if (!facility) return;

  facility.name = document.getElementById('formFacilityName').value.trim();
  facility.statusOfFacility = document.getElementById('formStatus').value;
  facility.locationOfFacility = document.getElementById('formLocation').value.trim();
  facility.specificTypeOfFacility = getSelectOrOtherValue(
    document.getElementById('formSpecificType'),
  );
  facility.trainingFrame = getSelectOrOtherValue(
    document.getElementById('formTrainingFrame'),
  );
  facility.trainingOptions = getSelectedTrainingOptions();
  facility.contactName = document.getElementById('formFacilityContactName').value.trim();
  facility.contactRank = document.getElementById('formFacilityContactRank').value.trim();
  facility.contactPhone = document.getElementById('formFacilityContactPhone').value.trim();
  facility.comments = document.getElementById('formComments').value;
}

function loadFacilityEditorFromDraft() {
  const facility = draftFacilities[activeFacilityIndex];
  if (!facility) return;

  document.getElementById('formFacilityName').value = facility.name || '';
  document.getElementById('formStatus').value =
    facility.statusOfFacility || getMergedStatuses()[0] || FACILITY_STATUSES[0]?.value || 'פעיל';
  document.getElementById('formLocation').value = facility.locationOfFacility || '';
  refreshSpecificTypes(facility.specificTypeOfFacility);
  setSelectOrOther(document.getElementById('formTrainingFrame'), facility.trainingFrame);
  setSelectedTrainingOptions(facility.trainingOptions ?? []);
  document.getElementById('formFacilityContactName').value = facility.contactName ?? '';
  document.getElementById('formFacilityContactRank').value = facility.contactRank ?? '';
  document.getElementById('formFacilityContactPhone').value = facility.contactPhone ?? '';
  document.getElementById('formComments').value = facility.comments ?? '';
  renderUploadedImages();
}

/** Flatten draft facility images into the shared gallery. */
function loadImagesFromDraftFacilities() {
  const items = [];
  for (const facility of draftFacilities) {
    for (const src of facility.imgArr ?? []) {
      if (!src) continue;
      items.push({ src, facilityLocalId: facility.localId });
    }
  }
  uploadedImages = items;
  renderUploadedImages();
}

/** Write gallery images back into each draft facility's imgArr. */
function syncImagesToDraftFacilities() {
  const byFacility = new Map(draftFacilities.map((facility) => [facility.localId, []]));
  const fallbackId = draftFacilities[0]?.localId ?? '';

  for (const item of uploadedImages) {
    const key = byFacility.has(item.facilityLocalId) ? item.facilityLocalId : fallbackId;
    if (!key) continue;
    const list = byFacility.get(key);
    if (list.length >= MAX_UPLOAD_IMAGES) continue;
    list.push(item.src);
  }

  for (const facility of draftFacilities) {
    facility.imgArr = byFacility.get(facility.localId) ?? [];
  }
}

function getActiveFacilityLocalId() {
  return draftFacilities[activeFacilityIndex]?.localId ?? '';
}

function getActiveFacilityImageCount() {
  const activeId = getActiveFacilityLocalId();
  if (!activeId) return 0;
  return uploadedImages.filter((item) => item.facilityLocalId === activeId).length;
}

function updateFacilityPhotosMeta() {
  const meta = document.getElementById('formFacilityPhotosMeta');
  if (!meta) return;
  const facility = draftFacilities[activeFacilityIndex];
  if (!facility) {
    meta.textContent = '';
    return;
  }
  const inputName = document.getElementById('formFacilityName')?.value.trim();
  const label = inputName || getFacilityDraftLabel(facility, activeFacilityIndex);
  const count = getActiveFacilityImageCount();
  meta.textContent = `${label} · ${count}/${MAX_UPLOAD_IMAGES}`;
}

function getImageUploadLimit() {
  return MAX_UPLOAD_IMAGES;
}

/**
 * @param {number} step
 */
function prepareLeaveStep(step) {
  if (step === 2) syncFacilityListFromDom();
  if (step === 3) {
    saveFacilityEditorToDraft();
    syncImagesToDraftFacilities();
  }
}

function getMergedFacilityTypes() {
  return getCatalogList('facilityTypes');
}

function getMergedTrainingFrames() {
  return getCatalogList('trainingFrames');
}

function getMergedTrainingOptions() {
  return getCatalogList('trainingOptions');
}

function getMergedStatuses() {
  return getCatalogList('statuses');
}

/**
 * @param {string} [_facilityType]
 */
function getMergedSpecificTypes(_facilityType) {
  return getCatalogList('trainingTypes');
}

function refillAllOptionLists() {
  fillSelect(
    document.getElementById('formStatus'),
    getMergedStatuses(),
    false,
  );
  fillSelect(
    document.getElementById('formTrainingFrame'),
    getMergedTrainingFrames(),
    true,
  );
  renderTrainingOptionChips();
  refreshSpecificTypes();
}

/** Refresh form option lists from catalogs (used by settings panel). */
export function refreshFacilityFormOptions() {
  const backdrop = document.getElementById('facilityFormBackdrop');
  if (backdrop && !backdrop.hidden) {
    refreshOptionListsPreservingValues();
  } else {
    refillAllOptionLists();
  }
}

/**
 * Keep current form values while refreshing option lists after saving customs.
 */
function refreshOptionListsPreservingValues() {
  if (currentStep === 3) {
    saveFacilityEditorToDraft();
    syncImagesToDraftFacilities();
  }

  const snapshot = {
    name: document.getElementById('formName').value,
    unit: document.getElementById('formUnit').value,
    phone: document.getElementById('formPhone').value,
    contactName: document.getElementById('formContactName').value,
    contactRole: document.getElementById('formContactRole').value,
    lat: document.getElementById('formLat').value,
    lng: document.getElementById('formLng').value,
  };

  refillAllOptionLists();

  document.getElementById('formName').value = snapshot.name;
  document.getElementById('formUnit').value = snapshot.unit;
  document.getElementById('formPhone').value = snapshot.phone;
  document.getElementById('formContactName').value = snapshot.contactName;
  document.getElementById('formContactRole').value = snapshot.contactRole;
  document.getElementById('formLat').value = snapshot.lat;
  document.getElementById('formLng').value = snapshot.lng;

  if (currentStep === 2) {
    renderWaypointFacilitiesList();
  } else if (currentStep === 3) {
    loadFacilityEditorFromDraft();
    renderFacilityEditorTabs('facilityEditorTabs');
    loadImagesFromDraftFacilities();
  }
}

/**
 * @param {HTMLSelectElement} select
 * @param {string[]} values
 * @param {boolean} [withOther=false]
 */
function fillSelect(select, values, withOther = false) {
  const options = values.map(
    (value) => `<option value="${escapeAttr(value)}">${value}</option>`,
  );
  if (withOther) {
    options.push(`<option value="${OTHER_VALUE}">${OTHER_LABEL}</option>`);
  }
  select.innerHTML = options.join('');
}

/**
 * @param {HTMLSelectElement} select
 */
function syncOtherInput(select) {
  const otherId = select.dataset.otherFor;
  if (!otherId) return;
  const otherInput = document.getElementById(otherId);
  const isOther = select.value === OTHER_VALUE;
  otherInput.hidden = !isOther;
  if (isOther) {
    otherInput.focus();
  } else {
    otherInput.value = '';
  }
}

/**
 * @param {HTMLSelectElement} select
 * @param {string | undefined} value
 */
function setSelectOrOther(select, value) {
  const otherId = select.dataset.otherFor;
  const otherInput = otherId ? document.getElementById(otherId) : null;

  if (!value) {
    select.selectedIndex = 0;
    if (otherInput) {
      otherInput.value = '';
      otherInput.hidden = true;
    }
    return;
  }

  const exists = [...select.options].some(
    (opt) => opt.value === value && opt.value !== OTHER_VALUE,
  );

  if (exists) {
    select.value = value;
    if (otherInput) {
      otherInput.value = '';
      otherInput.hidden = true;
    }
  } else if (otherInput) {
    select.value = OTHER_VALUE;
    otherInput.value = value;
    otherInput.hidden = false;
  } else {
    select.selectedIndex = 0;
  }
}

/**
 * @param {HTMLSelectElement} select
 */
function getSelectOrOtherValue(select) {
  if (select.value !== OTHER_VALUE) return select.value;
  const otherId = select.dataset.otherFor;
  return document.getElementById(otherId)?.value.trim() ?? '';
}

function refreshSpecificTypes(preferredValue) {
  const facilityType = String(
    draftFacilities[activeFacilityIndex]?.typeOfFacility || '',
  ).trim();

  const specificSelect = document.getElementById('formSpecificType');
  const options = facilityType ? getMergedSpecificTypes(facilityType) : [];
  fillSelect(specificSelect, options.length ? options : ['כללי'], true);

  if (preferredValue !== undefined) {
    setSelectOrOther(specificSelect, preferredValue);
  } else {
    specificSelect.selectedIndex = 0;
    syncOtherInput(specificSelect);
  }
}

function renderTrainingOptionChips() {
  const container = document.getElementById('formTrainingOptions');
  const options = getMergedTrainingOptions();
  container.innerHTML =
    options
      .map(
        (option) => `
      <label class="choiceChip">
        <input type="checkbox" value="${escapeAttr(option)}" />
        <span>${option}</span>
      </label>
    `,
      )
      .join('') +
    `
    <label class="choiceChip choiceChipOther">
      <input type="checkbox" id="trainingOtherToggle" value="${OTHER_VALUE}" />
      <span>${OTHER_LABEL}</span>
    </label>
  `;

  document.getElementById('trainingOtherToggle').addEventListener('change', (event) => {
    const otherInput = document.getElementById('formTrainingOther');
    otherInput.hidden = !event.target.checked;
    if (event.target.checked) otherInput.focus();
    else otherInput.value = '';
  });
}

/**
 * @param {string[]} selected
 */
function setSelectedTrainingOptions(selected) {
  const cleaned = selected.map((s) => String(s).trim()).filter(Boolean);
  const known = new Set(getMergedTrainingOptions());
  const custom = cleaned.filter((value) => !known.has(value));
  const selectedSet = new Set(cleaned.filter((value) => known.has(value)));

  document.querySelectorAll('#formTrainingOptions input[type="checkbox"]').forEach((input) => {
    if (input.value === OTHER_VALUE) {
      input.checked = custom.length > 0;
      return;
    }
    input.checked = selectedSet.has(input.value);
  });

  const otherInput = document.getElementById('formTrainingOther');
  if (custom.length > 0) {
    otherInput.hidden = false;
    otherInput.value = custom.join(', ');
  } else {
    otherInput.hidden = true;
    otherInput.value = '';
  }
}

function getSelectedTrainingOptions() {
  const selected = [...document.querySelectorAll('#formTrainingOptions input:checked')]
    .map((input) => input.value)
    .filter((value) => value !== OTHER_VALUE);

  const otherToggle = document.getElementById('trainingOtherToggle');
  const otherText = document.getElementById('formTrainingOther').value.trim();
  if (otherToggle?.checked && otherText) {
    otherText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((value) => selected.push(value));
  }

  return selected;
}

function bindImageUpload() {
  if (imageUploadBound) return;
  imageUploadBound = true;

  const input = document.getElementById('formImgInput');
  const body = document.querySelector('.facilityPhotosBody');
  if (!input || !body) return;

  body.addEventListener('click', (event) => {
    const addTile = event.target.closest('.facilityPhotosAddTile');
    if (!addTile || addTile.disabled) return;
    if (getActiveFacilityImageCount() >= MAX_UPLOAD_IMAGES) {
      showError(`ניתן להעלות עד ${MAX_UPLOAD_IMAGES} תמונות למתקן`);
      return;
    }
    input.click();
  });

  input.addEventListener('change', async () => {
    const files = [...(input.files ?? [])];
    input.value = '';
    await addImageFiles(files);
  });

  body.addEventListener('dragenter', (event) => {
    if (!event.target.closest('.facilityPhotosAddTile, .facilityPhotosBody')) return;
    event.preventDefault();
    body.classList.add('is-dragover');
  });
  body.addEventListener('dragover', (event) => {
    event.preventDefault();
    body.classList.add('is-dragover');
  });
  body.addEventListener('dragleave', (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    body.classList.remove('is-dragover');
  });
  body.addEventListener('drop', async (event) => {
    event.preventDefault();
    body.classList.remove('is-dragover');
    const files = [...(event.dataTransfer?.files ?? [])].filter((file) =>
      file.type.startsWith('image/'),
    );
    await addImageFiles(files);
  });
}

/**
 * @param {File[]} files
 */
async function addImageFiles(files) {
  if (!files.length) return;
  clearError();

  const activeId = getActiveFacilityLocalId();
  if (!activeId) {
    showError('יש לבחור מתקן לפני העלאת תמונות');
    return;
  }

  const remaining = MAX_UPLOAD_IMAGES - getActiveFacilityImageCount();
  if (remaining <= 0) {
    showError(`ניתן להעלות עד ${MAX_UPLOAD_IMAGES} תמונות למתקן`);
    return;
  }

  const batch = files.slice(0, remaining);
  if (files.length > remaining) {
    showError(`נוספו ${batch.length} תמונות בלבד (מגבלה: ${MAX_UPLOAD_IMAGES} למתקן)`);
  }

  try {
    const dataUrls = await Promise.all(batch.map((file) => compressImageFile(file)));
    uploadedImages = [
      ...uploadedImages,
      ...dataUrls.map((src) => ({ src, facilityLocalId: activeId })),
    ];
    renderUploadedImages();
  } catch {
    showError('לא הצלחנו לקרוא את אחת התמונות. נסו קובץ אחר.');
  }
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image decode failed'));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * @param {{ src: string, facilityLocalId: string }[]} images
 */
function setUploadedImages(images) {
  uploadedImages = (images ?? [])
    .map((item) => {
      if (typeof item === 'string') {
        return {
          src: item,
          facilityLocalId: draftFacilities[0]?.localId || '',
        };
      }
      return {
        src: item.src,
        facilityLocalId: item.facilityLocalId || draftFacilities[0]?.localId || '',
      };
    })
    .filter((item) => item.src)
    .slice(0, getImageUploadLimit());
  renderUploadedImages();
}

function renderUploadedImages() {
  const picker = document.getElementById('formImgPicker');
  if (!picker) return;

  const activeId = getActiveFacilityLocalId();
  const visibleImages = uploadedImages
    .map((item, globalIndex) => ({ ...item, globalIndex }))
    .filter((item) => item.facilityLocalId === activeId);

  const canAddMore = visibleImages.length < MAX_UPLOAD_IMAGES;
  const isEmpty = visibleImages.length === 0;

  const thumbsHtml = visibleImages
    .map(
      (item, index) => `
      <div class="facilityPhotoItem" role="listitem" data-index="${item.globalIndex}">
        <div class="facilityPhotoThumb">
          <img src="${escapeAttr(item.src)}" alt="תמונה ${index + 1}" />
          <button
            type="button"
            class="facilityPhotoRemove"
            data-index="${item.globalIndex}"
            aria-label="הסר תמונה ${index + 1}"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `,
    )
    .join('');

  const addTileHtml = canAddMore
    ? `
      <button
        type="button"
        class="facilityPhotosAddTile${isEmpty ? ' is-empty' : ''}"
        aria-label="הוסף תמונות למתקן"
      >
        <span class="facilityPhotosAddIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
        </span>
        <span class="facilityPhotosAddLabel">${isEmpty ? 'הוסיפו תמונות' : 'הוסף'}</span>
      </button>
    `
    : '';

  picker.innerHTML = `${thumbsHtml}${addTileHtml}`;

  picker.querySelectorAll('.facilityPhotoRemove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.index);
      if (!Number.isInteger(index)) return;
      uploadedImages = uploadedImages.filter((_, i) => i !== index);
      clearError();
      renderUploadedImages();
    });
  });

  updateFacilityPhotosMeta();
}

function goNext() {
  if (!validateStep(currentStep)) return;
  prepareLeaveStep(currentStep);
  if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1);
}

function goBack() {
  prepareLeaveStep(currentStep);
  if (currentStep > 1) goToStep(currentStep - 1);
}

function goToStep(step) {
  currentStep = step;
  clearError();

  document.querySelectorAll('.wizardPanel').forEach((panel) => {
    panel.classList.toggle('is-active', Number(panel.dataset.panel) === step);
  });

  document.querySelectorAll('.wizardStep').forEach((btn) => {
    const btnStep = Number(btn.dataset.step);
    btn.classList.toggle('is-active', btnStep === step);
    btn.classList.toggle('is-done', btnStep < step);
  });

  document.querySelectorAll('.wizardStepLine').forEach((line) => {
    const lineIndex = Number(line.dataset.line);
    line.classList.toggle('is-done', lineIndex < step);
  });

  document.getElementById('wizardBack').hidden = step === 1;
  document.getElementById('wizardNext').hidden = step === TOTAL_STEPS;
  document.getElementById('wizardSave').hidden = step !== TOTAL_STEPS;

  const saveCustoms = document.getElementById('wizardSaveCustoms');
  if (saveCustoms) saveCustoms.hidden = step !== TOTAL_STEPS;

  if (step !== TOTAL_STEPS) resetSaveCustomsButton();

  if (step === 1) {
    updateLocationStatus();
  } else if (step === 2) {
    renderWaypointFacilitiesList();
  } else if (step === 3) {
    renderFacilityEditorTabs('facilityEditorTabs');
    loadFacilityEditorFromDraft();
    loadImagesFromDraftFacilities();
  }
}

function validateUpTo(step) {
  for (let i = 1; i <= step; i++) {
    if (!validateStep(i)) return false;
  }
  return true;
}

function validateStep(step) {
  clearError();

  if (step === 1) {
    const lat = parseCoordinate(document.getElementById('formLat').value);
    const lng = parseCoordinate(document.getElementById('formLng').value);
    if (lat == null || lng == null) {
      showError('יש לבחור מיקום על המפה או להזין קואורדינטות תקינות');
      return false;
    }
    if (!isPointInIsrael(lat, lng)) {
      showError('ניתן להציב נקודת ציון רק בתוך גבולות המדינה');
      return false;
    }
  }

  if (step === 2) {
    const name = document.getElementById('formName').value.trim();
    if (!name) {
      showError('יש להזין שם נקודת ציון כדי להמשיך');
      document.getElementById('formName').focus();
      return false;
    }

    const contactName = document.getElementById('formContactName').value.trim();
    const contactRole = document.getElementById('formContactRole').value.trim();
    const phone = document.getElementById('formPhone').value.trim();
    if (!contactName || !contactRole || !phone) {
      showError('יש למלא יצירת קשר עם הנקודה: שם, תפקיד וטלפון');
      if (!contactName) document.getElementById('formContactName').focus();
      else if (!contactRole) document.getElementById('formContactRole').focus();
      else document.getElementById('formPhone').focus();
      return false;
    }

    syncFacilityListFromDom();
    if (draftFacilities.length === 0) {
      showError('יש להוסיף לפחות מתקן אחד לנקודת הציון');
      return false;
    }
    const emptyType = draftFacilities.findIndex((facility) => !facility.typeOfFacility?.trim());
    if (emptyType >= 0) {
      showError(`יש לבחור סוג מתקן עבור מתקן מספר ${emptyType + 1}`);
      return false;
    }
  }

  if (step === 3) {
    saveFacilityEditorToDraft();
    for (let i = 0; i < draftFacilities.length; i++) {
      const facility = draftFacilities[i];
      if (!facility.typeOfFacility?.trim()) {
        showError(
          `יש לבחור סוג מתקן בשלב הפרטים עבור "${getFacilityDraftLabel(facility, i)}"`,
        );
        activeFacilityIndex = i;
        goToStep(2);
        return false;
      }
    }

    const selects = [
      document.getElementById('formSpecificType'),
      document.getElementById('formTrainingFrame'),
    ];
    for (const select of selects) {
      if (select.value === OTHER_VALUE) {
        const otherValue = getSelectOrOtherValue(select);
        if (!otherValue) {
          showError('בחירת "אחר" דורשת מילוי השדה שנפתח מתחת');
          document.getElementById(select.dataset.otherFor)?.focus();
          return false;
        }
      }
    }

    const otherToggle = document.getElementById('trainingOtherToggle');
    if (otherToggle?.checked && !document.getElementById('formTrainingOther').value.trim()) {
      showError('בחירת "אחר" בסוגי אימון דורשת מילוי השדה שנפתח מתחת');
      document.getElementById('formTrainingOther').focus();
      return false;
    }
  }

  return true;
}

function showError(message) {
  const el = document.getElementById('facilityFormError');
  el.textContent = message;
  el.hidden = false;
}

function clearError() {
  const el = document.getElementById('facilityFormError');
  el.hidden = true;
  el.textContent = '';
}

function updateLocationStatus() {
  const status = document.getElementById('locationStatus');
  const areaEl = document.getElementById('formAreaAuto');
  const lat = parseCoordinate(document.getElementById('formLat').value);
  const lng = parseCoordinate(document.getElementById('formLng').value);

  if (lat != null && lng != null) {
    const inside = isPointInIsrael(lat, lng);
    const area = resolveAreaFromLat(lat);
    status.textContent = inside
      ? `מיקום נבחר: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
      : `מיקום מחוץ לגבולות: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    status.classList.toggle('is-ready', inside);
    status.classList.toggle('is-invalid', !inside);
    if (areaEl) {
      areaEl.textContent = inside
        ? `אזור בארץ (אוטומטי): ${area}`
        : 'אזור בארץ ייקבע אחרי בחירת מיקום תקין';
      areaEl.classList.toggle('is-ready', inside);
    }
  } else {
    status.textContent = 'טרם נבחר מיקום';
    status.classList.remove('is-ready', 'is-invalid');
    if (areaEl) {
      areaEl.textContent = 'האזור בארץ ייקבע אוטומטית לפי המיקום';
      areaEl.classList.remove('is-ready');
    }
  }
}

/**
 * Parse lat/lng from text or number inputs (supports comma decimals).
 * @param {unknown} raw
 * @returns {number | null}
 */
function parseCoordinate(raw) {
  if (raw == null) return null;
  const text = String(raw).trim().replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {string} inputId
 * @param {number} value
 */
function setCoordinateInput(inputId, value) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.value = Number(value).toFixed(6);
}

function bindCoordinateInputs() {
  ['formLat', 'formLng'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('input', updateLocationStatus);
    el.addEventListener('change', () => {
      const parsed = parseCoordinate(el.value);
      if (parsed != null) el.value = parsed.toFixed(6);
      updateLocationStatus();
    });
    // Prevent accidental scroll-changing of coordinates
    el.addEventListener(
      'wheel',
      (event) => {
        if (document.activeElement === el) event.preventDefault();
      },
      { passive: false },
    );
  });
}

function onSaveCustomValues() {
  clearError();

  const specificSelect = document.getElementById('formSpecificType');
  const frameSelect = document.getElementById('formTrainingFrame');
  const facilityType = String(
    draftFacilities[activeFacilityIndex]?.typeOfFacility || '',
  ).trim();
  const knownTypes = new Set(getMergedFacilityTypes());

  /** @type {{ facilityTypes: string[], specificTypes: Record<string, string[]>, trainingFrames: string[], trainingOptions: string[] }} */
  const additions = {
    facilityTypes: [],
    specificTypes: {},
    trainingFrames: [],
    trainingOptions: [],
  };

  for (const facility of draftFacilities) {
    const type = String(facility.typeOfFacility || '').trim();
    if (type && !knownTypes.has(type)) {
      additions.facilityTypes.push(type);
      knownTypes.add(type);
    }
  }

  if (frameSelect.value === OTHER_VALUE) {
    const value = getSelectOrOtherValue(frameSelect);
    if (!value) {
      showError('בחירת "אחר" במסגרת מתאמנת דורשת מילוי השדה שנפתח מתחת');
      document.getElementById('formFrameOther')?.focus();
      return;
    }
    additions.trainingFrames.push(value);
  }

  if (specificSelect.value === OTHER_VALUE) {
    const value = getSelectOrOtherValue(specificSelect);
    if (!value) {
      showError('בחירת "אחר" בסוג אימון דורשת מילוי השדה שנפתח מתחת');
      document.getElementById('formSpecificOther')?.focus();
      return;
    }
    if (!facilityType) {
      showError('יש לבחור סוג מתקן בשלב הפרטים לפני שמירת סוג אימון חדש');
      return;
    }
    additions.specificTypes[facilityType] = [value];
  }

  const otherToggle = document.getElementById('trainingOtherToggle');
  const otherText = document.getElementById('formTrainingOther').value.trim();
  if (otherToggle?.checked) {
    if (!otherText) {
      showError('בחירת "אחר" בסוגי אימון דורשת מילוי השדה שנפתח מתחת');
      document.getElementById('formTrainingOther')?.focus();
      return;
    }
    otherText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((value) => additions.trainingOptions.push(value));
  }

  const pendingCount =
    additions.facilityTypes.length +
    additions.trainingFrames.length +
    additions.trainingOptions.length +
    Object.values(additions.specificTypes).reduce((sum, list) => sum + list.length, 0);

  if (pendingCount === 0) {
    showError('אין ערכים חדשים לשמירה — בחרו "אחר", הזינו ערך, ואז שמרו');
    return;
  }

  const { addedCount } = appendToOptionCatalogs(additions);
  refreshOptionListsPreservingValues();

  if (addedCount === 0) {
    showError('הערכים האלה כבר שמורים ברשימות');
    return;
  }

  playSaveCustomsSuccess();
}

function playSaveCustomsSuccess() {
  const btn = document.getElementById('wizardSaveCustoms');
  btn.classList.remove('is-success');
  // restart animation if clicked again
  void btn.offsetWidth;
  btn.classList.add('is-success');
  btn.setAttribute('aria-live', 'polite');

  window.clearTimeout(saveCustomsResetTimer);
  saveCustomsResetTimer = window.setTimeout(() => {
    resetSaveCustomsButton();
  }, 2200);
}

function resetSaveCustomsButton() {
  const btn = document.getElementById('wizardSaveCustoms');
  if (!btn) return;
  btn.classList.remove('is-success');
  window.clearTimeout(saveCustomsResetTimer);
  saveCustomsResetTimer = 0;
}

function onSubmit(event) {
  event.preventDefault();

  if (!validateUpTo(TOTAL_STEPS)) {
    if (!validateStep(1)) goToStep(1);
    else if (!validateStep(2)) goToStep(2);
    else if (!validateStep(3)) goToStep(3);
    return;
  }

  prepareLeaveStep(currentStep);
  syncFacilityListFromDom();
  saveFacilityEditorToDraft();
  syncImagesToDraftFacilities();

  const lat = parseCoordinate(document.getElementById('formLat').value);
  const lng = parseCoordinate(document.getElementById('formLng').value);

  const values = {
    nameOfFacility: document.getElementById('formName').value,
    unitOwningTheFacility: document.getElementById('formUnit').value,
    phoneOfFacility: document.getElementById('formPhone').value,
    contactNameOfFacility: document.getElementById('formContactName').value,
    contactRoleOfFacility: document.getElementById('formContactRole').value,
    areaInTheCountry: resolveAreaFromLat(lat ?? NaN),
    lat: String(lat ?? ''),
    lng: String(lng ?? ''),
    facilities: draftFacilities.map((facility) => ({
      name: facility.name,
      statusOfFacility: facility.statusOfFacility,
      locationOfFacility: facility.locationOfFacility,
      typeOfFacility: facility.typeOfFacility,
      specificTypeOfFacility: facility.specificTypeOfFacility,
      trainingFrame: facility.trainingFrame,
      trainingOptions: facility.trainingOptions.join(', '),
      contactName: facility.contactName,
      contactRank: facility.contactRank,
      contactPhone: facility.contactPhone,
      imgArr: facility.imgArr,
      comments: facility.comments,
    })),
  };

  let feature = buildFeatureFromForm(values, editingId);
  /** @type {string[]} */
  let updateChanges = [];

  try {
    if (editingId) {
      const existing = state.facilitiesData.features.find(
        (f) => f.properties?.id === editingId,
      );
      updateChanges = describeFacilityChanges(existing, feature);
      updateFacility(state.facilitiesData, editingId, feature);
    } else {
      addFacility(state.facilitiesData, feature);
    }
  } catch (error) {
    const isQuota =
      error?.name === 'QuotaExceededError' ||
      error?.code === 22 ||
      /quota/i.test(String(error?.message ?? ''));
    if (isQuota) {
      showError('אין מספיק מקום לשמירת התמונות. הסירו חלק מהן או בחרו תמונות קטנות יותר.');
      goToStep(3);
      return;
    }
    throw error;
  }

  const wasNew = !editingId;
  closeForm();

  const manager = getActiveFacilityManager();
  if (manager) {
    addFacilityChangeReport({
      type: wasNew ? 'facility_created' : 'facility_updated',
      managerId: manager.id,
      managerName: manager.name,
      facilityId: feature.properties.id,
      facilityName: feature.properties.nameOfFacility ?? values.nameOfFacility,
      changes: wasNew ? [] : updateChanges,
    });
  }

  onSaved({
    id: feature.properties.id,
    isNew: wasNew,
  });
}

function startPickOnMap() {
  if (!state.map || isPinDropping) return;

  const hint = document.getElementById('mapPickHint');
  if (hint) {
    hint.classList.remove('is-idle');
    hint.hidden = false;
    hint.textContent = 'בחרו מיקום במפה · Esc לביטול';
  }

  const backdrop = document.getElementById('facilityFormBackdrop');
  window.clearTimeout(formCloseTimer);
  isClosingForm = false;
  backdrop.classList.remove('is-opening', 'is-closing');
  backdrop.hidden = true;

  stopPickOnMap(false);
  pickingFromForm = true;
  bindPickEscape();

  mapClickHandler = (e) => {
    if (isPinDropping) return;

    if (!isPointInIsrael(e.latlng.lat, e.latlng.lng)) {
      showOutsideIsraelHint();
      // Keep listening — do not end pick mode on invalid click
      return;
    }

    const { lat, lng } = e.latlng;
    // Stop further picks immediately; form resumes after pin animation
    stopPickOnMap(false);
    playPinDropAnimation(e.latlng, () => {
      setCoordinateInput('formLat', lat);
      setCoordinateInput('formLng', lng);
      updateLocationStatus();
      resumeFormAfterMapPick(1);
    });
  };

  state.map.on('click', mapClickHandler);
  syncMapPinCursor();
}

/**
 * Restore the wizard after a successful map pick.
 * @param {number} [step=1]
 */
function resumeFormAfterMapPick(step = 1) {
  pickingFromForm = false;
  stopPickOnMap();

  const formBackdrop = document.getElementById('facilityFormBackdrop');
  if (!formBackdrop) return;

  formBackdrop.hidden = false;
  formBackdrop.classList.remove('is-opening', 'is-closing');
  void formBackdrop.offsetWidth;
  formBackdrop.classList.add('is-opening');
  goToStep(step);
  updateLocationStatus();
  updateAdminMapHint();
  syncMapPinCursor();
}

/**
 * Cancel map pick and reopen the wizard if we came from the form.
 */
function cancelPickOnMap() {
  if (!pickingFromForm && !mapClickHandler) return;
  pickingFromForm = false;
  stopPickOnMap();

  const formBackdrop = document.getElementById('facilityFormBackdrop');
  if (formBackdrop) {
    formBackdrop.hidden = false;
    formBackdrop.classList.remove('is-opening', 'is-closing');
    void formBackdrop.offsetWidth;
    formBackdrop.classList.add('is-opening');
    goToStep(1);
  }

  const hint = document.getElementById('mapPickHint');
  if (hint) {
    hint.hidden = true;
    hint.classList.remove('is-idle');
  }
  updateAdminMapHint();
  syncMapPinCursor();
}

function bindPickEscape() {
  unbindPickEscape();
  pickEscapeHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelPickOnMap();
    }
  };
  window.addEventListener('keydown', pickEscapeHandler);
}

function unbindPickEscape() {
  if (!pickEscapeHandler) return;
  window.removeEventListener('keydown', pickEscapeHandler);
  pickEscapeHandler = null;
}

/**
 * @param {boolean} [clearCursor=true]
 */
function stopPickOnMap(clearCursor = true) {
  if (mapClickHandler && state.map) {
    state.map.off('click', mapClickHandler);
    mapClickHandler = null;
  }
  unbindPickEscape();
  if (clearCursor) syncMapPinCursor();
}

/**
 * Enable/disable creating a facility by clicking empty map area (admin only).
 * @param {boolean} enabled
 */
export function setAdminMapCreateEnabled(enabled) {
  if (!state.map) return;

  state.map.off('click', onAdminMapCreate);
  adminMapCreateBound = false;

  if (enabled) {
    state.map.on('click', onAdminMapCreate);
    adminMapCreateBound = true;
  }

  updateAdminMapHint();
  syncMapPinCursor();
}

function onAdminMapCreate(e) {
  if (!isAdmin() || !adminMapCreateBound || isPinDropping) return;
  if (mapClickHandler || pickingFromForm) return;

  if (hasOpenMarkerMenu()) {
    closeMarkerActionMenu();
    return;
  }

  if (consumeMapCreateSuppression()) return;

  const formOpen = !document.getElementById('facilityFormBackdrop').hidden;
  if (formOpen) return;

  const popupOpen =
    document.getElementById('popUpBackground').style.display === 'block';
  if (popupOpen) return;

  if (e.originalEvent?.target?.closest?.('.leaflet-marker-icon, .facility-marker')) return;

  if (!isPointInIsrael(e.latlng.lat, e.latlng.lng)) {
    showOutsideIsraelHint();
    return;
  }

  const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
  playPinDropAnimation(e.latlng, () => {
    openCreateForm(coords);
  });
}

function updateAdminMapHint() {
  const hint = document.getElementById('mapPickHint');
  if (!hint) return;

  if (mapClickHandler || pickingFromForm) return;

  const formOpen = !document.getElementById('facilityFormBackdrop').hidden;
  if (isAdmin() && !formOpen) {
    hint.hidden = false;
    hint.classList.add('is-idle');
    hint.textContent = 'בחרו נקודה במפה להוספת נקודת ציון';
  } else {
    hint.hidden = true;
    hint.classList.remove('is-idle');
  }

  syncMapPinCursor();
}

let outsideHintTimer = 0;

function showOutsideIsraelHint() {
  const hint = document.getElementById('mapOutsideHint');
  if (!hint) return;

  hint.hidden = false;

  window.clearTimeout(outsideHintTimer);
  outsideHintTimer = window.setTimeout(() => {
    hint.hidden = true;
  }, 2200);
}

/**
 * @param {L.LatLng} latlng
 * @param {() => void} [onDone]
 */
function playPinDropAnimation(latlng, onDone) {
  if (!state.map) {
    onDone?.();
    return;
  }

  isPinDropping = true;
  const container = state.map.getContainer();

  // Hide cursor pin immediately, then start drop only after it's gone
  container.classList.remove('is-pin-mode');
  container.classList.add('is-pin-hiding');

  window.setTimeout(() => {
    if (!state.map) {
      isPinDropping = false;
      onDone?.();
      return;
    }

    const icon = L.divIcon({
      className: 'pin-drop-marker',
      html: `
        <div class="pin-drop">
          <div class="pin-drop-pin">
            <span class="pin-drop-head pin-drop-head--blue"></span>
            <span class="pin-drop-tip pin-drop-tip--blue"></span>
            <span class="pin-drop-head pin-drop-head--red"></span>
            <span class="pin-drop-tip pin-drop-tip--red"></span>
            <span class="pin-drop-dot"></span>
          </div>
          <div class="pin-drop-ripple"></div>
          <div class="pin-drop-shadow"></div>
        </div>
      `,
      iconSize: [56, 60],
      iconAnchor: [28, 56],
    });

    const marker = L.marker(latlng, {
      icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(state.map);

    window.setTimeout(() => {
      marker.getElement()?.querySelector('.pin-drop')?.classList.add('is-planted');
    }, 340);

    window.setTimeout(() => {
      state.map?.removeLayer(marker);
      container.classList.remove('is-pin-hiding');
      isPinDropping = false;
      onDone?.();
    }, 820);
  }, 90);
}

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
