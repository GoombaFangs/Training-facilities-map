import { ADMIN_PASSWORD, ROLES } from '../config/auth.js';
import { state } from '../state.js';

/**
 * Show role selection gate. Resolves with selected role.
 * @returns {Promise<'guest' | 'admin'>}
 */
export function showRoleGate() {
  return new Promise((resolve) => {
    const gate = document.getElementById('roleGate');
    const intro = document.getElementById('roleGateIntro');
    const passwordPanel = document.getElementById('adminPasswordPanel');
    const passwordInput = document.getElementById('adminPassword');
    const passwordError = document.getElementById('adminPasswordError');

    gate.hidden = false;
    gate.classList.remove('is-leaving');
    intro.hidden = false;
    passwordPanel.hidden = true;
    passwordInput.value = '';
    passwordError.hidden = true;

    const finish = (role) => {
      state.role = role;
      gate.classList.add('is-leaving');
      window.setTimeout(() => {
        gate.hidden = true;
        gate.classList.remove('is-leaving');
        resolve(role);
      }, 420);
    };

    const showIntro = () => {
      intro.hidden = false;
      passwordPanel.hidden = true;
      passwordInput.value = '';
      passwordError.hidden = true;
    };

    const showAdminPassword = () => {
      intro.hidden = true;
      passwordPanel.hidden = false;
      passwordInput.focus();
    };

    document.getElementById('chooseGuest').onclick = () => {
      finish(ROLES.GUEST);
    };

    document.getElementById('chooseAdmin').onclick = () => {
      showAdminPassword();
    };

    document.getElementById('adminPasswordCancel').onclick = () => {
      showIntro();
    };

    document.getElementById('adminPasswordSubmit').onclick = () => {
      if (passwordInput.value === ADMIN_PASSWORD) {
        finish(ROLES.ADMIN);
      } else {
        passwordError.hidden = false;
        passwordInput.select();
      }
    };

    passwordInput.onkeydown = (event) => {
      if (event.key === 'Enter') {
        document.getElementById('adminPasswordSubmit').click();
      }
    };
  });
}

export function isAdmin() {
  return state.role === ROLES.ADMIN;
}
