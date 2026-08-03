/**
 * Compare two facility features and return Hebrew change lines.
 * @param {GeoJSON.Feature | null | undefined} before
 * @param {GeoJSON.Feature | null | undefined} after
 * @returns {string[]}
 */
export function describeFacilityChanges(before, after) {
  if (!before?.properties || !after?.properties) return [];

  const changes = [];
  const bp = before.properties;
  const ap = after.properties;
  const bt = bp.TypesOfFacilities?.[0] ?? {};
  const at = ap.TypesOfFacilities?.[0] ?? {};

  pushChange(changes, 'שם המתקן', bp.nameOfFacility, ap.nameOfFacility);
  pushChange(changes, 'יחידה', bp.unitOwningTheFacility, ap.unitOwningTheFacility);
  pushChange(changes, 'סטטוס', bp.statusOfFacility, ap.statusOfFacility);
  pushChange(changes, 'טלפון', bp.phoneOfFacility, ap.phoneOfFacility);
  pushChange(changes, 'איש קשר', bp.contactNameOfFacility, ap.contactNameOfFacility);
  pushChange(changes, 'תפקיד איש קשר', bp.contactRoleOfFacility, ap.contactRoleOfFacility);
  pushChange(changes, 'מיקום', bp.locationOfFacility, ap.locationOfFacility);
  pushChange(changes, 'אזור בארץ', bp.areaInTheCountry, ap.areaInTheCountry);
  pushChange(changes, 'סוג מתקן', bt.typeOfFacility, at.typeOfFacility);
  pushChange(changes, 'סוג ספציפי', bt.specificTypeOfFacility, at.specificTypeOfFacility);
  pushChange(changes, 'מסגרת אימון', bt.trainingFrame, at.trainingFrame);
  pushChange(
    changes,
    'אפשרויות אימון',
    formatList(bt.trainingOptions),
    formatList(at.trainingOptions),
  );
  pushChange(changes, 'הערות', bt.comments, at.comments);

  const beforeCoords = formatCoords(before.geometry?.coordinates);
  const afterCoords = formatCoords(after.geometry?.coordinates);
  pushChange(changes, 'מיקום במפה', beforeCoords, afterCoords);

  const beforeImgs = Array.isArray(bt.imgArr) ? bt.imgArr.length : 0;
  const afterImgs = Array.isArray(at.imgArr) ? at.imgArr.length : 0;
  if (beforeImgs !== afterImgs) {
    changes.push(`תמונות: ${beforeImgs} → ${afterImgs}`);
  } else if (beforeImgs > 0 && JSON.stringify(bt.imgArr) !== JSON.stringify(at.imgArr)) {
    changes.push('עודכנו התמונות');
  }

  return changes;
}

/**
 * @param {string[]} changes
 * @param {string} label
 * @param {unknown} before
 * @param {unknown} after
 */
function pushChange(changes, label, before, after) {
  const from = normalizeValue(before);
  const to = normalizeValue(after);
  if (from === to) return;
  if (!from && to) {
    changes.push(`${label}: נוספה הערך ״${to}״`);
    return;
  }
  if (from && !to) {
    changes.push(`${label}: הוסר ״${from}״`);
    return;
  }
  changes.push(`${label}: ״${from}״ → ״${to}״`);
}

/**
 * @param {unknown} value
 */
function normalizeValue(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * @param {unknown} value
 */
function formatList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
  }
  return normalizeValue(value);
}

/**
 * @param {unknown} coordinates
 */
function formatCoords(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return '';
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return '';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
