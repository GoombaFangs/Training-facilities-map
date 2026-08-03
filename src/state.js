/** Shared application state */

export const state = {
  map: null,
  geoJsonLayer: null,
  facilitiesData: null,
  role: null,
  /** @type {{ id: string, name: string, facilityIds: string[] } | null} */
  facilityManager: null,
  /** @type {string[]} */
  filterTypes: [],
  /** @type {string[]} */
  filterAreas: [],
  /** @type {string[]} */
  filterStatuses: [],
  /** @type {string[]} */
  filterTrainingTypes: [],
  /** @type {string[]} */
  filterTrainingFrames: [],
  /** @type {string[]} */
  filterTrainingOptions: [],
  searchQuery: '',
  currentImgIndex: 0,
  isImgBig: false,
  isFilterPanelOpen: false,
};
