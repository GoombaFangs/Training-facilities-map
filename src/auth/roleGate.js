import { ADMIN_USERNAME, ADMIN_PASSWORD, ROLES } from '../config/auth.js';
import { state } from '../state.js';
import {
  findFacilityManagerByPassword,
  findFacilityManagerByName,
  findFacilityManagerByPersonalNumber,
  getManagerInitial,
  loadFacilityManagers,
} from '../data/facilityManagers.js';
import {
  addForgotPasswordReport,
  addManagerAccessRequest,
  isPasswordUsedInPendingRequests,
} from '../data/managerReports.js';

/**
 * Show role selection gate. Resolves with selected role.
 * @returns {Promise<'guest' | 'admin'>}
 */
export function showRoleGate() {
  return new Promise((resolve) => {
    const gate = document.getElementById('roleGate');
    const card = gate?.querySelector('.roleGateCard');
    const intro = document.getElementById('roleGateIntro');
    const passwordPanel = document.getElementById('adminPasswordPanel');
    const forgotPanel = document.getElementById('forgotPasswordPanel');
    const requestPanel = document.getElementById('managerRequestPanel');
    const backBtn = document.getElementById('roleGateBack');
    const passwordInput = document.getElementById('adminPassword');
    const usernameInput = document.getElementById('adminUsername');
    const passwordError = document.getElementById('adminPasswordError');
    const forgotName = document.getElementById('forgotPasswordName');
    const forgotPersonalNumber = document.getElementById('forgotPasswordPersonalNumber');
    const forgotPhone = document.getElementById('forgotPasswordPhone');
    const forgotError = document.getElementById('forgotPasswordError');
    const forgotSuccess = document.getElementById('forgotPasswordSuccess');
    const requestName = document.getElementById('managerRequestName');
    const requestPersonalNumber = document.getElementById('managerRequestPersonalNumber');
    const requestPassword = document.getElementById('managerRequestPassword');
    const requestError = document.getElementById('managerRequestError');
    const requestSuccess = document.getElementById('managerRequestSuccess');
    const requestFacilities = document.getElementById('managerRequestFacilities');

    /** @type {'intro' | 'password' | 'forgot' | 'request'} */
    let panel = 'intro';

    gate.hidden = false;
    gate.classList.remove('is-leaving');
    passwordInput.value = '';
    passwordError.hidden = true;
    state.facilityManager = null;
    resetForgotForm();
    resetRequestForm();
    showIntro();

    const finish = (role, manager = null) => {
      state.role = role;
      state.facilityManager = manager
        ? {
            id: manager.id,
            name: manager.name,
            facilityIds: [...(manager.facilityIds ?? [])],
          }
        : null;
      gate.classList.add('is-leaving');
      window.setTimeout(() => {
        gate.hidden = true;
        gate.classList.remove('is-leaving');
        resolve(role);
      }, 420);
    };

    function setBackVisible(visible) {
      if (backBtn) backBtn.hidden = !visible;
    }

    function setCardWide(wide) {
      card?.classList.toggle('is-wide', wide);
    }

    function hideAllPanels() {
      intro.hidden = true;
      passwordPanel.hidden = true;
      if (forgotPanel) forgotPanel.hidden = true;
      if (requestPanel) requestPanel.hidden = true;
    }

    function resetForgotForm() {
      if (forgotName) forgotName.value = '';
      if (forgotPersonalNumber) forgotPersonalNumber.value = '';
      if (forgotPhone) forgotPhone.value = '';
      if (forgotError) {
        forgotError.hidden = true;
        forgotError.textContent = '';
      }
      if (forgotSuccess) {
        forgotSuccess.hidden = true;
        forgotSuccess.textContent = '';
      }
    }

    function resetRequestForm() {
      if (requestName) requestName.value = '';
      if (requestPersonalNumber) requestPersonalNumber.value = '';
      if (requestPassword) requestPassword.value = '';
      if (requestError) {
        requestError.hidden = true;
        requestError.textContent = '';
      }
      if (requestSuccess) {
        requestSuccess.hidden = true;
        requestSuccess.textContent = '';
      }
      requestFacilities?.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        el.checked = false;
      });
    }

    function showIntro() {
      panel = 'intro';
      hideAllPanels();
      intro.hidden = false;
      setBackVisible(false);
      setCardWide(false);
      passwordInput.value = '';
      if (usernameInput) usernameInput.value = '';
      passwordError.hidden = true;
      resetForgotForm();
      resetRequestForm();
    }

    function showAdminPassword() {
      panel = 'password';
      hideAllPanels();
      passwordPanel.hidden = false;
      setBackVisible(true);
      setCardWide(false);
      resetForgotForm();
      resetRequestForm();
      passwordError.hidden = true;
      if (usernameInput) usernameInput.value = '';
      passwordInput.value = '';
      usernameInput?.focus();
    }

    function showForgotPassword() {
      panel = 'forgot';
      hideAllPanels();
      if (forgotPanel) forgotPanel.hidden = false;
      setBackVisible(true);
      setCardWide(false);
      passwordError.hidden = true;
      resetForgotForm();
      forgotName?.focus();
    }

    function showManagerRequest() {
      panel = 'request';
      hideAllPanels();
      if (requestPanel) requestPanel.hidden = false;
      setBackVisible(true);
      setCardWide(true);
      passwordError.hidden = true;
      resetRequestForm();
      renderRequestFacilities();
      requestName?.focus();
    }

    function renderRequestFacilities() {
      if (!requestFacilities) return;
      const features = state.facilitiesData?.features ?? [];
      const options = features
        .map((feature) => ({
          id: String(feature.properties?.id ?? ''),
          name: String(feature.properties?.nameOfFacility ?? '').trim(),
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'he'));

      if (options.length === 0) {
        requestFacilities.innerHTML =
          '<p class="managerRequestFacilitiesEmpty">אין מתקנים במערכת כרגע.</p>';
        return;
      }

      requestFacilities.innerHTML = options
        .map(
          (facility) => `
          <label class="managerRequestFacilityCheck">
            <input type="checkbox" data-facility-id="${escapeAttr(facility.id)}" data-facility-name="${escapeAttr(facility.name)}" />
            <span>${escapeHtml(facility.name)}</span>
          </label>
        `,
        )
        .join('');
    }

    function getSelectedRequestFacilities() {
      if (!requestFacilities) return [];
      return [...requestFacilities.querySelectorAll('input[type="checkbox"]:checked')].map(
        (el) => ({
          id: el.dataset.facilityId ?? '',
          name: el.dataset.facilityName ?? '',
        }),
      );
    }

    document.getElementById('chooseGuest').onclick = () => {
      finish(ROLES.GUEST);
    };

    document.getElementById('chooseAdmin').onclick = () => {
      showAdminPassword();
    };

    if (backBtn) {
      backBtn.onclick = () => {
        if (panel === 'forgot' || panel === 'request') {
          showAdminPassword();
          return;
        }
        showIntro();
      };
    }

    document.getElementById('forgotPasswordOpen').onclick = () => {
      showForgotPassword();
    };

    document.getElementById('managerRequestOpen').onclick = () => {
      showManagerRequest();
    };

    document.getElementById('adminPasswordSubmit').onclick = () => {
      const username = String(usernameInput?.value ?? '').trim();
      const password = passwordInput.value;
      passwordError.hidden = true;

      if (!username || !password) {
        passwordError.textContent = 'יש למלא שם וסיסמה';
        passwordError.hidden = false;
        (username ? passwordInput : usernameInput)?.focus();
        return;
      }

      if (
        username === ADMIN_USERNAME &&
        password === ADMIN_PASSWORD
      ) {
        finish(ROLES.ADMIN, null);
        return;
      }

      const manager = loadFacilityManagers().find(
        (item) =>
          item.name.trim().toLowerCase() === username.toLowerCase() &&
          item.password === password,
      );
      if (manager) {
        finish(ROLES.ADMIN, manager);
        return;
      }

      passwordError.textContent = 'שם או סיסמה שגויים';
      passwordError.hidden = false;
      passwordInput.select();
    };

    document.getElementById('forgotPasswordSubmit').onclick = () => {
      const name = String(forgotName?.value ?? '').trim();
      const personalNumber = String(forgotPersonalNumber?.value ?? '').trim();
      const phone = String(forgotPhone?.value ?? '').trim();

      if (forgotError) {
        forgotError.hidden = true;
        forgotError.textContent = '';
      }
      if (forgotSuccess) {
        forgotSuccess.hidden = true;
        forgotSuccess.textContent = '';
      }

      if (!name || !personalNumber || !phone) {
        if (forgotError) {
          forgotError.textContent = 'יש למלא שם, מספר אישי ומספר טלפון';
          forgotError.hidden = false;
        }
        return;
      }

      const manager = findFacilityManagerByName(name);
      if (!manager) {
        if (forgotError) {
          forgotError.textContent = 'השם לא נמצא במערכת';
          forgotError.hidden = false;
        }
        forgotName?.select();
        return;
      }

      if (manager.personalNumber !== personalNumber) {
        if (forgotError) {
          forgotError.textContent = 'המספר האישי אינו תואם לשם שהוזן';
          forgotError.hidden = false;
        }
        forgotPersonalNumber?.select();
        return;
      }

      addForgotPasswordReport({
        managerId: manager.id,
        managerName: manager.name,
        personalNumber: manager.personalNumber,
        phone,
      });

      if (forgotSuccess) {
        forgotSuccess.textContent =
          'הבקשה נשלחה למנהל הראשי. ניתן לחזור לכניסה או להמתין ליצירת קשר.';
        forgotSuccess.hidden = false;
      }
      if (forgotName) forgotName.value = manager.name;
      if (forgotPersonalNumber) forgotPersonalNumber.value = manager.personalNumber;
      if (forgotPhone) forgotPhone.value = '';
    };

    document.getElementById('managerRequestSubmit').onclick = () => {
      const name = String(requestName?.value ?? '').trim();
      const personalNumber = String(requestPersonalNumber?.value ?? '').trim();
      const password = String(requestPassword?.value ?? '');
      const selected = getSelectedRequestFacilities().filter((f) => f.id);

      if (requestError) {
        requestError.hidden = true;
        requestError.textContent = '';
      }
      if (requestSuccess) {
        requestSuccess.hidden = true;
        requestSuccess.textContent = '';
      }

      if (!name || !personalNumber || !password) {
        if (requestError) {
          requestError.textContent = 'יש למלא שם, מספר אישי וסיסמה';
          requestError.hidden = false;
        }
        return;
      }

      if (selected.length === 0) {
        if (requestError) {
          requestError.textContent = 'יש לבחור לפחות מתקן אחד';
          requestError.hidden = false;
        }
        return;
      }

      if (password === ADMIN_PASSWORD || findFacilityManagerByPassword(password)) {
        if (requestError) {
          requestError.textContent = 'הסיסמה כבר בשימוש — בחרו סיסמה אחרת';
          requestError.hidden = false;
        }
        requestPassword?.select();
        return;
      }

      if (isPasswordUsedInPendingRequests(password)) {
        if (requestError) {
          requestError.textContent = 'הסיסמה כבר מופיעה בבקשה ממתינה — בחרו סיסמה אחרת';
          requestError.hidden = false;
        }
        requestPassword?.select();
        return;
      }

      if (findFacilityManagerByName(name) || name === ADMIN_USERNAME) {
        if (requestError) {
          requestError.textContent = 'השם כבר קיים במערכת כמנהל מתקן';
          requestError.hidden = false;
        }
        requestName?.select();
        return;
      }

      if (findFacilityManagerByPersonalNumber(personalNumber)) {
        if (requestError) {
          requestError.textContent = 'המספר האישי כבר קיים במערכת';
          requestError.hidden = false;
        }
        requestPersonalNumber?.select();
        return;
      }

      addManagerAccessRequest({
        managerName: name,
        personalNumber,
        password,
        facilityIds: selected.map((f) => f.id),
        facilityNames: selected.map((f) => f.name),
      });

      if (requestSuccess) {
        requestSuccess.textContent =
          'הבקשה נשלחה לאישור המנהל הראשי. לאחר האישור תוכלו להיכנס עם הסיסמה שבחרתם.';
        requestSuccess.hidden = false;
      }
      if (requestName) requestName.value = '';
      if (requestPersonalNumber) requestPersonalNumber.value = '';
      if (requestPassword) requestPassword.value = '';
      requestFacilities?.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        el.checked = false;
      });
    };

    passwordInput.onkeydown = (event) => {
      if (event.key === 'Enter') {
        document.getElementById('adminPasswordSubmit').click();
      }
    };

    if (usernameInput) {
      usernameInput.onkeydown = (event) => {
        if (event.key === 'Enter') {
          passwordInput.focus();
        }
      };
    }

    const forgotSubmitOnEnter = (event) => {
      if (event.key === 'Enter') {
        document.getElementById('forgotPasswordSubmit')?.click();
      }
    };
    if (forgotName) forgotName.onkeydown = forgotSubmitOnEnter;
    if (forgotPersonalNumber) forgotPersonalNumber.onkeydown = forgotSubmitOnEnter;
    if (forgotPhone) forgotPhone.onkeydown = forgotSubmitOnEnter;

    const requestSubmitOnEnter = (event) => {
      if (event.key === 'Enter') {
        document.getElementById('managerRequestSubmit')?.click();
      }
    };
    if (requestName) requestName.onkeydown = requestSubmitOnEnter;
    if (requestPassword) requestPassword.onkeydown = requestSubmitOnEnter;

    bindPasswordPeekButtons(gate);
  });
}

