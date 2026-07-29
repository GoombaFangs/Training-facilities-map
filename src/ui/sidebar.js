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
}
