import {
  loadFacilityManagers,
  saveFacilityManagers,
  createManagerId,
  findFacilityManagerByPassword,
  findFacilityManagerByName,
  getManagerInitial,
} from '../data/facilityManagers.js';
import {
  loadManagerReports,
  markAllManagerReportsRead,
  deleteManagerReport,
  getManagerReportById,
  countUnreadManagerReports,
  formatReportTime,
  getReportDisplay,
} from '../data/managerReports.js';
import { ADMIN_PASSWORD } from '../config/auth.js';
import { isMainAdmin } from '../auth/roleGate.js';

let isClosing = false;
let closeTimer = 0;

export function initMessagesPanel() {
  document.getElementById('messagesClose')?.addEventListener('click', () => closeMessagesPanel());
  document.getElementById('messagesBackdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'messagesBackdrop') closeMessagesPanel();
  });
  updateMessagesBadge();
}

export function openMessagesPanel() {
  if (!isMainAdmin()) return;

  const backdrop = document.getElementById('messagesBackdrop');
  if (!backdrop) return;

  window.clearTimeout(closeTimer);
  isClosing = false;

  backdrop.hidden = false;
  backdrop.classList.remove('is-closing');
  void backdrop.offsetWidth;
  backdrop.classList.add('is-opening');

  markAllManagerReportsRead();
  renderMessagesList();
  updateMessagesBadge();
}

/**
 * @param {{ animate?: boolean }} [options]
 */
export function closeMessagesPanel(options = {}) {
  const { animate = true } = options;
  const backdrop = document.getElementById('messagesBackdrop');
  if (!backdrop || backdrop.hidden || isClosing) return;

  if (!animate) {
    finishClose(backdrop);
    return;
  }

  isClosing = true;
  backdrop.classList.remove('is-opening');
  backdrop.classList.add('is-closing');

  const panel = backdrop.querySelector('.messagesPanel');
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

/** Red badge on the messages button (main admin only). */
export function updateMessagesBadge() {
  const dot = document.getElementById('messagesNotifyDot');
  const countEl = document.getElementById('messagesNotifyCount');
  const unread = isMainAdmin() ? countUnreadManagerReports() : 0;
  const show = unread > 0;

  if (dot) {
    dot.hidden = !show;
    dot.title = show ? `${unread} הודעות חדשות` : '';
  }
  if (countEl) {
    countEl.hidden = true;
    countEl.textContent = '';
  }
}

function renderMessagesList() {
  const list = document.getElementById('messagesList');
  if (!list) return;

  const reports = loadManagerReports();
  if (reports.length === 0) {
    list.innerHTML = `
      <li class="messagesEmpty">
        <span class="messagesEmptyIcon" aria-hidden="true">✉</span>
        <p>אין הודעות כרגע</p>
      </li>
    `;
    return;
  }

  list.innerHTML = reports
    .map((report) => {
      const display = getReportDisplay(report);
      const initial = getManagerInitial(report.managerName);
      const kind = getMessageKindLabel(report.type);

      const detailHtml = display.detail
        ? `
          <p class="messageDetail">
            <span class="messageDetailLabel">${escapeHtml(display.detail.label)}:</span>
            ${
              display.detail.href
                ? `<a href="${escapeAttr(display.detail.href)}">${escapeHtml(display.detail.value)}</a>`
                : escapeHtml(display.detail.value)
            }
          </p>
        `
        : '';

      const changes = display.changes ?? [];
      const changesHtml =
        changes.length > 0
          ? `
            <ul class="messageChanges">
              ${changes.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
            </ul>
          `
          : report.type === 'facility_updated'
            ? `<p class="messageMuted">לא זוהו שינויים בשדות</p>`
            : '';

      const actionsHtml =
        report.type === 'manager_request'
          ? `
            <div class="messageActions">
              <button type="button" class="messageBtnApprove" data-action="approve-request">
                אישור
              </button>
              <button type="button" class="messageBtnDeny" data-action="deny-request">
                דחייה
              </button>
            </div>
          `
          : `
            <button
              type="button"
              class="messageDismiss"
              data-action="remove-report"
              title="מחק הודעה"
              aria-label="מחק הודעה"
            >×</button>
          `;

      return `
      <li class="messageCard${report.read ? '' : ' is-unread'}" data-id="${escapeAttr(report.id)}">
        <div class="messageAvatar" aria-hidden="true">${escapeHtml(initial)}</div>
        <div class="messageContent">
          <div class="messageTop">
            <span class="messageKind">${escapeHtml(kind)}</span>
            <time class="messageTime">${escapeHtml(formatReportTime(report.createdAt))}</time>
          </div>
          <p class="messageTitle">${display.titleHtml}</p>
          ${detailHtml}
          ${changesHtml}
          ${report.type === 'manager_request' ? actionsHtml : ''}
        </div>
        ${report.type === 'manager_request' ? '' : actionsHtml}
      </li>
    `;
    })
    .join('');

  list.querySelectorAll('[data-action="remove-report"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.messageCard');
      const id = row?.dataset.id;
      if (!id) return;
      deleteManagerReport(id);
      renderMessagesList();
      updateMessagesBadge();
    });
  });

  list.querySelectorAll('[data-action="approve-request"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.messageCard');
      const id = row?.dataset.id;
      if (!id) return;
      const result = approveManagerRequest(id);
      if (!result.ok) {
        window.alert(result.message);
        return;
      }
      renderMessagesList();
      updateMessagesBadge();
    });
  });

  list.querySelectorAll('[data-action="deny-request"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.messageCard');
      const id = row?.dataset.id;
      if (!id) return;
      if (!window.confirm('לדחות את הבקשה?')) return;
      deleteManagerReport(id);
      renderMessagesList();
      updateMessagesBadge();
    });
  });
}

/**
 * @param {string} type
 */
function getMessageKindLabel(type) {
  switch (type) {
    case 'manager_request':
      return 'בקשת גישה';
    case 'forgot_password':
      return 'שחזור סיסמה';
    case 'facility_created':
      return 'הוספת מתקן';
    case 'facility_updated':
      return 'עדכון מתקן';
    case 'facility_deleted':
      return 'מחיקת מתקן';
    default:
      return 'הודעה';
  }
}

/**
 * @param {string} reportId
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function approveManagerRequest(reportId) {
  const report = getManagerReportById(reportId);
  if (!report || report.type !== 'manager_request') {
    return { ok: false, message: 'הבקשה לא נמצאה' };
  }

  const name = String(report.managerName ?? '').trim();
  const password = String(report.password ?? '');
  const facilityIds = [...(report.facilityIds ?? [])];

  if (!name || !password) {
    return { ok: false, message: 'לבקשה חסרים שם או סיסמה' };
  }

  if (password === ADMIN_PASSWORD || findFacilityManagerByPassword(password)) {
    return {
      ok: false,
      message: 'לא ניתן לאשר — הסיסמה כבר בשימוש. בקשו מהמשתמש לשלוח בקשה עם סיסמה אחרת.',
    };
  }

  if (findFacilityManagerByName(name)) {
    return {
      ok: false,
      message: 'לא ניתן לאשר — כבר קיים מנהל מתקן עם שם זה.',
    };
  }

  if (facilityIds.length === 0) {
    return { ok: false, message: 'לבקשה לא נבחרו מתקנים' };
  }

  const managers = loadFacilityManagers();
  managers.push({
    id: createManagerId(),
    name,
    password,
    facilityIds,
  });
  saveFacilityManagers(managers);
  deleteManagerReport(reportId);
  return { ok: true };
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
