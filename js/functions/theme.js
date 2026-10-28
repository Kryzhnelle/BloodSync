import { state, elements } from './state.js';

export function applyTheme(theme) {
  state.theme = theme;
  if (theme === 'dark') {
    elements.html.classList.add('dark');
  } else {
    elements.html.classList.remove('dark');
  }
  localStorage.setItem('bloodsync_theme', theme);
  updateThemeButtons();
}

export function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

export function updateThemeButtons() {
  const isDark = state.theme === 'dark';
  document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
    btn.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    btn.setAttribute('title', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    const iconContainer = btn.querySelector('.theme-toggle-icon');
    if (iconContainer) {
      iconContainer.innerHTML = isDark
        ? `<svg class="w-5 h-5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
        : `<svg class="w-5 h-5 text-stone-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    }
    const label = btn.querySelector('.theme-toggle-label');
    if (label) {
      label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }
  });
}
