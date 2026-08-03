/** Shared application state */

export const state = {
  map: null,
  geoJsonLayer: null,
  facilitiesData: null,
  role: null,
  /** @type {{ id: string, name: string, facilityIds: string[] } | null} */
  facilityManager: null,
  filterTypes: [],
  filterAreas: [],
  searchQuery: '',
  currentImgIndex: 0,
  isImgBig: false,
  isFilterTypeOpen: false,
  isFilterAreaOpen: false,
};
