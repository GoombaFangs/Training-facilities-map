import { state } from '../state.js';
import { isAdmin } from '../auth/roleGate.js';

/** @type {() => { isPinDropping: boolean, mapClickActive: boolean, adminMapCreateBound: boolean }} */
let getPinContext = () => ({
  isPinDropping: false,
  mapClickActive: false,
  adminMapCreateBound: false,
});

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

export function syncMapPinCursor() {
  if (!state.map) return;
  const container = state.map.getContainer();
  const formOpen = !document.getElementById('facilityFormBackdrop')?.hidden;
  const ctx = getPinContext();
  const isHiding = container.classList.contains('is-pin-hiding');

  const pinMode =
    !ctx.isPinDropping &&
    !isHiding &&
    !hasOpenMarkerMenuDom() &&
    !formOpen &&
    (ctx.mapClickActive || (isAdmin() && ctx.adminMapCreateBound));

  container.classList.toggle('is-pin-mode', pinMode);
}
