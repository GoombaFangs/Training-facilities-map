/**
 * Filter features by search query (name, location, unit).
 *
 * @param {GeoJSON.Feature[]} features
 * @param {string} query
 * @returns {GeoJSON.Feature[]}
 */
export function searchFacilities(features, query) {
  const q = query.trim().toLowerCase();
  if (!q) return features;

  return features.filter((feature) => {
    const p = feature.properties;
    const haystack = [
      p.nameOfFacility,
      p.locationOfFacility,
      p.unitOwningTheFacility,
      p.areaInTheCountry,
      ...(p.TypesOfFacilities ?? []).map((t) => t.typeOfFacility),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}
