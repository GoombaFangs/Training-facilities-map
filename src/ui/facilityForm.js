import {
  FACILITY_TYPES,
  AREAS,
  LOCATIONS,
  TRAINING_FRAMES,
  TRAINING_OPTIONS,
  AVAILABLE_IMAGES,
  FACILITY_STATUSES,
  getSpecificTypesFor,
} from '../config/constants.js';
import {
  loadCustomOptions,
  addCustomValues,
  mergeUnique,
} from '../data/customOptions.js';
import { state } from '../state.js';
import { isAdmin } from '../auth/roleGate.js';
import {
  addFacility,
  updateFacility,
  buildFeatureFromForm,
} from '../data/loadFacilities.js';
import { closePopup } from './popup.js';
import {
  hasOpenMarkerMenu,
  closeMarkerActionMenu,
  consumeMapCreateSuppression,
} from './markerActions.js';

const OTHER_VALUE = '__other__';
const OTHER_LABEL = 'אחר';

let onSaved = () => {};
let editingId = null;
let mapClickHandler = null;
let adminMapCreateBound = false;
let currentStep = 1;
const TOTAL_STEPS = 3;
/** @type {Set<string>} */
let selectedImages = new Set();
let saveCustomsResetTimer = 0;

/**
 * @param {{ onSaved: () => void }} options
 */
export function initFacilityForm({ onSaved: savedCb }) {
  onSaved = savedCb;

  document.getElementById('facilityFormCancel').addEventListener('click', closeForm);
  document.getElementById('facilityFormBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'facilityFormBackdrop') closeForm();
  });
  document.getElementById('facilityForm').addEventListener('submit', onSubmit);
  document.getElementById('pickOnMapBtn').addEventListener('click', startPickOnMap);
  document.getElementById('wizardNext').addEventListener('click', goNext);
  document.getElementById('wizardBack').addEventListener('click', goBack);
  document.getElementById('wizardSaveCustoms').addEventListener('click', onSaveCustomValues);
  document.getElementById('formLat').addEventListener('input', updateLocationStatus);
  document.getElementById('formLng').addEventListener('input', updateLocationStatus);
  document.getElementById('formTypeOfFacility').addEventListener('change', () => {
    syncOtherInput(document.getElementById('formTypeOfFacility'));
    refreshSpecificTypes();
  });

  document.querySelectorAll('select[data-other-for]').forEach((select) => {
    if (select.id === 'formTypeOfFacility') return;
    select.addEventListener('change', () => syncOtherInput(select));
  });

  document.querySelectorAll('.wizardStep').forEach((stepBtn) => {
    stepBtn.addEventListener('click', () => {
      const target = Number(stepBtn.dataset.step);
      if (target < currentStep || validateUpTo(target - 1)) {
        goToStep(target);
      }
    });
  });

  refillAllOptionLists();
  renderImagePicker();
}

export function openCreateForm(coords = null) {
  editingId = null;
  document.getElementById('facilityFormTitle').textContent = 'הוספת מתקן';
  document.getElementById('wizardSave').textContent = 'צור מתקן';
  resetFormFields();

  if (coords) {
    document.getElementById('formLat').value = coords.lat.toFixed(6);
    document.getElementById('formLng').value = coords.lng.toFixed(6);
  }

  showForm();
}

/**
 * @param {GeoJSON.Feature} feature
 */
export function openEditForm(feature) {
  const props = feature.properties;
  const type = props.TypesOfFacilities?.[0] ?? {};
  const [lng, lat] = feature.geometry.coordinates;

  editingId = props.id;
  document.getElementById('facilityFormTitle').textContent = 'עריכת מתקן';
  document.getElementById('wizardSave').textContent = 'עדכן מתקן';

  refillAllOptionLists();

  document.getElementById('formName').value = props.nameOfFacility ?? '';
  document.getElementById('formUnit').value = props.unitOwningTheFacility ?? '';
  document.getElementById('formPhone').value = props.phoneOfFacility ?? '';
  document.getElementById('formStatus').value =
    props.statusOfFacility ?? FACILITY_STATUSES[0].value;
  document.getElementById('formLat').value = Number(lat).toFixed(6);
  document.getElementById('formLng').value = Number(lng).toFixed(6);
  document.getElementById('formComments').value = type.comments ?? '';

  setSelectOrOther(document.getElementById('formLocation'), props.locationOfFacility);
  document.getElementById('formAreaInTheCountry').value =
    props.areaInTheCountry ?? AREAS[0].value;
  setSelectOrOther(document.getElementById('formTypeOfFacility'), type.typeOfFacility);
  refreshSpecificTypes(type.specificTypeOfFacility);
  setSelectOrOther(document.getElementById('formTrainingFrame'), type.trainingFrame);

  setSelectedTrainingOptions(type.trainingOptions ?? []);
  setSelectedImages(type.imgArr ?? []);

  showForm();
}

