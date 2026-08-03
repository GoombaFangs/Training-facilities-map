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
  { value: 'לא פעיל', label: 'לא פעיל', cssClass: 'statusInactive' },
  { value: 'בבניה', label: 'בבניה', cssClass: 'statusBuilding' },
];

export function getStatusByValue(value) {
  return FACILITY_STATUSES.find((s) => s.value === value) ?? null;
}
export const LOCATIONS = [
  'בסיס צפון',
  'בסיס מרכז',
  'בסיס דרום',
  'מחנה אימונים א',
  'מחנה אימונים ב',
  'מתקן אימונים ארצי',
];

/** Specific subtypes keyed by facility type value */
export const SPECIFIC_TYPES_BY_FACILITY = {
  מטווחים: ['מטווחי חוץ', 'מטווחי פנים', 'מטווח משולב', 'מטווח טקטי'],
  'לש"בית מכולות': ['לש"בית מכולות', 'מתחם מכולות טקטי', 'מכולות כניסה'],
  'לש"בית עץ': ['לש"בית עץ', 'מבנה עץ טקטי', 'מתחם מבנים'],
  'חדר ירי': ['חדר ירי מבטון', 'חדר ירי נייד', 'חדר ירי מקורה'],
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

export function getSpecificTypesFor(facilityType) {
  return SPECIFIC_TYPES_BY_FACILITY[facilityType] ?? [];
}
