import {
  CATALOG_KEYS,
  CATALOG_LABELS,
  loadOptionCatalogs,
  loadHiddenCatalogs,
  saveOptionCatalogs,
  countCatalogOptionUsage,
  defaultOptionCatalogs,
  defaultHiddenCatalogs,
} from '../data/optionCatalogs.js';
import {
  loadFacilityManagers,
  saveFacilityManagers,
  createManagerId,
} from '../data/facilityManagers.js';
import {
  loadMapRegionLayout,
  saveMapRegionLayout,
  validateMapRegionLayout,
  resolveAreaFromLat,
  DEFAULT_MAP_REGION_LAYOUT,
} from '../data/mapRegionLayout.js';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../config/auth.js';
import { isMainAdmin } from '../auth/roleGate.js';
import { state } from '../state.js';
import { saveFacilities } from '../data/storage.js';

/** @type {(() => void) | null} */
let onCatalogsChanged = null;

/** @type {Record<string, string[]>} */
let draft = {};
/** @type {Record<string, string[]>} */
let hiddenDraft = {};
/** @type {import('../data/facilityManagers.js').FacilityManager[]} */
let usersDraft = [];
/** @type {Set<string>} */
let expandedUserIds = new Set();
/** @type {{ northFromLat: string, southBelowLat: string }} */
let mapLayoutDraft = {
  northFromLat: String(DEFAULT_MAP_REGION_LAYOUT.northFromLat),
  southBelowLat: String(DEFAULT_MAP_REGION_LAYOUT.southBelowLat),
};
/** @type {import('../data/optionCatalogs.js').CatalogKey} */
let activeKey = 'facilityTypes';
/** @type {'options' | 'users' | 'mapLayout'} */
let activeTab = 'options';
let isClosing = false;
let closeTimer = 0;

/**
 * @param {{ onCatalogsChanged?: () => void }} [options]
 */
export function initSettingsPanel(options = {}) {
  onCatalogsChanged = options.onCatalogsChanged ?? null;

  document.getElementById('settingsClose')?.addEventListener('click', () => closeSettingsPanel());
  document.getElementById('settingsCancel')?.addEventListener('click', () => closeSettingsPanel());
  document.getElementById('settingsSave')?.addEventListener('click', saveSettings);
  document.getElementById('settingsAddItem')?.addEventListener('click', addDraftItem);
  document.getElementById('settingsResetOptions')?.addEventListener('click', resetOptionsDraft);
  document.getElementById('settingsAddUser')?.addEventListener('click', addUserDraftItem);

  document.querySelectorAll('[data-settings-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.settingsTab;
      if (tab === 'options' || tab === 'users' || tab === 'mapLayout') setActiveTab(tab);
    });
  });

  document.getElementById('settingsBackdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'settingsBackdrop') closeSettingsPanel();
  });

  bindMapLayoutInputs();
  renderNav();
}

export function openSettingsPanel() {
  if (!isMainAdmin()) return;

  const backdrop = document.getElementById('settingsBackdrop');
  if (!backdrop) return;

  window.clearTimeout(closeTimer);
  isClosing = false;
  draft = structuredClone(loadOptionCatalogs());
  hiddenDraft = structuredClone(loadHiddenCatalogs());
  usersDraft = structuredClone(loadFacilityManagers()).map((user) => ({
    ...user,
    facilityIds: [...(user.facilityIds ?? [])],
  }));
  expandedUserIds = new Set();
  const layout = loadMapRegionLayout();
  mapLayoutDraft = {
    northFromLat: layout.northFromLat.toFixed(6),
    southBelowLat: layout.southBelowLat.toFixed(6),
  };
  activeKey = CATALOG_KEYS[0];
  activeTab = 'options';

  backdrop.hidden = false;
  backdrop.classList.remove('is-closing');
  void backdrop.offsetWidth;
  backdrop.classList.add('is-opening');

  clearSettingsError();
  clearUsersError();
  clearMapLayoutError();
  setActiveTab('options');
  renderNav();
  renderActiveList();
  renderUsersList();
  renderMapLayoutFields();
}

/**
 * @param {{ animate?: boolean }} [options]
 */
export function closeSettingsPanel(options = {}) {
  const { animate = true } = options;
  const backdrop = document.getElementById('settingsBackdrop');
  if (!backdrop || backdrop.hidden || isClosing) return;

  if (!animate) {
    finishClose(backdrop);
    return;
  }

  isClosing = true;
  backdrop.classList.remove('is-opening');
  backdrop.classList.add('is-closing');

  const panel = backdrop.querySelector('.settingsPanel');
  const finish = (event) => {
    if (event && event.target !== panel) return;
    panel?.removeEventListener('animationend', finish);
    window.clearTimeout(closeTimer);
    finishClose(backdrop);
  };

  panel?.addEventListener('animationend', finish);
  window.clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => finish(), 380);
}

