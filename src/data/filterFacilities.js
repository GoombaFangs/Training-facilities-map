/**
 * Filter facilities by multiple catalog dimensions.
 * Empty arrays mean "all" for that dimension. Dimensions are AND-combined;
 * values within a dimension are OR-combined.
 *
 * @param {GeoJSON.FeatureCollection} data
 * @param {{
 *   types?: string[],
 *   areas?: string[],
 *   statuses?: string[],
 *   trainingTypes?: string[],
 *   trainingFrames?: string[],
 *   trainingOptions?: string[],
 * }} filters
 * @returns {GeoJSON.Feature[]}
 */
export function filterFacilities(data, filters = {}) {
  const features = data?.features ?? [];
  const types = filters.types ?? [];
  const areas = filters.areas ?? [];
  const statuses = filters.statuses ?? [];
  const trainingTypes = filters.trainingTypes ?? [];
  const trainingFrames = filters.trainingFrames ?? [];
  const trainingOptions = filters.trainingOptions ?? [];

  const hasAny =
    types.length > 0 ||
    areas.length > 0 ||
    statuses.length > 0 ||
    trainingTypes.length > 0 ||
    trainingFrames.length > 0 ||
    trainingOptions.length > 0;

  if (!hasAny) return features;

  return features.filter((feature) => {
    const props = feature.properties ?? {};
    const nested = props.TypesOfFacilities ?? [];

    if (areas.length > 0 && !areas.includes(props.areaInTheCountry)) return false;

    if (statuses.length > 0) {
      const statusMatch =
        statuses.includes(props.statusOfFacility) ||
        nested.some((t) => statuses.includes(t.statusOfFacility));
      if (!statusMatch) return false;
    }

    if (types.length > 0) {
      const ok = nested.some((t) => types.includes(t.typeOfFacility));
      if (!ok) return false;
    }

    if (trainingTypes.length > 0) {
      const ok = nested.some((t) => trainingTypes.includes(t.specificTypeOfFacility));
      if (!ok) return false;
    }

    if (trainingFrames.length > 0) {
      const ok = nested.some((t) => trainingFrames.includes(t.trainingFrame));
      if (!ok) return false;
    }

    if (trainingOptions.length > 0) {
      const ok = nested.some((t) => {
        const options = normalizeTrainingOptions(t.trainingOptions);
        return trainingOptions.some((selected) => options.includes(selected));
      });
      if (!ok) return false;
    }

    return true;
  });
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeTrainingOptions(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