export function closeForm() {
  stopPickOnMap();
  clearError();
  resetSaveCustomsButton();
  document.getElementById('facilityFormBackdrop').hidden = true;
  updateAdminMapHint();
}

function showForm() {
  closePopup();
  stopPickOnMap();
  clearError();
  goToStep(1);
  updateLocationStatus();
  document.getElementById('facilityFormBackdrop').hidden = false;
  updateAdminMapHint();
}

function resetFormFields() {
  refillAllOptionLists();
  document.getElementById('facilityForm').reset();
  document.getElementById('formTypeOfFacility').selectedIndex = 0;
  document.getElementById('formAreaInTheCountry').selectedIndex = 0;
  document.getElementById('formStatus').selectedIndex = 0;
  document.getElementById('formLocation').selectedIndex = 0;
  document.getElementById('formTrainingFrame').selectedIndex = 0;
  document.querySelectorAll('.otherInput').forEach((input) => {
    input.value = '';
    input.hidden = true;
  });
  refreshSpecificTypes();
  setSelectedTrainingOptions([]);
  setSelectedImages([]);
  resetSaveCustomsButton();
}

function getMergedLocations() {
  return mergeUnique(LOCATIONS, loadCustomOptions().locations);
}

function getMergedFacilityTypes() {
  return mergeUnique(
    FACILITY_TYPES.map((t) => t.value),
    loadCustomOptions().facilityTypes,
  );
}

function getMergedTrainingFrames() {
  return mergeUnique(TRAINING_FRAMES, loadCustomOptions().trainingFrames);
}

function getMergedTrainingOptions() {
  return mergeUnique(TRAINING_OPTIONS, loadCustomOptions().trainingOptions);
}

/**
 * @param {string} facilityType
 */
function getMergedSpecificTypes(facilityType) {
  const custom = loadCustomOptions().specificTypes[facilityType] ?? [];
  return mergeUnique(getSpecificTypesFor(facilityType), custom);
}

function refillAllOptionLists() {
  fillSelect(
    document.getElementById('formTypeOfFacility'),
    getMergedFacilityTypes(),
    true,
  );
  fillSelect(
    document.getElementById('formAreaInTheCountry'),
    AREAS.map((a) => a.value),
    false,
  );
  fillSelect(
    document.getElementById('formStatus'),
    FACILITY_STATUSES.map((s) => s.value),
    false,
  );
  fillSelect(document.getElementById('formLocation'), getMergedLocations(), true);
  fillSelect(
    document.getElementById('formTrainingFrame'),
    getMergedTrainingFrames(),
    true,
  );
  renderTrainingOptionChips();
  refreshSpecificTypes();
}

/**
 * Keep current form values while refreshing option lists after saving customs.
 */
function refreshOptionListsPreservingValues() {
  const snapshot = {
    location: getSelectOrOtherValue(document.getElementById('formLocation')),
    area: document.getElementById('formAreaInTheCountry').value,
    status: document.getElementById('formStatus').value,
    type: getSelectOrOtherValue(document.getElementById('formTypeOfFacility')),
    specific: getSelectOrOtherValue(document.getElementById('formSpecificType')),
    frame: getSelectOrOtherValue(document.getElementById('formTrainingFrame')),
    training: getSelectedTrainingOptions(),
    name: document.getElementById('formName').value,
    unit: document.getElementById('formUnit').value,
    phone: document.getElementById('formPhone').value,
    comments: document.getElementById('formComments').value,
    lat: document.getElementById('formLat').value,
    lng: document.getElementById('formLng').value,
  };

  refillAllOptionLists();

  document.getElementById('formName').value = snapshot.name;
  document.getElementById('formUnit').value = snapshot.unit;
  document.getElementById('formPhone').value = snapshot.phone;
  document.getElementById('formComments').value = snapshot.comments;
  document.getElementById('formLat').value = snapshot.lat;
  document.getElementById('formLng').value = snapshot.lng;
  document.getElementById('formAreaInTheCountry').value = snapshot.area;
  document.getElementById('formStatus').value = snapshot.status;

  setSelectOrOther(document.getElementById('formLocation'), snapshot.location);
  setSelectOrOther(document.getElementById('formTypeOfFacility'), snapshot.type);
  refreshSpecificTypes(snapshot.specific);
  setSelectOrOther(document.getElementById('formTrainingFrame'), snapshot.frame);
  setSelectedTrainingOptions(snapshot.training);
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
  const typeSelect = document.getElementById('formTypeOfFacility');
  const facilityType =
    typeSelect.value === OTHER_VALUE
      ? document.getElementById('formTypeOther').value.trim()
      : typeSelect.value;

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

function renderImagePicker() {
  const picker = document.getElementById('formImgPicker');
  picker.innerHTML = AVAILABLE_IMAGES.map(
    (src) => `
      <button type="button" class="imagePickItem" data-src="${escapeAttr(src)}" aria-pressed="false">
        <img src="${escapeAttr(src)}" alt="" />
        <span class="imagePickCheck" aria-hidden="true">✓</span>
      </button>
    `,
  ).join('');

  picker.querySelectorAll('.imagePickItem').forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.src;
      if (selectedImages.has(src)) selectedImages.delete(src);
      else selectedImages.add(src);
      syncImagePickerUi();
    });
  });
}

