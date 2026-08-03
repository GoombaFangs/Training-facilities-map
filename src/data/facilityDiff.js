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

  pushChange(changes, 'שם נקודת הציון', bp.nameOfFacility, ap.nameOfFacility);
  pushChange(changes, 'יחידה', bp.unitOwningTheFacility, ap.unitOwningTheFacility);
  pushChange(changes, 'טלפון', bp.phoneOfFacility, ap.phoneOfFacility);
  pushChange(changes, 'איש קשר', bp.contactNameOfFacility, ap.contactNameOfFacility);
  pushChange(changes, 'תפקיד איש קשר', bp.contactRoleOfFacility, ap.contactRoleOfFacility);
  pushChange(changes, 'אזור בארץ', bp.areaInTheCountry, ap.areaInTheCountry);

  const beforeTypes = bp.TypesOfFacilities ?? [];
  const afterTypes = ap.TypesOfFacilities ?? [];
  pushChange(changes, 'מספר מתקנים', String(beforeTypes.length), String(afterTypes.length));

  const maxTypes = Math.max(beforeTypes.length, afterTypes.length);
  for (let i = 0; i < maxTypes; i++) {
    const bt = beforeTypes[i] ?? {};
    const at = afterTypes[i] ?? {};
    const label = `מתקן ${i + 1}`;
    pushChange(changes, `${label} — שם`, bt.name, at.name);
    pushChange(changes, `${label} — סטטוס`, bt.statusOfFacility, at.statusOfFacility);
    pushChange(changes, `${label} — מיקום בבסיס`, bt.locationOfFacility, at.locationOfFacility);
    pushChange(changes, `${label} — סוג`, bt.typeOfFacility, at.typeOfFacility);
    pushChange(changes, `${label} — סוג אימון`, bt.specificTypeOfFacility, at.specificTypeOfFacility);
    pushChange(changes, `${label} — מסגרת`, bt.trainingFrame, at.trainingFrame);
    pushChange(changes, `${label} — איש קשר`, bt.contactName, at.contactName);
    pushChange(changes, `${label} — דרגה`, bt.contactRank, at.contactRank);
    pushChange(changes, `${label} — טלפון איש קשר`, bt.contactPhone, at.contactPhone);
    pushChange(
      changes,
      `${label} — סוגי אימון`,
      formatList(bt.trainingOptions),
      formatList(at.trainingOptions),
    );
    pushChange(changes, `${label} — הערות`, bt.comments, at.comments);
    const beforeImgs = Array.isArray(bt.imgArr) ? bt.imgArr.length : 0;
    const afterImgs = Array.isArray(at.imgArr) ? at.imgArr.length : 0;
    if (beforeImgs !== afterImgs) {
      changes.push(`${label} — תמונות: ${beforeImgs} → ${afterImgs}`);
    } else if (beforeImgs > 0 && JSON.stringify(bt.imgArr) !== JSON.stringify(at.imgArr)) {
      changes.push(`${label} — עודכנו התמונות`);
    }
  }

  const beforeCoords = formatCoords(before.geometry?.coordinates);
  const afterCoords = formatCoords(after.geometry?.coordinates);
  pushChange(changes, 'מיקום במפה', beforeCoords, afterCoords);

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