/**
 * @param {HTMLElement} backdrop
 */
function finishClose(backdrop) {
  isClosing = false;
  window.clearTimeout(closeTimer);
  closeTimer = 0;
  backdrop.hidden = true;
  backdrop.classList.remove('is-opening', 'is-closing');
}

/**
 * @param {'options' | 'users' | 'mapLayout'} tab
 */
function setActiveTab(tab) {
  activeTab = tab;
  clearSettingsError();
  clearUsersError();
  clearMapLayoutError();

  document.querySelectorAll('[data-settings-tab]').forEach((btn) => {
    const isActive = btn.dataset.settingsTab === tab;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const optionsSection = document.getElementById('settingsOptionsSection');
  const usersSection = document.getElementById('settingsUsersSection');
  const mapLayoutSection = document.getElementById('settingsMapLayoutSection');
  if (optionsSection) optionsSection.hidden = tab !== 'options';
  if (usersSection) usersSection.hidden = tab !== 'users';
  if (mapLayoutSection) mapLayoutSection.hidden = tab !== 'mapLayout';

  const saveBtn = document.getElementById('settingsSave');
  if (saveBtn) saveBtn.hidden = false;

  if (tab === 'mapLayout') renderMapLayoutFields();
}

function bindMapLayoutInputs() {
  const northInput = document.getElementById('settingsNorthFromLat');
  const southInput = document.getElementById('settingsSouthBelowLat');
  northInput?.addEventListener('input', () => {
    mapLayoutDraft.northFromLat = northInput.value;
  });
  southInput?.addEventListener('input', () => {
    mapLayoutDraft.southBelowLat = southInput.value;
  });
}

function renderMapLayoutFields() {
  const northInput = document.getElementById('settingsNorthFromLat');
  const southInput = document.getElementById('settingsSouthBelowLat');
  if (northInput) northInput.value = mapLayoutDraft.northFromLat;
  if (southInput) southInput.value = mapLayoutDraft.southBelowLat;
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function parseLayoutCoordinate(raw) {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function renderNav() {
  const nav = document.getElementById('settingsNav');
  if (!nav) return;

  nav.innerHTML = CATALOG_KEYS.map(
    (key) => `
      <button
        type="button"
        class="settingsNavBtn${key === activeKey ? ' is-active' : ''}"
        data-catalog="${key}"
      >${CATALOG_LABELS[key]}</button>
    `,
  ).join('');

  nav.querySelectorAll('.settingsNavBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeKey = /** @type {import('../data/optionCatalogs.js').CatalogKey} */ (
        btn.dataset.catalog
      );
      clearSettingsError();
      renderNav();
      renderActiveList();
    });
  });
}

function renderActiveList() {
  const title = document.getElementById('settingsListTitle');
  const list = document.getElementById('settingsList');
  if (!title || !list) return;

  title.textContent = CATALOG_LABELS[activeKey];
  const items = draft[activeKey] ?? [];

  list.innerHTML = items
    .map(
      (value, index) => `
      <li class="settingsItem" data-index="${index}">
        <input
          type="text"
          class="settingsItemInput"
          value="${escapeAttr(value)}"
          aria-label="אפשרות ${index + 1}"
        />
        <div class="settingsItemActions">
          <button type="button" class="settingsIconBtn" data-action="up" title="הזז למעלה" aria-label="הזז למעלה" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="settingsIconBtn" data-action="down" title="הזז למטה" aria-label="הזז למטה" ${index === items.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="settingsIconBtn settingsIconBtnDanger" data-action="remove" title="מחק" aria-label="מחק">×</button>
        </div>
      </li>
    `,
    )
    .join('');

  list.querySelectorAll('.settingsItemInput').forEach((input) => {
    input.addEventListener('input', () => {
      const row = input.closest('.settingsItem');
      const index = Number(row?.dataset.index);
      if (!Number.isInteger(index)) return;
      draft[activeKey][index] = input.value;
    });
  });

  list.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.settingsItem');
      const index = Number(row?.dataset.index);
      const action = btn.dataset.action;
      if (!Number.isInteger(index) || !action) return;
      handleItemAction(action, index);
    });
  });
}

/**
 * @param {string} action
 * @param {number} index
 */
