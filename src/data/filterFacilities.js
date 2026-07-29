/**
 * Filter facilities by type and area.
 * Returns matching features (empty filters = all features).
 *
 * @param {GeoJSON.FeatureCollection} data
 * @param {string[]} filterTypes
 * @param {string[]} filterAreas
 * @returns {GeoJSON.Feature[]}
 */
export function filterFacilities(data, filterTypes, filterAreas) {
  const features = data?.features ?? [];
  const hasTypeFilter = filterTypes.length > 0;
  const hasAreaFilter = filterAreas.length > 0;

  if (!hasTypeFilter && !hasAreaFilter) {
    return features;
  }

  return features.filter((feature) => {
    const props = feature.properties;
    const matchesArea =
      !hasAreaFilter || filterAreas.includes(props.areaInTheCountry);

    if (!matchesArea) return false;

    if (!hasTypeFilter) return true;

    const types = props.TypesOfFacilities ?? [];
    return types.some((t) => filterTypes.includes(t.typeOfFacility));
  });
}
