import L from 'leaflet';

/** @type {GeoJSON.FeatureCollection | null} */
let boundaryData = null;
/** @type {number[][][] | null} */
let israelRingsLngLat = null;

/**
 * Load Israel boundary GeoJSON once.
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function loadIsraelBoundary() {
  if (boundaryData) return boundaryData;
  const response = await fetch('/data/israel-boundary.geojson');
  if (!response.ok) {
    throw new Error(`Failed to load Israel boundary: ${response.status}`);
  }
  boundaryData = await response.json();
  israelRingsLngLat = extractRings(boundaryData);
  return boundaryData;
}

/**
 * Extract exterior rings only (ignore inner holes).
 * @param {GeoJSON.FeatureCollection | GeoJSON.Feature} data
 * @returns {number[][][]}
 */
function extractRings(data) {
  const rings = [];
  const features =
    data.type === 'FeatureCollection' ? data.features : data.type === 'Feature' ? [data] : [];

  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === 'Polygon') {
      if (geometry.coordinates[0]) rings.push(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates) {
        if (polygon[0]) rings.push(polygon[0]);
      }
    }
  }
  return rings;
}

/**
 * Whether a lat/lng point is inside Israel.
 * @param {number} lat
 * @param {number} lng
 */
export function isPointInIsrael(lat, lng) {
  if (!israelRingsLngLat?.length) return true;
  return israelRingsLngLat.some((ring) => pointInRing(lng, lat, ring));
}

/**
 * Ray-casting point-in-polygon. Ring is [[lng,lat], ...]
 * @param {number} x lng
 * @param {number} y lat
 * @param {number[][]} ring
 */
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Convert GeoJSON [lng,lat] ring to Leaflet [lat,lng] ring.
 * @param {number[][]} ring
 */
function toLatLngRing(ring) {
  return ring.map(([lng, lat]) => [lat, lng]);
}

/**
 * Add a dark mask outside Israel. Border line itself is not drawn.
 * @param {L.Map} map
 */
export function addIsraelOutsideMask(map) {
  if (!israelRingsLngLat?.length) return null;

  const worldRing = [
    [-90, -180],
    [-90, 180],
    [90, 180],
    [90, -180],
  ];

  // Outer world + Israel holes (no stroke = border not visible)
  const holes = israelRingsLngLat.map((ring) => toLatLngRing(ring));
  const mask = L.polygon([worldRing, ...holes], {
    stroke: false,
    color: '#000',
    fillColor: '#0a121a',
    fillOpacity: 0.22,
    interactive: false,
    bubblingMouseEvents: false,
    className: 'israel-outside-mask',
  });

  // Keep mask under markers but above tiles
  if (!map.getPane('israelMaskPane')) {
    const pane = map.createPane('israelMaskPane');
    pane.style.zIndex = '350';
    pane.style.pointerEvents = 'none';
  }
  mask.options.pane = 'israelMaskPane';
  mask.addTo(map);
  return mask;
}
