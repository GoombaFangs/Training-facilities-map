/** Canonical facility types, regions, and form choice lists */

export const FACILITY_TYPES = [
  {
    id: 'mitvahim',
    value: 'מטווחים',
    label: 'מטווחים',
    cssClass: 'mitvahim',
    inputId: 'mitvahimInput',
  },
  {
    id: 'lashbitMeholot',
    value: 'לש"בית מכולות',
    label: 'לש"בית מכולות',
    cssClass: 'lashbitMeholot',
    inputId: 'lashbitMeholotInput',
  },
  {
    id: 'lashbitEz',
    value: 'לש"בית עץ',
    label: 'לש"בית עץ',
    cssClass: 'lashbitEz',
    inputId: 'lashbitEzInput',
  },
  {
    id: 'hederYery',
    value: 'חדר ירי',
    label: 'חדר ירי',
    cssClass: 'hederYery',
    inputId: 'hederYeryInput',
  },
];

export const AREAS = [
  { id: 'zafon', value: 'צפון', label: 'צפון', inputId: 'zafonInput' },
  { id: 'mercaz', value: 'מרכז', label: 'מרכז', inputId: 'mercazInput' },
  { id: 'darom', value: 'דרום', label: 'דרום', inputId: 'daromInput' },
];

export const FACILITY_STATUSES = [
  { value: 'פעיל', label: 'פעיל', cssClass: 'statusActive' },
  { value: 'לא כשיר', label: 'לא כשיר', cssClass: 'statusInactive' },
  { value: 'בהקמה', label: 'בהקמה', cssClass: 'statusBuilding' },
];

/** Old status labels → current labels (data + catalogs migration) */
export const STATUS_VALUE_MIGRATIONS = {
  'לא פעיל': 'לא כשיר',
  בבניה: 'בהקמה',
  'לא קשיר': 'לא כשיר',
};

export function migrateStatusValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return raw;
  return STATUS_VALUE_MIGRATIONS[raw] ?? raw;
}

export function getStatusByValue(value) {
  const migrated = migrateStatusValue(value);
  return FACILITY_STATUSES.find((s) => s.value === migrated) ?? null;
}

/** Training type options (formerly “specific type”) — same for all facility types */
export const TRAINING_TYPE_OPTIONS = ['אימון רטוב', 'אימון יבש'];

/** @deprecated kept as alias for callers that still key by facility type */
export const SPECIFIC_TYPES_BY_FACILITY = {
  מטווחים: TRAINING_TYPE_OPTIONS,
  'לש"בית מכולות': TRAINING_TYPE_OPTIONS,
  'לש"בית עץ': TRAINING_TYPE_OPTIONS,
  'חדר ירי': TRAINING_TYPE_OPTIONS,
};

export const TRAINING_FRAMES = [
  'חוליה',
  'כיתה',
  'מחלקה',
  'פלוגה',
  'גדוד',
  'מסגרת מעורבת',
];

export const TRAINING_OPTIONS = [
  'ירי בסיסי',
  'ירי מתקדם',
  'ירי לילה',
  'אימון מקורה',
  'תרגול בטיחות',
  'סימולציה',
  'תרגול כניסה',
  'ניווט מבנים',
  'תרגול מבנים',
  'ניווט',
];

export function getFacilityTypeByValue(value) {
  return FACILITY_TYPES.find((t) => t.value === value) ?? null;
}

export function getFacilityTypeByInputId(inputId) {
  return FACILITY_TYPES.find((t) => t.inputId === inputId) ?? null;
}

export function getAreaByInputId(inputId) {
  return AREAS.find((a) => a.inputId === inputId) ?? null;
}

export function getAreaByValue(value) {
  return AREAS.find((a) => a.value === value) ?? null;
}

export function getSpecificTypesFor(_facilityType) {
  return TRAINING_TYPE_OPTIONS;
}
