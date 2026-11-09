import { state, recalculateHospitalBloodNeeded } from './state.js';
import { navigateTo } from './navigation-tabs.js';

/* Home View: Urgent Requests */

export function renderHomeUrgentRequests() {
  recalculateHospitalBloodNeeded();

  const urgentContainer = document.getElementById('home-urgent-list');
  const countBadge = document.getElementById('home-requests-count-badge');
  const now = new Date();

  // Retrieve only requests that are currently active, non-archived, and classified as urgent / critical
  const activeUrgentRequests = state.requests.filter(
    (r) =>
      !r.isArchived &&
      r.status !== 'Archived' &&
      r.status !== 'Cancelled' &&
      r.status !== 'Rejected' &&
      r.status !== 'Fulfilled' &&
      (r.urgency === 'Urgent' || r.urgency === 'Critical') &&
      (!r.expiresAt || new Date(r.expiresAt) > now)
  );

  if (countBadge) {
    const countText =
      activeUrgentRequests.length === 1
        ? 'Total 1 active urgent patient appeal'
        : `Total ${activeUrgentRequests.length} active urgent patient appeals`;
    countBadge.textContent = countText;
  }

  if (!urgentContainer) return;

  if (activeUrgentRequests.length === 0) {
    urgentContainer.innerHTML = `
      <div class="p-6 rounded-2xl bg-black/25 border border-rose-900/30 text-center space-y-2">
        <div class="w-10 h-10 rounded-full bg-rose-950/70 text-rose-300 mx-auto flex items-center justify-center">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <p class="text-sm font-bold text-white">No Active Urgent Blood Requests</p>
        <p class="text-xs text-rose-200/80">All emergency blood appeals across Cavite are currently fulfilled or inactive.</p>
      </div>
    `;
    return;
  }

  urgentContainer.innerHTML = activeUrgentRequests
    .slice(0, 4)
    .map((item) => {
      const isCritical = item.urgency === 'Critical';
      return `
      <div
        data-home-request-id="${item.id}"
        data-home-hospital-id="${item.hospitalId || ''}"
        class="group flex items-center gap-4 p-3.5 rounded-xl bg-black/25 hover:bg-white/10 transition-all cursor-pointer border border-rose-900/40 hover:border-rose-700/60"
        title="View urgent request details on Requests page"
      >
        <div class="relative w-12 h-14 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 32 38" fill="none" class="w-full h-full drop-shadow filter">
            <path d="M16 2.5C16 2.5 5 18 5 25.5C5 31.5 9.9 36 16 36C22.1 36 27 31.5 27 25.5C27 18 16 2.5 16 2.5Z" fill="${isCritical ? '#5C080E' : '#8B1E22'}"/>
            <path d="M16 4C16 4 7 18 7 25C7 30 11 34 16 34C21 34 25 30 25 25C25 18 16 4 16 4Z" fill="${isCritical ? '#DC2626' : '#B91C1C'}"/>
          </svg>
          <span class="absolute inset-0 flex items-center justify-center text-sm font-black text-rose-100 mt-2">
            ${item.bloodType}
          </span>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm sm:text-base font-semibold text-white group-hover:text-rose-200 transition-colors leading-snug truncate">
              ${item.isAnonymous ? 'Confidential Facility (Anonymous)' : item.hospitalName}
            </p>
            ${
              isCritical
                ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-sm shrink-0">CRITICAL</span>`
                : ''
            }
          </div>
          <span class="text-xs text-rose-300 flex items-center gap-1 mt-0.5">
            <span>${item.unitsNeeded ? `${item.unitsNeeded} unit(s) needed • ` : ''}Immediate donors required</span>
            <svg class="w-3 h-3 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </span>
        </div>
      </div>
    `;
    })
    .join('');

  urgentContainer.querySelectorAll('[data-home-request-id]').forEach((el) => {
    el.addEventListener('click', () => {
      navigateTo('requests');
    });
  });
}