function handleItemAction(action, index) {
  const items = draft[activeKey];
  if (!items) return;

  if (action === 'up' && index > 0) {
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
  } else if (action === 'down' && index < items.length - 1) {
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
  } else if (action === 'remove') {
    const value = String(items[index] ?? '').trim();
    if (!value) {
      items.splice(index, 1);
      clearSettingsError();
      renderActiveList();
      return;
    }

    const usageCount = countCatalogOptionUsage(activeKey, value, state.facilitiesData);
    const label = CATALOG_LABELS[activeKey];

    let confirmMessage;
    if (usageCount > 0) {
      confirmMessage =
        usageCount === 1
          ? `האפשרות "${value}" בשימוש במתקן אחד.\n\nהאם להסיר אותה מרשימת "${label}"?\nהמתקן הקיים יישמר, אך לא ניתן יהיה לבחור אפשרות זו ביצירה חדשה.`
          : `האפשרות "${value}" בשימוש ב-${usageCount} מתקנים.\n\nהאם להסיר אותה מרשימת "${label}"?\nהמתקנים הקיימים יישמרו, אך לא ניתן יהיה לבחור אפשרות זו ביצירה חדשה.`;
    } else {
      if (items.length <= 1) {
        showSettingsError('חייבת להישאר לפחות אפשרות אחת ברשימה');
        return;
      }
      confirmMessage = `למחוק את האפשרות "${value}" מרשימת "${label}"?`;
    }

    if (!window.confirm(confirmMessage)) return;

    items.splice(index, 1);

    if (usageCount > 0) {
      if (!hiddenDraft[activeKey]) hiddenDraft[activeKey] = [];
      if (!hiddenDraft[activeKey].includes(value)) {
        hiddenDraft[activeKey].push(value);
      }
    } else if (hiddenDraft[activeKey]) {
      hiddenDraft[activeKey] = hiddenDraft[activeKey].filter((item) => item !== value);
    }
  } else {
    return;
  }

  clearSettingsError();
  renderActiveList();
}

function addDraftItem() {
  if (!draft[activeKey]) draft[activeKey] = [];
  draft[activeKey].push('');
  clearSettingsError();
  renderActiveList();

  const list = document.getElementById('settingsList');
  const lastInput = list?.querySelector('.settingsItem:last-child .settingsItemInput');
  lastInput?.focus();
}

function resetOptionsDraft() {
  const confirmMessage =
    'לאפס את כל רשימות האפשרויות לברירת המחדל?\n\nכל השינויים שביצעתם ברשימות יוחלפו בערכי ברירת המחדל. לחצו "שמור" כדי לשמור את האיפוס.';

  if (!window.confirm(confirmMessage)) return;

  draft = structuredClone(defaultOptionCatalogs());
  hiddenDraft = structuredClone(defaultHiddenCatalogs());
  activeKey = CATALOG_KEYS[0];

  clearSettingsError();
  renderNav();
  renderActiveList();
}

