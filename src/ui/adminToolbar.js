import { ROLES } from '../config/auth.js';
import { state } from '../state.js';
import { isAdmin } from '../auth/roleGate.js';
import { startAddFacilityFlow, setAdminMapCreateEnabled } from './facilityForm.js';

export function initAdminToolbar() {
  document.getElementById('addFacilityBtn').addEventListener('click', () => {
    startAddFacilityFlow();
  });
}

export function updateRoleUi() {
  const toolbar = document.getElementById('adminToolbar');
  const badge = document.getElementById('roleBadge');
  const app = document.getElementById('appShell');

  const admin = isAdmin();
  toolbar.hidden = !admin;
  app.classList.toggle('is-admin', admin);

  badge.textContent = admin ? 'מ' : 'א';
  badge.title = admin ? 'מנהל' : 'אורח';
  badge.setAttribute('aria-label', admin ? 'מנהל' : 'אורח');
  badge.dataset.role = admin ? ROLES.ADMIN : ROLES.GUEST;

  setAdminMapCreateEnabled(admin);
}

export function getRole() {
  return state.role;
}
