import L from 'leaflet';
import { state } from '../state.js';
import { closeMarkerActionMenu } from '../ui/markerActions.js';

/**
 * @param {string} [status]
 */
function getFacilityIcon(status) {
  const isActive = !status || status === 'פעיל';
  const toneClass = isActive ? 'is-active' : 'is-gray';

  return L.divIcon({
    className: `facility-marker ${toneClass}`,
    html: `
      <div class="facility-marker-pin">
        <span class="facility-marker-dot"></span>
      </div>
    `,
    iconSize: [40, 56],
    iconAnchor: [20, 56],
    popupAnchor: [0, -44],
    tooltipAnchor: [0, -44],
  });
}

let highlightClearTimer = 0;
let highlightFlyTimer = 0;
/** @type {L.Marker | null} */
let highlightedLayer = null;

/**
 * @param {GeoJSON.FeatureCollection} data
 * @param {(feature: GeoJSON.Feature, layer: L.Layer) => void} onMarkerClick
 * @param {Set<string>} visibleNames
 */
export function addMarkers(data, onMarkerClick, visibleNames) {
  if (!state.map) return;

  closeMarkerActionMenu();
  clearFacilityHighlight(false);

  if (state.geoJsonLayer) {
    state.map.removeLayer(state.geoJsonLayer);
  }

  const hasFilters = visibleNames !== null;

  state.geoJsonLayer = L.geoJSON(data, {
    filter(feature) {
      if (!hasFilters) return true;
      return visibleNames.has(feature.properties.nameOfFacility);
    },
    pointToLayer(feature, latlng) {
      return L.marker(latlng, {
        icon: getFacilityIcon(feature.properties?.statusOfFacility),
      });
    },
    onEachFeature(feature, layer) {
      const name = feature.properties?.nameOfFacility;
      if (name) {
        layer.bindTooltip(name, {
          direction: 'top',
          offset: [0, -6],
          opacity: 1,
        });
      }

      layer.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        onMarkerClick(feature, layer);
      });
    },
  }).addTo(state.map);
}

/**
 * Find a facility marker layer by feature id.
 * @param {string} featureId
 * @returns {L.Marker | null}
 */
export function findMarkerByFeatureId(featureId) {
  if (!state.geoJsonLayer || !featureId) return null;
  let match = null;
  state.geoJsonLayer.eachLayer((layer) => {
    if (layer.feature?.properties?.id === featureId) {
      match = layer;
    }
  });
  return match;
}

/**
 * After creating a facility — pulse rings so the new pin is easy to spot.
 * @param {string} featureId
 */
export function highlightFacilityOnMap(featureId) {
  if (!state.map || !featureId) return;

  const layer = findMarkerByFeatureId(featureId);
  if (!layer?.getLatLng) return;

  clearFacilityHighlight(false);

  window.clearTimeout(highlightFlyTimer);
  // Short settle so the form is gone before attention shifts to the pin
  highlightFlyTimer = window.setTimeout(() => {
    highlightFlyTimer = 0;
    applyHighlightToLayer(layer);
  }, 140);
}

/**
 * @param {L.Marker} layer
 */
function applyHighlightToLayer(layer) {
  const el = layer.getElement?.();
  if (!el) return;

  highlightedLayer = layer;
  layer.setZIndexOffset?.(1200);

  el.classList.remove('is-just-added');
  // Restart CSS animations cleanly
  void el.offsetWidth;
  el.classList.add('is-just-added');

  let beacon = el.querySelector('.facility-marker-beacon');
  if (!beacon) {
    beacon = document.createElement('span');
    beacon.className = 'facility-marker-beacon';
    beacon.setAttribute('aria-hidden', 'true');
    beacon.innerHTML = `
      <span class="facility-marker-ring"></span>
      <span class="facility-marker-ring"></span>
      <span class="facility-marker-ring"></span>
      <span class="facility-marker-glow"></span>
    `;
    el.appendChild(beacon);
  }

  if (layer.getTooltip?.()) {
    layer.openTooltip();
  }

  window.clearTimeout(highlightClearTimer);
  highlightClearTimer = window.setTimeout(() => {
    clearFacilityHighlight(true);
  }, 3200);
}

/**
 * @param {boolean} closeTooltip
 */
export function clearFacilityHighlight(closeTooltip = true) {
  window.clearTimeout(highlightClearTimer);
  window.clearTimeout(highlightFlyTimer);
  highlightClearTimer = 0;
  highlightFlyTimer = 0;

  const finishEl = (el) => {
    if (!el) return;
    el.classList.remove('is-just-added');
    el.classList.add('was-highlighted');
    el.querySelector('.facility-marker-beacon')?.remove();
  };

  if (highlightedLayer) {
    finishEl(highlightedLayer.getElement?.());
    highlightedLayer.setZIndexOffset?.(0);
    if (closeTooltip && highlightedLayer.isTooltipOpen?.()) {
      highlightedLayer.closeTooltip();
    }
    highlightedLayer = null;
  }

  document.querySelectorAll('.facility-marker.is-just-added').forEach(finishEl);
}