function getFacilityOptions() {
  const features = state.facilitiesData?.features ?? [];
  return features
    .map((feature) => ({
      id: String(feature.properties?.id ?? ''),
      name: String(feature.properties?.nameOfFacility ?? '').trim(),
    }))
    .filter((item) => item.id && item.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

function renderUsersList() {
  const list = document.getElementById('settingsUsersList');
  if (!list) return;

  if (usersDraft.length === 0) {
    list.innerHTML = `
      <li class="settingsUsersEmpty">עדיין אין מנהלי מתקן. לחצו על ״הוסף מנהל״ כדי ליצור.</li>
    `;
    return;
  }

  const facilities = getFacilityOptions();

  list.innerHTML = usersDraft
    .map((user, index) => {
      const selected = new Set(user.facilityIds ?? []);
      const facilitiesHtml =
        facilities.length === 0
          ? `<p class="settingsUserFacilitiesEmpty">אין מתקנים בפרויקט עדיין.</p>`
          : `
            <div class="settingsUserFacilitiesList" role="group" aria-label="מתקנים בניהול">
              ${facilities
                .map(
                  (facility) => `
                <label class="settingsUserFacilityCheck">
                  <input
                    type="checkbox"
                    data-facility-id="${escapeAttr(facility.id)}"
                    ${selected.has(facility.id) ? 'checked' : ''}
                  />
                  <span>${escapeHtml(facility.name)}</span>
                </label>
              `,
                )
                .join('')}
            </div>
          `;

      const isExpanded = expandedUserIds.has(user.id);
      return `
      <li class="settingsUserItem${isExpanded ? ' is-expanded' : ''}" data-index="${index}" data-user-id="${escapeAttr(user.id)}">
        <div class="settingsUserHeader">
          <button
            type="button"
            class="settingsUserToggle"
            data-action="toggle-user"
            aria-expanded="${isExpanded ? 'true' : 'false'}"
            aria-label="${isExpanded ? 'סגור פרטים' : 'הצג פרטים'}"
          >
            <span class="settingsUserToggleIcon" aria-hidden="true"></span>
          </button>
          <label class="settingsUserField">
            <span>שם</span>
            <input
              type="text"
              class="settingsItemInput"
              data-field="name"
              value="${escapeAttr(user.name)}"
              placeholder="שם מנהל המתקן"
            />
          </label>
          <label class="settingsUserField">
            <span>מספר אישי</span>
            <input
              type="text"
              class="settingsItemInput"
              data-field="personalNumber"
              value="${escapeAttr(user.personalNumber ?? '')}"
              placeholder="מספר אישי"
              inputmode="numeric"
              autocomplete="off"
            />
          </label>
          <button
            type="button"
            class="settingsIconBtn settingsIconBtnDanger settingsUserRemove"
            data-action="remove-user"
            title="מחק מנהל"
            aria-label="מחק מנהל"
          >×</button>
        </div>
        <div class="settingsUserDetails">
          <div class="settingsUserDetailsInner">
            <label class="settingsUserField settingsUserFieldPassword">
              <span>סיסמה</span>
              <input
                type="text"
                class="settingsItemInput"
                data-field="password"
                value="${escapeAttr(user.password)}"
                placeholder="סיסמה לכניסה"
                autocomplete="off"
              />
            </label>
            <div class="settingsUserFacilities">
              <span class="settingsUserFacilitiesLabel">מתקנים בניהול</span>
              ${facilitiesHtml}
            </div>
          </div>
        </div>
      </li>
    `;
    })
    .join('');

  list.querySelectorAll('.settingsUserItem input[data-field]').forEach((input) => {
    input.addEventListener('input', () => {
      const row = input.closest('.settingsUserItem');
      const index = Number(row?.dataset.index);
      const field = input.dataset.field;
      if (!Number.isInteger(index) || !field) return;
      usersDraft[index][field] = input.value;
    });
  });

  list.querySelectorAll('.settingsUserFacilityCheck input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const row = checkbox.closest('.settingsUserItem');
      const index = Number(row?.dataset.index);
      if (!Number.isInteger(index)) return;
      const checked = [
        ...row.querySelectorAll('.settingsUserFacilityCheck input:checked'),
      ].map((el) => el.dataset.facilityId).filter(Boolean);
      usersDraft[index].facilityIds = checked;
    });
  });

  list.querySelectorAll('[data-action="remove-user"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.settingsUserItem');
      const index = Number(row?.dataset.index);
      if (!Number.isInteger(index)) return;
      const userId = usersDraft[index]?.id;
      if (userId) expandedUserIds.delete(userId);
      usersDraft.splice(index, 1);
      clearUsersError();
      renderUsersList();
    });
  });

  list.querySelectorAll('[data-action="toggle-user"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.settingsUserItem');
      const userId = row?.dataset.userId;
      if (!row || !userId) return;

      const willExpand = !row.classList.contains('is-expanded');
      row.classList.toggle('is-expanded', willExpand);
      btn.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
      btn.setAttribute('aria-label', willExpand ? 'סגור פרטים' : 'הצג פרטים');

      if (willExpand) expandedUserIds.add(userId);
      else expandedUserIds.delete(userId);
    });
  });
}

function addUserDraftItem() {
  const id = createManagerId();
  usersDraft.push({
    id,
    name: '',
    personalNumber: '',
    password: '',
    facilityIds: [],
  });
  expandedUserIds.add(id);
  clearUsersError();
  renderUsersList();

  const list = document.getElementById('settingsUsersList');
  const lastInput = list?.querySelector(
    '.settingsUserItem:last-child input[data-field="name"]',
  );
  lastInput?.focus();
}

