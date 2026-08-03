import { state } from '../state.js';

/**
 * @param {{ onSearch: () => void }} options
 */
export function initSidebar({ onSearch }) {
  const searchInput = document.getElementById('search');
  searchInput.addEventListener('input', (event) => {
    state.searchQuery = event.target.value;
    onSearch();
  });

  initSidebarToggle();
}

function initSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const shell = document.getElementById('appShell');
  if (!toggle || !shell) return;

  toggle.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('is-sidebar-collapsed');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute(
      'aria-label',
      collapsed ? 'הצג תפריט' : 'הסתר תפריט',
    );
    toggle.title = collapsed ? 'הצג תפריט' : 'הסתר תפריט';

    window.setTimeout(() => {
      state.map?.invalidateSize();
    }, 320);
  });
}
