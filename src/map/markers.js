import L from 'leaflet';
import { state } from '../state.js';
import { closeMarkerActionMenu } from '../ui/markerActions.js';

const facilityIcon = L.divIcon({
  className: 'facility-marker',
  html: `
    <div class="facility-marker-pin">
      <span class="facility-marker-dot"></span>
    </div>
  `,
  iconSize: [40, 56],
  iconAnchor: [20, 56],
  popupAnchor: [0, -50],
  tooltipAnchor: [0, -50],
});

/**
 * @param {GeoJSON.FeatureCollection} data
 * @param {(feature: GeoJSON.Feature, layer: L.Layer) => void} onMarkerClick
 * @param {Set<string>} visibleNames
 */
export function addMarkers(data, onMarkerClick, visibleNames) {
  if (!state.map) return;

  closeMarkerActionMenu();

  if (state.geoJsonLayer) {
    state.map.removeLayer(state.geoJsonLayer);
  }

  const hasFilters = visibleNames !== null;

  state.geoJsonLayer = L.geoJSON(data, {
    filter(feature) {
      if (!hasFilters) return true;
      return visibleNames.has(feature.properties.nameOfFacility);
    },
    pointToLayer(_feature, latlng) {
      return L.marker(latlng, { icon: facilityIcon });
    },
    onEachFeature(feature, layer) {
      const name = feature.properties?.nameOfFacility;
      if (name) {
        layer.bindTooltip(name, {
          direction: 'top',
          offset: [0, -52],
        });
      }

      layer.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        onMarkerClick(feature, layer);
      });
    },
  }).addTo(state.map);
}
