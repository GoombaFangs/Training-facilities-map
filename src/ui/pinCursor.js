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

function ensureMoveTracking() {
  if (!state.map || moveHandlerBound) return;
  moveHandlerBound = true;
  state.map.on('mousemove', (e) => {
    const next = isPointInIsrael(e.latlng.lat, e.latlng.lng);
    if (next !== pointerInsideIsrael) {
      pointerInsideIsrael = next;
      syncMapPinCursor();
    }
  });
  state.map.on('mouseout', () => {
    if (!pointerInsideIsrael) return;
    pointerInsideIsrael = false;
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
}

/** Latest known pointer-inside-Israel flag (from mousemove). */
export function isPointerInsideIsrael() {
  return pointerInsideIsrael;
}
