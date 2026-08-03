import { state } from '../state.js';
import { getFacilityTypeByValue, getStatusByValue } from '../config/constants.js';
import { getStatusCssClass } from '../data/optionCatalogs.js';
import { setupGallery, resetGallery } from './gallery.js';

let activeFeature = null;
let closeHandlerBound = false;
/** @type {object[]} */
let popupFacilities = [];
let activeFacilityTabIndex = 0;

/**
 * @param {GeoJSON.Feature} feature
 */
export function openPopup(feature) {
  activeFeature = feature;
  state.isImgBig = false;

  const background = document.getElementById('popUpBackground');
  const popup = document.getElementById('popUp');
  const scroll = document.getElementById('popUpScroll');

  background.style.display = 'block';
  popup.style.animation = 'openPopUp 0.5s ease';
  scroll.scrollTop = 0;

  if (!closeHandlerBound) {
    document.getElementById('closePopUp').addEventListener('click', closePopup);
    background.addEventListener('click', (e) => {
      if (e.target === background) closePopup();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && background.style.display === 'block') {
        closePopup();
      }
    });
    closeHandlerBound = true;
  }

  displayInfo();
}

export function closePopup() {
  const background = document.getElementById('popUpBackground');
  const popup = document.getElementById('popUp');

  popup.style.animation = 'closePopUp 0.5s ease';
  resetGallery();

  setTimeout(() => {
    background.style.display = 'none';
  }, 500);
}

function getProps() {
  return activeFeature?.properties;
}

function displayInfo() {
  const props = getProps();
  if (!props) return;

  const unit = String(props.unitOwningTheFacility ?? '').trim();
  const area = String(props.areaInTheCountry ?? '').trim();

  document.getElementById('popUpTitle').textContent = props.nameOfFacility || '';

  const subtitle = document.getElementById('popUpSubTitle');
  if (area) {
    subtitle.hidden = false;
    subtitle.textContent = `אזור ${area}`;
  } else {
    subtitle.hidden = true;
    subtitle.textContent = '';
  }

  const unitText = document.getElementById('unitText');
  unitText.textContent = unit || '—';
  unitText.classList.toggle('is-empty', !unit);

  const contactName = String(props.contactNameOfFacility ?? '').trim();
  const contactRole = String(props.contactRoleOfFacility ?? '').trim();
  const phone = String(props.phoneOfFacility ?? '').trim();
  const personLine = document.getElementById('contactPersonLine');
  const phoneLink = document.getElementById('contactPhoneLink');
  const phoneEmpty = document.getElementById('contactPhoneEmpty');

  const personParts = [contactName, contactRole].filter(Boolean);
  if (personParts.length) {
    personLine.hidden = false;
    personLine.textContent = personParts.join(' · ');
  } else {
    personLine.hidden = true;
    personLine.textContent = '';
  }

  if (phone) {
    phoneLink.hidden = false;
    phoneEmpty.hidden = true;
    phoneLink.textContent = phone;
    phoneLink.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  } else {
    phoneLink.hidden = true;
    phoneLink.removeAttribute('href');
    phoneLink.textContent = '';
    phoneEmpty.hidden = personParts.length > 0;
  }

  if (!phone && !personParts.length) {
    phoneEmpty.hidden = false;
  }

  renderFacilitySections(props.TypesOfFacilities ?? []);
}

/**
 * @param {object} facilityType
 * @param {number} index
 */
function getFacilityTabLabel(facilityType, index) {
  const typeMeta = getFacilityTypeByValue(facilityType?.typeOfFacility);
  const facilityName = String(facilityType?.name || '').trim();
  const typeLabel = typeMeta?.label ?? String(facilityType?.typeOfFacility || '').trim();
  return facilityName || typeLabel || `מתקן ${index + 1}`;
}

/**
 * @param {Array} types
 */