/**
 * Hold-to-reveal password eye buttons inside a root.
 * @param {HTMLElement | null} root
 */
function bindPasswordPeekButtons(root) {
  if (!root) return;

  root.querySelectorAll('.passwordPeekBtn').forEach((btn) => {
    const inputId = btn.getAttribute('data-peek-for');
    const input = inputId ? document.getElementById(inputId) : null;
    if (!input) return;

    const show = (event) => {
      event.preventDefault();
      input.type = 'text';
      btn.classList.add('is-peeking');
    };

    const hide = () => {
      input.type = 'password';
      btn.classList.remove('is-peeking');
    };

    const showAndWatch = (event) => {
      show(event);
      window.addEventListener('mouseup', hide, { once: true });
      window.addEventListener('touchend', hide, { once: true });
      window.addEventListener('touchcancel', hide, { once: true });
    };

    btn.addEventListener('mousedown', showAndWatch);
    btn.addEventListener('mouseleave', hide);
    btn.addEventListener('touchstart', showAndWatch, { passive: false });
    btn.addEventListener('blur', hide);
    btn.addEventListener('click', (event) => event.preventDefault());
  });
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

export function isAdmin() {
  return state.role === ROLES.ADMIN;
}

/** System admin (not a facility manager). */
export function isMainAdmin() {
  return isAdmin() && !state.facilityManager;
}

/** Currently signed-in facility manager, if any. */
export function getActiveFacilityManager() {
  return state.facilityManager;
}

/**
 * Whether the current facility manager owns this facility.
 * Main admin / guest: always true (no dimming ownership model).
 * @param {string} [facilityId]
 */
export function isManagedFacility(facilityId) {
  if (!state.facilityManager) return true;
  if (!facilityId) return false;
  return state.facilityManager.facilityIds.includes(facilityId);
}

/** Letter shown in the sidebar role badge. */
export function getRoleBadgeLetter() {
  if (!isAdmin()) return 'א';
  if (state.facilityManager?.name) {
    return getManagerInitial(state.facilityManager.name);
  }
  return 'מ';
}

/** Tooltip / aria label for the role badge. */
export function getRoleBadgeLabel() {
  if (!isAdmin()) return 'אורח';
  if (state.facilityManager?.name) {
    return `מנהל מתקן: ${state.facilityManager.name}`;
  }
  return 'מנהל';
}
