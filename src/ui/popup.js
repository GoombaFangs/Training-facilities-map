import { state } from '../state.js';
import { getFacilityTypeByValue, getStatusByValue } from '../config/constants.js';
import { getStatusCssClass } from '../data/optionCatalogs.js';
import { setupGallery, resetGallery } from './gallery.js';

let activeFeature = null;
let closeHandlerBound = false;

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
  setupGallery({ imgArr: collectAllImages() });
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

function collectAllImages() {
  const types = getProps()?.TypesOfFacilities ?? [];
  return types.flatMap((type) => type.imgArr ?? []);
}

function displayInfo() {
  const props = getProps();
  if (!props) return;

  document.getElementById('popUpTitle').textContent = props.nameOfFacility;
  document.getElementById('popUpSubTitle').textContent = props.locationOfFacility;
  document.getElementById('unitText').textContent = props.unitOwningTheFacility;

  const statusEl = document.getElementById('statusText');
  const statusValue = props.statusOfFacility ?? 'פעיל';
  const statusMeta = getStatusByValue(statusValue);
  statusEl.textContent = statusMeta?.label ?? statusValue;
  statusEl.className = `statusBadge ${statusMeta?.cssClass ?? getStatusCssClass(statusValue)}`;

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
 * @param {Array} types
 */
function renderFacilitySections(types) {
  const container = document.getElementById('facilitySections');
  container.innerHTML = '';

  types.forEach((facilityType) => {
    const section = document.createElement('section');
    section.className = 'facilitySection';

    const typeMeta = getFacilityTypeByValue(facilityType.typeOfFacility);
    const heading = document.createElement('h3');
    heading.className = 'facilitySectionTitle';
    if (typeMeta) {
      heading.classList.add(typeMeta.cssClass);
    }
    heading.textContent = typeMeta?.label ?? facilityType.typeOfFacility;
    section.appendChild(heading);

    section.appendChild(
      createField('סוג אימון', facilityType.specificTypeOfFacility),
    );
    section.appendChild(
      createField('מסגרת מתאמנת', facilityType.trainingFrame),
    );

    const optionsBlock = document.createElement('div');
    optionsBlock.className = 'options';
    const optionsLabel = document.createElement('p');
    optionsLabel.textContent = 'סוגי אימון';
    optionsBlock.appendChild(optionsLabel);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'optionsContainer';
    (facilityType.trainingOptions ?? []).forEach((optionText) => {
      const option = document.createElement('span');
      option.textContent = String(optionText).trim();
      optionsContainer.appendChild(option);
    });
    optionsBlock.appendChild(optionsContainer);
    section.appendChild(optionsBlock);

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
      section.appendChild(comments);
    }

    container.appendChild(section);
  });
}

function createField(label, value) {
  const field = document.createElement('div');
  field.className = 'popUpField';

  const labelEl = document.createElement('p');
  labelEl.className = 'popUpFieldLabel';
  labelEl.textContent = label;

  const text = document.createElement('p');
  text.className = 'popUpFieldValue';
  text.textContent = value ?? '';

  field.appendChild(labelEl);
  field.appendChild(text);
  return field;
}