function renderFacilitySections(types) {
  const container = document.getElementById('facilitySections');
  container.innerHTML = '';
  popupFacilities = Array.isArray(types) ? types : [];
  activeFacilityTabIndex = 0;

  if (popupFacilities.length === 0) {
    setupGallery({ imgArr: [] });
    return;
  }

  const block = document.createElement('div');
  block.className = 'facilityBlock';

  const heading = document.createElement('div');
  heading.className = 'facilityBlockHead';
  const headingTitle = document.createElement('p');
  headingTitle.className = 'facilityBlockTitle';
  headingTitle.textContent =
    popupFacilities.length > 1 ? 'מתקנים בנקודה' : 'פרטי מתקן';
  heading.appendChild(headingTitle);
  block.appendChild(heading);

  if (popupFacilities.length > 1) {
    const tabs = document.createElement('div');
    tabs.className = 'facilityPopTabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'מתקנים בנקודה');

    popupFacilities.forEach((facilityType, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `facilityPopTab${index === 0 ? ' is-active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      btn.dataset.index = String(index);
      btn.textContent = getFacilityTabLabel(facilityType, index);
      btn.addEventListener('click', () => selectFacilityTab(index));
      tabs.appendChild(btn);
    });

    block.appendChild(tabs);
  }

  const panel = document.createElement('div');
  panel.id = 'facilityPopPanel';
  panel.className = 'facilitySection';
  panel.setAttribute('role', 'tabpanel');
  block.appendChild(panel);
  container.appendChild(block);

  renderActiveFacilityPanel();
}

/**
 * @param {number} index
 */
function selectFacilityTab(index) {
  if (!Number.isInteger(index) || index === activeFacilityTabIndex) return;
  if (!popupFacilities[index]) return;

  activeFacilityTabIndex = index;

  document.getElementById('facilitySections')
    ?.querySelectorAll('.facilityPopTab')
    .forEach((btn) => {
      const isActive = Number(btn.dataset.index) === index;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

  renderActiveFacilityPanel();
}

function renderActiveFacilityPanel() {
  const panel = document.getElementById('facilityPopPanel');
  const facilityType = popupFacilities[activeFacilityTabIndex];
  if (!panel || !facilityType) return;

  panel.innerHTML = '';

  const typeMeta = getFacilityTypeByValue(facilityType.typeOfFacility);
  const header = document.createElement('div');
  header.className = 'facilitySectionHead';

  const title = document.createElement('h3');
  title.className = 'facilitySectionTitle';
  if (typeMeta) title.classList.add(typeMeta.cssClass);
  title.textContent = getFacilityTabLabel(facilityType, activeFacilityTabIndex);
  header.appendChild(title);

  const statusValue = String(facilityType.statusOfFacility ?? '').trim();
  if (statusValue) {
    const statusMeta = getStatusByValue(statusValue);
    const statusBadge = document.createElement('span');
    statusBadge.className = `statusBadge ${statusMeta?.cssClass ?? getStatusCssClass(statusValue)}`;
    statusBadge.textContent = statusMeta?.label ?? statusValue;
    header.appendChild(statusBadge);
  }
  panel.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'facilityFieldsGrid';

  appendField(grid, 'מיקום בבסיס', facilityType.locationOfFacility, true);
  appendField(grid, 'סוג אימון', facilityType.specificTypeOfFacility, true);
  appendField(grid, 'מסגרת מתאמנת', facilityType.trainingFrame, true);

  const contactName = String(facilityType.contactName ?? '').trim();
  const contactRank = String(facilityType.contactRank ?? '').trim();
  const contactPhone = String(facilityType.contactPhone ?? '').trim();
  if (contactName || contactRank || contactPhone) {
    const contactParts = [contactName, contactRank].filter(Boolean).join(' · ');
    const contactValue = contactPhone
      ? contactParts
        ? `${contactParts} · ${contactPhone}`
        : contactPhone
      : contactParts;
    const contactField = createField('איש קשר למתקן', contactValue);
    if (contactField) {
      contactField.classList.add('popUpFieldWide');
      grid.appendChild(contactField);
    }
  }

  if (grid.childElementCount > 0) {
    panel.appendChild(grid);
  }

  const trainingOptions = (facilityType.trainingOptions ?? [])
    .map((item) => String(item).trim())
    .filter(Boolean);

  const optionsBlock = document.createElement('div');
  optionsBlock.className = 'options';
  const optionsLabel = document.createElement('p');
  optionsLabel.textContent = 'סוגי אימון';
  optionsBlock.appendChild(optionsLabel);

  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'optionsContainer';
  if (trainingOptions.length) {
    trainingOptions.forEach((optionText) => {
      const option = document.createElement('span');
      option.textContent = optionText;
      optionsContainer.appendChild(option);
    });
  } else {
    const empty = document.createElement('span');
    empty.className = 'optionsEmpty';
    empty.textContent = 'לא צוינו סוגי אימון';
    optionsContainer.appendChild(empty);
  }
  optionsBlock.appendChild(optionsContainer);
  panel.appendChild(optionsBlock);

  if (facilityType.comments?.trim()) {
    const comments = document.createElement('div');
    comments.className = 'comments';
    const commentsTitle = document.createElement('p');
    commentsTitle.className = 'commentsTitle';
    commentsTitle.textContent = 'הערות';
    const commentsText = document.createElement('p');
    commentsText.className = 'commentsText';
    commentsText.textContent = facilityType.comments;
    comments.appendChild(commentsTitle);
    comments.appendChild(commentsText);
    panel.appendChild(comments);
  }

  setupGallery({ imgArr: facilityType.imgArr ?? [] });
}

/**
 * @param {HTMLElement} parent
 * @param {string} label
 * @param {unknown} value
 * @param {boolean} [hideIfEmpty=false]
 */
function appendField(parent, label, value, hideIfEmpty = false) {
  const field = createField(label, value, hideIfEmpty);
  if (field) parent.appendChild(field);
}

/**
 * @param {string} label
 * @param {unknown} value
 * @param {boolean} [hideIfEmpty=false]
 */
function createField(label, value, hideIfEmpty = false) {
  const raw = String(value ?? '').trim();
  if (!raw && hideIfEmpty) return null;

  const field = document.createElement('div');
  field.className = 'popUpField';

  const labelEl = document.createElement('p');
  labelEl.className = 'popUpFieldLabel';
  labelEl.textContent = label;

  const text = document.createElement('p');
  text.className = 'popUpFieldValue';
  if (raw) {
    text.textContent = raw;
  } else {
    text.classList.add('is-empty');
    text.textContent = '—';
  }

  field.appendChild(labelEl);
  field.appendChild(text);
  return field;
}
