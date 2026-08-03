import { state } from '../state.js';
import { isAdmin } from '../auth/roleGate.js';
import { isPointInIsrael } from '../data/israelBoundary.js';

/** @type {() => { isPinDropping: boolean, mapClickActive: boolean, adminMapCreateBound: boolean }} */
let getPinContext = () => ({
  isPinDropping: false,
  mapClickActive: false,
  adminMapCreateBound: false,
});

let pointerInsideIsrael = true;
let moveHandlerBound = false;

/** @type {HTMLElement | null} */
let coordsTip = null;

/**
 * Register live pin-mode context from the facility form module.
 * @param {() => {
 *   isPinDropping: boolean,
 *   mapClickActive: boolean,
 *   adminMapCreateBound: boolean,
 * }} getter
 */
export function registerPinCursorContext(getter) {
  getPinContext = getter;
}

function hasOpenMarkerMenuDom() {
  return Boolean(document.querySelector('.markerActionMenu'));
}

function ensureCoordsTip() {
  if (coordsTip) return coordsTip;
  coordsTip = document.createElement('div');
  coordsTip.id = 'mapPinCoordsTip';
  coordsTip.className = 'mapPinCoordsTip';
  coordsTip.hidden = true;
  coordsTip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(coordsTip);
  return coordsTip;
}

/**
 * @param {boolean} visible
 * @param {{ lat: number, lng: number } | null} [latlng]
 * @param {{ x: number, y: number } | null} [clientPoint]
 */
function updateCoordsTip(visible, latlng = null, clientPoint = null) {
  const tip = ensureCoordsTip();
  if (!visible || !latlng || !clientPoint) {
    tip.hidden = true;
    return;
  }

  tip.hidden = false;
  tip.innerHTML = `
    <span class="mapPinCoordsTipRow"><em>קו רוחב</em> ${latlng.lat.toFixed(5)}</span>
    <span class="mapPinCoordsTipRow"><em>קו אורך</em> ${latlng.lng.toFixed(5)}</span>
  `;

  const offsetX = 18;
  const offsetY = 14;
  const pad = 8;
  const rect = tip.getBoundingClientRect();
  let left = clientPoint.x + offsetX;
  let top = clientPoint.y + offsetY;

  if (left + rect.width + pad > window.innerWidth) {
    left = clientPoint.x - rect.width - offsetX;
  }
  if (top + rect.height + pad > window.innerHeight) {
    top = clientPoint.y - rect.height - 8;
  }
  if (left < pad) left = pad;
  if (top < pad) top = pad;

  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

function hideCoordsTip() {
  if (!coordsTip) return;
  coordsTip.hidden = true;
}

function isBluePinModeActive() {
  if (!state.map) return false;
  const container = state.map.getContainer();
  const formOpen = !document.getElementById('facilityFormBackdrop')?.hidden;
  const ctx = getPinContext();
  const isHiding = container.classList.contains('is-pin-hiding');

  const wantsPin =
    !ctx.isPinDropping &&
    !isHiding &&
    !hasOpenMarkerMenuDom() &&
    !formOpen &&
    (ctx.mapClickActive || (isAdmin() && ctx.adminMapCreateBound));

  return wantsPin && pointerInsideIsrael;
}

function ensureMoveTracking() {
  if (!state.map || moveHandlerBound) return;
  moveHandlerBound = true;
  state.map.on('mousemove', (e) => {
    const next = isPointInIsrael(e.latlng.lat, e.latlng.lng);
    if (next !== pointerInsideIsrael) {
      pointerInsideIsrael = next;
      syncMapPinCursor();
    }

    if (isBluePinModeActive()) {
      const original = e.originalEvent;
      updateCoordsTip(true, e.latlng, {
        x: original?.clientX ?? 0,
        y: original?.clientY ?? 0,
      });
    } else {
      hideCoordsTip();
    }
  });
  state.map.on('mouseout', () => {
    if (!pointerInsideIsrael) {
      hideCoordsTip();
      return;
    }
    pointerInsideIsrael = false;
    hideCoordsTip();
    syncMapPinCursor();
  });
}

export function syncMapPinCursor() {
  if (!state.map) return;
  ensureMoveTracking();

  const container = state.map.getContainer();
  const formOpen = !document.getElementById('facilityFormBackdrop')?.hidden;
  const ctx = getPinContext();
  const isHiding = container.classList.contains('is-pin-hiding');

  const wantsPin =
    !ctx.isPinDropping &&
    !isHiding &&
    !hasOpenMarkerMenuDom() &&
    !formOpen &&
    (ctx.mapClickActive || (isAdmin() && ctx.adminMapCreateBound));

  const pinMode = wantsPin && pointerInsideIsrael;
  container.classList.toggle('is-pin-mode', pinMode);
  container.classList.toggle('is-pin-outside', wantsPin && !pointerInsideIsrael);

  if (!pinMode) hideCoordsTip();
}

/** Latest known pointer-inside-Israel flag (from mousemove). */
export function isPointerInsideIsrael() {
  return pointerInsideIsrael;
}
