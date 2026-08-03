import L from 'leaflet';
import {
  FACILITY_TYPES,
  AREAS,
  LOCATIONS,
  TRAINING_FRAMES,
  TRAINING_OPTIONS,
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
import { syncMapPinCursor, registerPinCursorContext } from './pinCursor.js';

const OTHER_VALUE = '__other__';
const OTHER_LABEL = 'אחר';
const MAX_UPLOAD_IMAGES = 8;
const MAX_IMAGE_EDGE = 1280;
const IMAGE_JPEG_QUALITY = 0.72;

let onSaved = () => {};
let editingId = null;
let mapClickHandler = null;
let adminMapCreateBound = false;
let currentStep = 1;
const TOTAL_STEPS = 3;
/** @type {string[]} */
let uploadedImages = [];
let saveCustomsResetTimer = 0;
let isPinDropping = false;
let imageUploadBound = false;

/**
 * @param {{ onSaved: (meta?: { id: string, isNew: boolean }) => void }} options
 */
export function initFacilityForm({ onSaved: savedCb }) {
  onSaved = savedCb;

  registerPinCursorContext(() => ({
    isPinDropping,
    mapClickActive: Boolean(mapClickHandler),
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
  bindImageUpload();
  renderUploadedImages();
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
  setUploadedImages(type.imgArr ?? []);

  showForm();
}

function showForm() {
  closePopup();
  stopPickOnMap();
  clearError();
  goToStep(1);
  updateLocationStatus();
  const backdrop = document.getElementById('facilityFormBackdrop');
  backdrop.hidden = false;
  backdrop.classList.remove('is-opening');
  void backdrop.offsetWidth;
  backdrop.classList.add('is-opening');
  updateAdminMapHint();
  syncMapPinCursor();
}

export function closeForm() {
  stopPickOnMap();
  clearError();
  resetSaveCustomsButton();
  const backdrop = document.getElementById('facilityFormBackdrop');
  backdrop.hidden = true;
  backdrop.classList.remove('is-opening');
  updateAdminMapHint();
  syncMapPinCursor();
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
  setUploadedImages([]);
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

function bindImageUpload() {
  if (imageUploadBound) return;
  imageUploadBound = true;

  const input = document.getElementById('formImgInput');
  const zone = document.getElementById('formImgDropzone');
  if (!input || !zone) return;

  zone.addEventListener('click', () => {
    if (uploadedImages.length >= MAX_UPLOAD_IMAGES) {
      showError(`ניתן להעלות עד ${MAX_UPLOAD_IMAGES} תמונות`);
      return;
    }
    input.click();
  });

  input.addEventListener('change', async () => {
    const files = [...(input.files ?? [])];
    input.value = '';
    await addImageFiles(files);
  });

  zone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    zone.classList.add('is-dragover');
  });
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-dragover');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('is-dragover');
  });
  zone.addEventListener('drop', async (event) => {
    event.preventDefault();
    zone.classList.remove('is-dragover');
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

  const remaining = MAX_UPLOAD_IMAGES - uploadedImages.length;
  if (remaining <= 0) {
    showError(`ניתן להעלות עד ${MAX_UPLOAD_IMAGES} תמונות`);
    return;
  }

  const batch = files.slice(0, remaining);
  if (files.length > remaining) {
    showError(`נוספו ${batch.length} תמונות בלבד (מגבלה: ${MAX_UPLOAD_IMAGES})`);
  }

  try {
    const dataUrls = await Promise.all(batch.map((file) => compressImageFile(file)));
    uploadedImages = [...uploadedImages, ...dataUrls];
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
 * @param {string[]} images
 */
function setUploadedImages(images) {
  uploadedImages = (images ?? []).filter(Boolean).slice(0, MAX_UPLOAD_IMAGES);
  renderUploadedImages();
}

function renderUploadedImages() {
  const picker = document.getElementById('formImgPicker');
  const zone = document.getElementById('formImgDropzone');
  if (!picker) return;

  picker.innerHTML = uploadedImages
    .map(
      (src, index) => `
      <div class="imagePickItem" role="listitem">
        <img src="${escapeAttr(src)}" alt="תמונה ${index + 1}" />
        <button
          type="button"
          class="imagePickRemove"
          data-index="${index}"
          aria-label="הסר תמונה ${index + 1}"
        >×</button>
      </div>
    `,
    )
    .join('');

  picker.querySelectorAll('.imagePickRemove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.index);
      if (!Number.isInteger(index)) return;
      uploadedImages = uploadedImages.filter((_, i) => i !== index);
      clearError();
      renderUploadedImages();
    });
  });

  if (zone) {
    zone.disabled = uploadedImages.length >= MAX_UPLOAD_IMAGES;
  }
}

function getUploadedImages() {
  return [...uploadedImages];
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
    imgArr: getUploadedImages(),
    comments: document.getElementById('formComments').value,
  };

  let feature = buildFeatureFromForm(values, editingId);

  try {
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

  closeForm();
  onSaved({
    id: feature.properties.id,
    isNew: !editingId,
  });
}

function startPickOnMap() {
  if (!state.map) return;

  const hint = document.getElementById('mapPickHint');
  hint.classList.remove('is-idle');
  hint.hidden = false;
  hint.textContent = 'בחרו מיקום במפה';
  document.getElementById('facilityFormBackdrop').hidden = true;

  stopPickOnMap(false);
  syncMapPinCursor();

  mapClickHandler = (e) => {
    playPinDropAnimation(e.latlng, () => {
      document.getElementById('formLat').value = e.latlng.lat.toFixed(6);
      document.getElementById('formLng').value = e.latlng.lng.toFixed(6);
      updateLocationStatus();
      stopPickOnMap();
      const backdrop = document.getElementById('facilityFormBackdrop');
      backdrop.hidden = false;
      backdrop.classList.remove('is-opening');
      void backdrop.offsetWidth;
      backdrop.classList.add('is-opening');
      goToStep(2);
      updateAdminMapHint();
      syncMapPinCursor();
    });
  };

  state.map.once('click', mapClickHandler);
}

/**
 * @param {boolean} [clearCursor=true]
 */
function stopPickOnMap(clearCursor = true) {
  if (mapClickHandler && state.map) {
    state.map.off('click', mapClickHandler);
    mapClickHandler = null;
  }
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

  const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
  playPinDropAnimation(e.latlng, () => {
    openCreateForm(coords);
  });
}

function updateAdminMapHint() {
  const hint = document.getElementById('mapPickHint');
  if (!hint) return;

  if (mapClickHandler) return;

  const formOpen = !document.getElementById('facilityFormBackdrop').hidden;
  if (isAdmin() && !formOpen) {
    hint.hidden = false;
    hint.classList.add('is-idle');
    hint.textContent = 'בחרו נקודה במפה להוספת מתקן';
  } else {
    hint.hidden = true;
    hint.classList.remove('is-idle');
  }

  syncMapPinCursor();
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
