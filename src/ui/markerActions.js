import L from 'leaflet';
import { state } from '../state.js';

let menuEl = null;
let menuLatLng = null;
let menuLayer = null;
let suppressNextMapCreate = false;

const ICON_VIEW = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
  </svg>
`;

const ICON_EDIT = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 2 1.66z"/>
  </svg>
`;

/**
 * Show View / Edit choice under a marker.
 * @param {GeoJSON.Feature} feature
 * @param {L.Layer} layer
 * @param {{ onView: Function, onEdit: Function }} handlers
 */
export function showMarkerActionMenu(feature, layer, handlers) {
  closeMarkerActionMenu();

  const map = state.map;
  if (!map || !layer?.getLatLng) return;

  menuLayer = layer;
  menuLatLng = layer.getLatLng();

  if (typeof layer.closeTooltip === 'function') {
    layer.closeTooltip();
  }

  const wrap = document.createElement('div');
  wrap.className = 'markerActionMenu';
  wrap.innerHTML = `
    <button type="button" class="markerActionBtn markerActionView" title="צפייה" aria-label="צפייה">
      ${ICON_VIEW}
    </button>
    <button type="button" class="markerActionBtn markerActionEdit" title="עריכה" aria-label="עריכה">
      ${ICON_EDIT}
    </button>
  `;

  map.getContainer().appendChild(wrap);
  menuEl = wrap;

  L.DomEvent.disableClickPropagation(wrap);
  L.DomEvent.disableScrollPropagation(wrap);

  const viewBtn = wrap.querySelector('.markerActionView');
  const editBtn = wrap.querySelector('.markerActionEdit');

  viewBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMarkerActionMenu();
    handlers.onView(feature);
  });

  editBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMarkerActionMenu();
    handlers.onEdit(feature);
  });

  positionMenu();
  requestAnimationFrame(() => {
    menuEl?.classList.add('is-open');
  });

  map.on('move', positionMenu);
  map.on('zoom', positionMenu);
  map.on('moveend', positionMenu);
  map.on('zoomend', positionMenu);

  // Delay map-close binding so the opening click doesn't dismiss immediately
  setTimeout(() => {
    if (menuEl) {
      map.on('click', onMapClickClose);
    }
  }, 0);
}

export function closeMarkerActionMenu() {
  const map = state.map;

  if (map) {
    map.off('move', positionMenu);
    map.off('zoom', positionMenu);
    map.off('moveend', positionMenu);
    map.off('zoomend', positionMenu);
    map.off('click', onMapClickClose);
  }

  if (menuEl || menuLayer) {
    suppressNextMapCreate = true;
  }

  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }

  menuLayer = null;
  menuLatLng = null;
}

export function hasOpenMarkerMenu() {
  return Boolean(menuEl);
}

/** @returns {boolean} true if the next map-create should be skipped */
export function consumeMapCreateSuppression() {
  if (!suppressNextMapCreate) return false;
  suppressNextMapCreate = false;
  return true;
}

function positionMenu() {
  if (!menuEl || !menuLatLng || !state.map) return;

  const point = state.map.latLngToContainerPoint(menuLatLng);
  menuEl.style.left = `${point.x}px`;
  menuEl.style.top = `${point.y + 14}px`;
}

function onMapClickClose() {
  closeMarkerActionMenu();
}
