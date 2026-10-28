import { state } from './state.js';
import { navigateTo } from './navigation-tabs.js';

/* Home View: Urgent Requests */

export function renderHomeUrgentRequests() {
  const urgentContainer = document.getElementById('home-urgent-list');
  const countBadge = document.getElementById('home-requests-count-badge');
  const now = new Date();
  const activeCount = state.requests.filter(
    (r) => !r.isArchived && r.status !== 'Archived' && (!r.expiresAt || new Date(r.expiresAt) > now)
  ).length;

  if (countBadge) {
    countBadge.textContent = `Total ${activeCount} open patient appeals`;
  }
  if (!urgentContainer) return;

  const urgentItems = [
    { type: 'B+', hospitalId: 'dra-olivia-salamanca', hospitalName: 'Dra. Olivia Salamanca Memorial District Hospital' },
    { type: 'A+', hospitalId: 'bautista-hospital', hospitalName: 'Bautista Hospital' },
    { type: 'O-', hospitalId: 'cavite-medical-center', hospitalName: 'Cavite Medical Center' },
  ];

  urgentContainer.innerHTML = urgentItems
    .map((item) => {
      return `
      <div
        data-home-hospital-id="${item.hospitalId}"
        class="group flex items-center gap-4 p-3 rounded-xl bg-black/20 hover:bg-white/10 transition-all cursor-pointer border border-rose-900/30"
      >
        <div class="relative w-12 h-14 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 32 38" fill="none" class="w-full h-full drop-shadow filter">
            <path d="M16 2.5C16 2.5 5 18 5 25.5C5 31.5 9.9 36 16 36C22.1 36 27 31.5 27 25.5C27 18 16 2.5 16 2.5Z" fill="#8B1E22"/>
            <path d="M16 4C16 4 7 18 7 25C7 30 11 34 16 34C21 34 25 30 25 25C25 18 16 4 16 4Z" fill="#B91C1C"/>
          </svg>
          <span class="absolute inset-0 flex items-center justify-center text-sm font-black text-rose-100 mt-2">
            ${item.type}
          </span>
        </div>

        <div class="flex-1 min-w-0">
          <p class="text-sm sm:text-base font-semibold text-white group-hover:text-rose-200 transition-colors leading-snug">
            ${item.hospitalName}
          </p>
          <span class="text-xs text-rose-300 flex items-center gap-1 mt-0.5">
            <span>Immediate donors required</span>
            <svg class="w-3 h-3 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </span>
        </div>
      </div>
    `;
    })
    .join('');

  urgentContainer.querySelectorAll('[data-home-hospital-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const hid = el.getAttribute('data-home-hospital-id');
      const targetHospital = state.hospitals.find((h) => h.id === hid) || state.hospitals[0];
      navigateTo('hospitals', targetHospital);
    });
  });
}
