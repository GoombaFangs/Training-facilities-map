import { getFacilityTypeByValue, getStatusByValue } from '../config/constants.js';
import {
  getFacilityTypeCssClass,
  getStatusCssClass,
} from '../data/optionCatalogs.js';
import { isAdmin, isManagedFacility, getActiveFacilityManager } from '../auth/roleGate.js';
import { deleteFacility } from '../data/loadFacilities.js';
import { state } from '../state.js';
import { addFacilityChangeReport } from '../data/managerReports.js';
import { openEditForm } from './facilityForm.js';
import { closePopup } from './popup.js';

/**
 * @param {HTMLElement} container
 * @param {GeoJSON.Feature[]} features
 * @param {(feature: GeoJSON.Feature) => void} onCardClick
 * @param {() => void} onDataChanged
 */
export function renderCards(container, features, onCardClick, onDataChanged) {
  container.innerHTML = '';
  const admin = isAdmin();

  if (!features.length) {
    const empty = document.createElement('div');
    empty.className = 'cardsEmpty';
    empty.innerHTML = `
      <p class="cardsEmptyTitle">לא נמצאו מתקנים</p>
      <p class="cardsEmptyHint">נסו לשנות את החיפוש או לנקות את הסינון</p>
    `;
    container.appendChild(empty);
    return;
  }

  features.forEach((feature) => {
    const props = feature.properties;
    const card = document.createElement('div');
    card.className = 'card';

    const titleRow = document.createElement('div');
    titleRow.className = 'cardTitleRow';

    const title = document.createElement('h3');
    title.className = 'cardTitle';
    title.textContent = props.nameOfFacility;
    titleRow.appendChild(title);

    if (admin && isManagedFacility(props.id)) {
      const actions = document.createElement('div');
      actions.className = 'cardActions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cardActionBtn cardActionEdit';
      editBtn.innerHTML = `
        <svg class="cardActionIcon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.999-1.66z"/>
        </svg>
        <span>עריכה</span>
      `;
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopup();
        openEditForm(feature);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'cardActionBtn cardActionDelete';
      deleteBtn.innerHTML = `
        <svg class="cardActionIcon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"/>
        </svg>
        <span>מחיקה</span>
      `;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = props.nameOfFacility;
        if (!confirm(`למחוק את המתקן "${name}"?`)) return;
        closePopup();
        deleteFacility(state.facilitiesData, props.id);

        const manager = getActiveFacilityManager();
        if (manager) {
          addFacilityChangeReport({
            type: 'facility_deleted',
            managerId: manager.id,
            managerName: manager.name,
            facilityId: props.id,
            facilityName: name,
          });
        }

        onDataChanged();
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      titleRow.appendChild(actions);
    }

    card.appendChild(titleRow);

    const address = document.createElement('div');
    address.className = 'cardAddress';

    const addressIcon = document.createElement('span');
    addressIcon.className = 'cardAddressIcon';
    address.appendChild(addressIcon);

    const addressText = document.createElement('p');
    addressText.className = 'cardAddressText';
    addressText.textContent = props.locationOfFacility;
    address.appendChild(addressText);
    card.appendChild(address);

    const statusValue = props.statusOfFacility ?? 'פעיל';
    const statusMeta = getStatusByValue(statusValue);
    const status = document.createElement('span');
    status.className = `statusBadge ${statusMeta?.cssClass ?? getStatusCssClass(statusValue)}`;
    status.textContent = statusMeta?.label ?? statusValue;
    card.appendChild(status);

    const tags = document.createElement('div');
    tags.className = 'cardTags';

    (props.TypesOfFacilities ?? []).forEach((facilityType) => {
      const tag = document.createElement('span');
      tag.className = 'cardTag';

      const typeMeta = getFacilityTypeByValue(facilityType.typeOfFacility);
      tag.classList.add(
        typeMeta?.cssClass ?? getFacilityTypeCssClass(facilityType.typeOfFacility),
      );

      const icon = document.createElement('div');
      icon.className = 'tagIcon';
      tag.appendChild(icon);

      const label = document.createElement('p');
      label.className = 'tagType';
      label.textContent = typeMeta?.label ?? facilityType.typeOfFacility;
      tag.appendChild(label);

      tags.appendChild(tag);
    });

    card.appendChild(tags);
    card.addEventListener('click', () => onCardClick(feature));
    container.appendChild(card);
  });
}
