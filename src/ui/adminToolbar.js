import { ROLES } from '../config/auth.js';
import { state } from '../state.js';
import {
  isAdmin,
  isMainAdmin,
  getRoleBadgeLetter,
  getRoleBadgeLabel,
} from '../auth/roleGate.js';
import { setAdminMapCreateEnabled } from './facilityForm.js';
import { openSettingsPanel } from './settingsPanel.js';
import { openMessagesPanel, updateMessagesBadge } from './messagesPanel.js';

export function initAdminToolbar() {
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    openSettingsPanel();
  });
  document.getElementById('messagesBtn')?.addEventListener('click', () => {
    openMessagesPanel();
  });
}

export function updateRoleUi() {
  const settingsBtn = document.getElementById('settingsBtn');
  const messagesBtn = document.getElementById('messagesBtn');
  const badge = document.getElementById('roleBadge');
  const app = document.getElementById('appShell');

  const admin = isAdmin();
  const mainAdmin = isMainAdmin();
  if (settingsBtn) settingsBtn.hidden = !mainAdmin;
  if (messagesBtn) messagesBtn.hidden = !mainAdmin;
  app.classList.toggle('is-admin', admin);
  app.classList.toggle('is-facility-manager', Boolean(state.facilityManager));

  const label = getRoleBadgeLabel();
  badge.textContent = getRoleBadgeLetter();
  badge.title = label;
  badge.setAttribute('aria-label', label);
  badge.dataset.role = admin ? ROLES.ADMIN : ROLES.GUEST;
  badge.dataset.manager = state.facilityManager ? 'true' : 'false';

  setAdminMapCreateEnabled(admin);
  updateMessagesBadge();
}

export function getRole() {
  return state.role;
}
