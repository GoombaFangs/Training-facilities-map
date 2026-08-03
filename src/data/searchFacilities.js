/**
 * Filter features by free-text search across facility fields.
 *
 * @param {GeoJSON.Feature[]} features
 * @param {string} query
 * @returns {GeoJSON.Feature[]}
 */
export function searchFacilities(features, query) {
  const q = query.trim().toLowerCase();
  if (!q) return features;

  return features.filter((feature) => {
    const p = feature.properties ?? {};
    const nested = p.TypesOfFacilities ?? [];

    const haystack = [
      p.nameOfFacility,
      p.locationOfFacility,
      p.unitOwningTheFacility,
      p.areaInTheCountry,
      p.statusOfFacility,
      p.phoneOfFacility,
      p.contactNameOfFacility,
      p.contactRoleOfFacility,
      ...nested.flatMap((t) => [
        t.name,
        t.statusOfFacility,
        t.locationOfFacility,
        t.typeOfFacility,
        t.specificTypeOfFacility,
        t.trainingFrame,
        t.contactName,
        t.contactRank,
        t.contactPhone,
        t.comments,
        ...(Array.isArray(t.trainingOptions)
          ? t.trainingOptions
          : String(t.trainingOptions ?? '').split(',')),
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}