/**
 * @param {string[]} images
 */
function setSelectedImages(images) {
  selectedImages = new Set(images.filter(Boolean));

  const picker = document.getElementById('formImgPicker');
  selectedImages.forEach((src) => {
    if (
      !AVAILABLE_IMAGES.includes(src) &&
      !picker.querySelector(`[data-src="${cssEscape(src)}"]`)
    ) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'imagePickItem';
      btn.dataset.src = src;
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = `
        <img src="${escapeAttr(src)}" alt="" />
        <span class="imagePickCheck" aria-hidden="true">✓</span>
      `;
      btn.addEventListener('click', () => {
        if (selectedImages.has(src)) selectedImages.delete(src);
        else selectedImages.add(src);
        syncImagePickerUi();
      });
      picker.appendChild(btn);
    }
  });

  syncImagePickerUi();
}

function syncImagePickerUi() {
  document.querySelectorAll('.imagePickItem').forEach((btn) => {
    const selected = selectedImages.has(btn.dataset.src);
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function getSelectedImages() {
  return [...selectedImages];
}

function goNext() {
  if (!validateStep(currentStep)) return;
  if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1);
}

function goBack() {
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

  document.getElementById('wizardBack').hidden = step === 1;
  document.getElementById('wizardNext').hidden = step === TOTAL_STEPS;
  document.getElementById('wizardSave').hidden = step !== TOTAL_STEPS;
  document.getElementById('wizardSaveCustoms').hidden = step !== TOTAL_STEPS;

  if (step !== TOTAL_STEPS) resetSaveCustomsButton();
  if (step === 2) updateLocationStatus();
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
    const name = document.getElementById('formName').value.trim();
    if (!name) {
      showError('יש להזין שם מתקן כדי להמשיך');
      document.getElementById('formName').focus();
      return false;
    }

    const selects = [
      document.getElementById('formLocation'),
      document.getElementById('formTypeOfFacility'),
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

  if (step === 2) {
    const lat = Number(document.getElementById('formLat').value);
    const lng = Number(document.getElementById('formLng').value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      showError('יש לבחור מיקום על המפה או להזין קואורדינטות תקינות');
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
  const lat = Number(document.getElementById('formLat').value);
  const lng = Number(document.getElementById('formLng').value);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    status.textContent = `מיקום נבחר: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    status.classList.add('is-ready');
  } else {
    status.textContent = 'טרם נבחר מיקום';
    status.classList.remove('is-ready');
  }
}

function onSaveCustomValues() {
  clearError();

  const locationSelect = document.getElementById('formLocation');
  const typeSelect = document.getElementById('formTypeOfFacility');
  const specificSelect = document.getElementById('formSpecificType');
  const frameSelect = document.getElementById('formTrainingFrame');

  /** @type {{ locations: string[], facilityTypes: string[], specificTypes: Record<string, string[]>, trainingFrames: string[], trainingOptions: string[] }} */
  const additions = {
    locations: [],
    facilityTypes: [],
    specificTypes: {},
    trainingFrames: [],
    trainingOptions: [],
  };

  if (locationSelect.value === OTHER_VALUE) {
    const value = getSelectOrOtherValue(locationSelect);
    if (!value) {
      showError('בחירת "אחר" במיקום דורשת מילוי השדה שנפתח מתחת');
      document.getElementById('formLocationOther')?.focus();
      return;
    }
    additions.locations.push(value);
  }

  if (typeSelect.value === OTHER_VALUE) {
    const value = getSelectOrOtherValue(typeSelect);
    if (!value) {
      showError('בחירת "אחר" בסוג מתקן דורשת מילוי השדה שנפתח מתחת');
      document.getElementById('formTypeOther')?.focus();
      return;
    }
    additions.facilityTypes.push(value);
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

  const facilityType = getSelectOrOtherValue(typeSelect);
  if (specificSelect.value === OTHER_VALUE) {
    const value = getSelectOrOtherValue(specificSelect);
    if (!value) {
      showError('בחירת "אחר" בסוג ספציפי דורשת מילוי השדה שנפתח מתחת');
      document.getElementById('formSpecificOther')?.focus();
      return;
    }
    if (!facilityType) {
      showError('יש לבחור סוג מתקן לפני שמירת סוג ספציפי חדש');
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
    additions.locations.length +
    additions.facilityTypes.length +
    additions.trainingFrames.length +
    additions.trainingOptions.length +
    Object.values(additions.specificTypes).reduce((sum, list) => sum + list.length, 0);

  if (pendingCount === 0) {
    showError('אין ערכים חדשים לשמירה — בחרו "אחר", הזינו ערך, ואז שמרו');
    return;
  }

  const { addedCount } = addCustomValues(additions);
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
    return;
  }

  const values = {
    nameOfFacility: document.getElementById('formName').value,
    unitOwningTheFacility: document.getElementById('formUnit').value,
    phoneOfFacility: document.getElementById('formPhone').value,
    statusOfFacility: document.getElementById('formStatus').value,
    locationOfFacility: getSelectOrOtherValue(document.getElementById('formLocation')),
    areaInTheCountry: document.getElementById('formAreaInTheCountry').value,
    lat: document.getElementById('formLat').value,
    lng: document.getElementById('formLng').value,
    typeOfFacility: getSelectOrOtherValue(document.getElementById('formTypeOfFacility')),
    specificTypeOfFacility: getSelectOrOtherValue(document.getElementById('formSpecificType')),
    trainingFrame: getSelectOrOtherValue(document.getElementById('formTrainingFrame')),
    trainingOptions: getSelectedTrainingOptions().join(', '),
    imgArr: getSelectedImages().join(', '),
    comments: document.getElementById('formComments').value,
  };

  let feature = buildFeatureFromForm(values, editingId);

  if (editingId) {
    const existing = state.facilitiesData.features.find(
      (f) => f.properties?.id === editingId,
    );
    if (existing?.properties?.TypesOfFacilities?.length > 1) {
      const rest = existing.properties.TypesOfFacilities.slice(1);
      feature.properties.TypesOfFacilities = [
        feature.properties.TypesOfFacilities[0],
        ...rest,
      ];
    }
    updateFacility(state.facilitiesData, editingId, feature);
  } else {
    addFacility(state.facilitiesData, feature);
  }

  closeForm();
  onSaved();
}

function startPickOnMap() {
  if (!state.map) return;

  const hint = document.getElementById('mapPickHint');
  hint.classList.remove('is-idle');
  hint.hidden = false;
  hint.textContent = 'לחצו על המפה כדי לבחור מיקום';
  document.getElementById('facilityFormBackdrop').hidden = true;
  state.map.getContainer().style.cursor = 'crosshair';

  stopPickOnMap(false);

  mapClickHandler = (e) => {
    document.getElementById('formLat').value = e.latlng.lat.toFixed(6);
    document.getElementById('formLng').value = e.latlng.lng.toFixed(6);
    updateLocationStatus();
    stopPickOnMap();
    document.getElementById('facilityFormBackdrop').hidden = false;
    goToStep(2);
    updateAdminMapHint();
  };

  state.map.once('click', mapClickHandler);
}

/**
 * @param {boolean} [clearCursor=true]
 */
function stopPickOnMap(clearCursor = true) {
  if (clearCursor && state.map) {
    state.map.getContainer().style.cursor = '';
  }

  if (mapClickHandler && state.map) {
    state.map.off('click', mapClickHandler);
    mapClickHandler = null;
  }
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
}

function onAdminMapCreate(e) {
  if (!isAdmin() || !adminMapCreateBound) return;
  if (mapClickHandler) return;

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

  openCreateForm({ lat: e.latlng.lat, lng: e.latlng.lng });
}

function updateAdminMapHint() {
  const hint = document.getElementById('mapPickHint');
  if (!hint) return;

  if (mapClickHandler) return;

  const formOpen = !document.getElementById('facilityFormBackdrop').hidden;
  if (isAdmin() && !formOpen) {
    hint.hidden = false;
    hint.classList.add('is-idle');
    hint.textContent = 'לחצו על המפה כדי להוסיף מתקן חדש';
  } else {
    hint.hidden = true;
    hint.classList.remove('is-idle');
  }
}

export function startAddFacilityFlow() {
  openCreateForm();
}

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}
