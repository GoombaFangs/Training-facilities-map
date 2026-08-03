const STORAGE_KEY = 'training-facilities-manager-reports';

/**
 * @typedef {'forgot_password' | 'facility_created' | 'facility_updated' | 'facility_deleted' | 'manager_request'} ManagerReportType
 *
 * @typedef {{
 *   id: string,
 *   type: ManagerReportType,
 *   managerId: string,
 *   managerName: string,
 *   personalNumber: string,
 *   phone: string,
 *   password: string,
 *   facilityId: string,
 *   facilityName: string,
 *   facilityIds: string[],
 *   facilityNames: string[],
 *   changes: string[],
 *   createdAt: number,
 *   read: boolean,
 * }} ManagerReport
 */

/**
 * @returns {ManagerReport[]}
 */
export function loadManagerReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => normalizeReport(item))
      .filter((item) => item.managerName)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/**
 * @param {ManagerReport[]} reports
 */
function saveManagerReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

/**
 * @param {unknown} item
 * @returns {ManagerReport}
 */
function normalizeReport(item) {
  const raw = item && typeof item === 'object' ? item : {};
  const type = normalizeType(raw.type, raw.phone, raw.facilityName, raw.password);
  const facilityIds = Array.isArray(raw.facilityIds)
    ? [...new Set(raw.facilityIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];
  const facilityNames = Array.isArray(raw.facilityNames)
    ? raw.facilityNames.map((name) => String(name ?? '').trim()).filter(Boolean)
    : [];
  const changes = Array.isArray(raw.changes)
    ? raw.changes.map((line) => String(line ?? '').trim()).filter(Boolean)
    : [];

  return {
    id: String(raw.id ?? '').trim() || createReportId(),
    type,
    managerId: String(raw.managerId ?? '').trim(),
    managerName: String(raw.managerName ?? '').trim(),
    personalNumber: String(raw.personalNumber ?? '').trim(),
    phone: String(raw.phone ?? '').trim(),
    password: String(raw.password ?? ''),
    facilityId: String(raw.facilityId ?? '').trim(),
    facilityName: String(raw.facilityName ?? '').trim(),
    facilityIds,
    facilityNames,
    changes,
    createdAt: Number(raw.createdAt) || Date.now(),
    read: Boolean(raw.read),
  };
}

/**
 * @param {unknown} type
 * @param {unknown} phone
 * @param {unknown} facilityName
 * @param {unknown} password
 * @returns {ManagerReportType}
 */
function normalizeType(type, phone, facilityName, password) {
  const allowed = new Set([
    'forgot_password',
    'facility_created',
    'facility_updated',
    'facility_deleted',
    'manager_request',
  ]);
  if (typeof type === 'string' && allowed.has(type)) {
    return /** @type {ManagerReportType} */ (type);
  }
  if (String(password ?? '').trim() && !String(phone ?? '').trim()) return 'manager_request';
  if (String(phone ?? '').trim()) return 'forgot_password';
  if (String(facilityName ?? '').trim()) return 'facility_updated';
  return 'forgot_password';
}

export function createReportId() {
  return `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {{
 *   type: ManagerReportType,
 *   managerId?: string,
 *   managerName: string,
 *   personalNumber?: string,
 *   phone?: string,
 *   password?: string,
 *   facilityId?: string,
 *   facilityName?: string,
 *   facilityIds?: string[],
 *   facilityNames?: string[],
 *   changes?: string[],
 * }} payload
 * @returns {ManagerReport}
 */
export function addManagerReport(payload) {
  const reports = loadManagerReports();
  const report = {
    id: createReportId(),
    type: payload.type,
    managerId: String(payload.managerId ?? '').trim(),
    managerName: String(payload.managerName ?? '').trim(),
    personalNumber: String(payload.personalNumber ?? '').trim(),
    phone: String(payload.phone ?? '').trim(),
    password: String(payload.password ?? ''),
    facilityId: String(payload.facilityId ?? '').trim(),
    facilityName: String(payload.facilityName ?? '').trim(),
    facilityIds: Array.isArray(payload.facilityIds)
      ? [...new Set(payload.facilityIds.map((id) => String(id).trim()).filter(Boolean))]
      : [],
    facilityNames: Array.isArray(payload.facilityNames)
      ? payload.facilityNames.map((name) => String(name ?? '').trim()).filter(Boolean)
      : [],
    changes: Array.isArray(payload.changes)
      ? payload.changes.map((line) => String(line ?? '').trim()).filter(Boolean)
      : [],
    createdAt: Date.now(),
    read: false,
  };
  reports.unshift(report);
  saveManagerReports(reports);
  return report;
}

/**
 * @param {{ managerId: string, managerName: string, personalNumber?: string, phone: string }} payload
 * @returns {ManagerReport}
 */
export function addForgotPasswordReport(payload) {
  return addManagerReport({
    type: 'forgot_password',
    managerId: payload.managerId,
    managerName: payload.managerName,
    personalNumber: payload.personalNumber,
    phone: payload.phone,
  });
}

/**
 * @param {{
 *   managerName: string,
 *   personalNumber: string,
 *   password: string,
 *   facilityIds: string[],
 *   facilityNames: string[],
 * }} payload
 */
export function addManagerAccessRequest(payload) {
  return addManagerReport({
    type: 'manager_request',
    managerName: payload.managerName,
    personalNumber: payload.personalNumber,
    password: payload.password,
    facilityIds: payload.facilityIds,
    facilityNames: payload.facilityNames,
  });
}

/**
 * Report a facility change made by a facility manager.
 * @param {{
 *   type: 'facility_created' | 'facility_updated' | 'facility_deleted',
 *   managerId: string,
 *   managerName: string,
 *   facilityId?: string,
 *   facilityName: string,
 *   changes?: string[],
 * }} payload
 */
export function addFacilityChangeReport(payload) {
  return addManagerReport({
    type: payload.type,
    managerId: payload.managerId,
    managerName: payload.managerName,
    facilityId: payload.facilityId,
    facilityName: payload.facilityName,
    changes: payload.changes,
  });
}

/**
 * Whether a password is already used by a pending manager request.
 * @param {string} password
 * @param {string} [exceptReportId]
 */
export function isPasswordUsedInPendingRequests(password, exceptReportId = '') {
  const needle = String(password ?? '');
  if (!needle) return false;
  return loadManagerReports().some(
    (r) =>
      r.type === 'manager_request' &&
      r.password === needle &&
      r.id !== exceptReportId,
  );
}

export function countUnreadManagerReports() {
  return loadManagerReports().filter((r) => !r.read).length;
}

export function hasUnreadManagerReports() {
  return countUnreadManagerReports() > 0;
}

/** Mark all reports as read. */
export function markAllManagerReportsRead() {
  const reports = loadManagerReports();
  let changed = false;
  for (const report of reports) {
    if (!report.read) {
      report.read = true;
      changed = true;
    }
  }
  if (changed) saveManagerReports(reports);
}

/**
 * @param {string} reportId
 * @returns {ManagerReport | null}
 */
export function getManagerReportById(reportId) {
  const id = String(reportId ?? '');
  return loadManagerReports().find((r) => r.id === id) ?? null;
}

/**
 * @param {string} reportId
 */
export function deleteManagerReport(reportId) {
  const id = String(reportId ?? '');
  const next = loadManagerReports().filter((r) => r.id !== id);
  saveManagerReports(next);
}

/**
 * @param {number} timestamp
 */
export function formatReportTime(timestamp) {
  try {
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString('he-IL');
  }
}

/**
 * Human-readable title + detail lines for a report.
 * @param {ManagerReport} report
 */
export function getReportDisplay(report) {
  const name = report.managerName || 'מנהל מתקן';
  const facility = report.facilityName || 'מתקן';

  switch (report.type) {
    case 'manager_request': {
      const facilities =
        report.facilityNames.length > 0
          ? report.facilityNames.join(', ')
          : 'לא נבחרו מתקנים';
      const personal = report.personalNumber
        ? `מספר אישי: ${report.personalNumber} · `
        : '';
      return {
        titleHtml: `<strong>${escapeForTemplate(name)}</strong> מבקש להיות מנהל מתקן`,
        detail: {
          label: 'פרטים',
          value: `${personal}מתקנים: ${facilities}`,
        },
        changes: [],
      };
    }
    case 'facility_created':
      return {
        titleHtml: `<strong>${escapeForTemplate(name)}</strong> הוסיף את המתקן ״${escapeForTemplate(facility)}״`,
        detail: null,
        changes: [],
      };
    case 'facility_updated':
      return {
        titleHtml: `<strong>${escapeForTemplate(name)}</strong> עדכן את המתקן ״${escapeForTemplate(facility)}״`,
        detail: null,
        changes: report.changes ?? [],
      };
    case 'facility_deleted':
      return {
        titleHtml: `<strong>${escapeForTemplate(name)}</strong> מחק את המתקן ״${escapeForTemplate(facility)}״`,
        detail: null,
        changes: [],
      };
    case 'forgot_password':
    default: {
      const parts = [];
      if (report.personalNumber) parts.push(`מספר אישי: ${report.personalNumber}`);
      if (report.phone) parts.push(`טלפון: ${report.phone}`);
      return {
        titleHtml: `<strong>${escapeForTemplate(name)}</strong> שכח את הסיסמה`,
        detail: parts.length
          ? {
              label: 'פרטים',
              value: parts.join(' · '),
              ...(report.phone ? { href: `tel:${report.phone}` } : {}),
            }
          : null,
        changes: [],
      };
    }
  }
}

/**
 * @param {string} value
 */
function escapeForTemplate(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