function saveSettings() {
  clearSettingsError();
  clearUsersError();
  clearMapLayoutError();

  /** @type {Record<string, string[]>} */
  const cleaned = {};

  for (const key of CATALOG_KEYS) {
    const seen = new Set();
    const next = [];
    for (const raw of draft[key] ?? []) {
      const value = String(raw ?? '').trim();
      if (!value) {
        showSettingsError(`ברשימת "${CATALOG_LABELS[key]}" יש שדה ריק — מלאו או מחקו`);
        setActiveTab('options');
        activeKey = key;
        renderNav();
        renderActiveList();
        return;
      }
      if (seen.has(value)) {
        showSettingsError(`ברשימת "${CATALOG_LABELS[key]}" יש ערך כפול: ${value}`);
        setActiveTab('options');
        activeKey = key;
        renderNav();
        renderActiveList();
        return;
      }
      seen.add(value);
      next.push(value);
    }
    if (next.length === 0 && (hiddenDraft[key] ?? []).length === 0) {
      showSettingsError(`לא ניתן לשמור רשימה ריקה (${CATALOG_LABELS[key]})`);
      setActiveTab('options');
      activeKey = key;
      renderNav();
      renderActiveList();
      return;
    }
    cleaned[key] = next;
  }

  /** @type {Record<string, string[]>} */
  const cleanedHidden = {};
  for (const key of CATALOG_KEYS) {
    const activeSet = new Set(cleaned[key] ?? []);
    cleanedHidden[key] = (hiddenDraft[key] ?? [])
      .map((raw) => String(raw ?? '').trim())
      .filter((value) => value && !activeSet.has(value));
  }

  const cleanedUsers = [];
  const usedPasswords = new Set([ADMIN_PASSWORD]);
  const usedPersonalNumbers = new Set();

  for (let i = 0; i < usersDraft.length; i++) {
    const name = String(usersDraft[i].name ?? '').trim();
    const personalNumber = String(usersDraft[i].personalNumber ?? '').trim();
    const password = String(usersDraft[i].password ?? '');
    if (!name && !personalNumber && !password) continue;
    if (!name || !personalNumber || !password) {
      showUsersError('לכל מנהל מתקן חובה למלא שם, מספר אישי וסיסמה');
      setActiveTab('users');
      renderUsersList();
      return;
    }
    if (usedPersonalNumbers.has(personalNumber)) {
      showUsersError(`המספר האישי של "${name}" כבר בשימוש — הזינו מספר ייחודי`);
      setActiveTab('users');
      renderUsersList();
      return;
    }
    if (usedPasswords.has(password)) {
      showUsersError(`הסיסמה של "${name}" כבר בשימוש — בחרו סיסמה ייחודית`);
      setActiveTab('users');
      renderUsersList();
      return;
    }
    if (name === ADMIN_USERNAME || name.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
      showUsersError(`לא ניתן להשתמש בשם "${ADMIN_USERNAME}" — השם שמור למנהל הראשי`);
      setActiveTab('users');
      renderUsersList();
      return;
    }
    usedPersonalNumbers.add(personalNumber);
    usedPasswords.add(password);
    cleanedUsers.push({
      id: usersDraft[i].id || createManagerId(),
      name,
      personalNumber,
      password,
      facilityIds: [...(usersDraft[i].facilityIds ?? [])],
    });
  }

  const northFromLat = parseLayoutCoordinate(mapLayoutDraft.northFromLat);
  const southBelowLat = parseLayoutCoordinate(mapLayoutDraft.southBelowLat);
  if (northFromLat == null || southBelowLat == null) {
    showMapLayoutError('יש להזין קווי רוחב תקינים לפריסת המפה');
    setActiveTab('mapLayout');
    return;
  }

  const layout = { northFromLat, southBelowLat };
  const layoutError = validateMapRegionLayout(layout);
  if (layoutError) {
    showMapLayoutError(layoutError);
    setActiveTab('mapLayout');
    return;
  }

  saveOptionCatalogs(/** @type {any} */ (cleaned), /** @type {any} */ (cleanedHidden));
  saveFacilityManagers(cleanedUsers);
  saveMapRegionLayout(layout);
  reclassifyFacilitiesByLayout(layout);
  onCatalogsChanged?.();
  closeSettingsPanel();
}

/**
 * Update every facility's area from the current latitude bands.
 * @param {import('../data/mapRegionLayout.js').MapRegionLayout} layout
 */
function reclassifyFacilitiesByLayout(layout) {
  if (!state.facilitiesData?.features) return;

  let changed = false;
  for (const feature of state.facilitiesData.features) {
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat)) continue;
    const area = resolveAreaFromLat(lat, layout);
    if (feature.properties?.areaInTheCountry !== area) {
      feature.properties.areaInTheCountry = area;
      changed = true;
    }
  }

  if (changed) saveFacilities(state.facilitiesData);
}

function showSettingsError(message) {
  const el = document.getElementById('settingsError');
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
}

function clearSettingsError() {
  const el = document.getElementById('settingsError');
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}

function showUsersError(message) {
  const el = document.getElementById('settingsUsersError');
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
}

function clearUsersError() {
  const el = document.getElementById('settingsUsersError');
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}

function showMapLayoutError(message) {
  const el = document.getElementById('settingsMapLayoutError');
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
}

function clearMapLayoutError() {
  const el = document.getElementById('settingsMapLayoutError');
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
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
