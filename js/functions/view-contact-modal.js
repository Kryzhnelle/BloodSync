import { state, elements } from './state.js';
import { showToast } from './ToastNotif.js';
import { formatContactDisplay } from './contact-utils.js';

export function openContactModal(request) {
  state.selectedRequest = request;
  const container = document.getElementById('view-contact-modal-content');
  if (!container) return;

  container.innerHTML = `
    <div
      class="relative w-full max-w-lg bg-[#55080E] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-900/60 overflow-hidden"
    >
      <button
        id="close-contact-modal-btn"
        class="absolute top-5 right-5 p-2 rounded-full text-rose-200 hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
        aria-label="Close Contact Info"
      >
        <svg class="w-6 h-6 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>

      <div class="flex items-center gap-4 pr-8 mb-6">
        <div class="w-16 h-16 rounded-full bg-white text-[#55080E] flex items-center justify-center font-black text-xl shadow-lg shrink-0">
          ${request.initials || 'NP'}
        </div>
        <div>
          <h3 class="text-xl sm:text-2xl font-bold text-white leading-tight">
            ${request.patientName}
          </h3>
          <p class="text-sm text-rose-200">Age ${request.age}</p>
        </div>
      </div>

      <div class="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[#F8B4B9] text-[#55080E] mb-6 shadow-sm">
        <span class="font-black text-lg">${request.bloodType}</span>
        <span class="text-xs sm:text-sm font-bold text-stone-800">
          ${request.unitsNeeded} unit/s needed
        </span>
      </div>

      <div class="space-y-4 text-sm sm:text-base border-t border-rose-900/50 pt-5 mb-6 text-stone-100">
        <div class="flex items-center justify-between group">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span class="font-semibold text-rose-200">Contact Number:</span>
            <a href="tel:${request.contactNumber}" class="font-medium hover:underline font-mono">${formatContactDisplay(request.contactNumber)}</a>
          </div>
          <button
            id="copy-phone-btn"
            class="p-1.5 rounded-lg hover:bg-white/10 text-rose-300 hover:text-white transition-colors cursor-pointer"
            title="Copy number"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          </button>
        </div>

        <div class="flex items-center justify-between group">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <span class="font-semibold text-rose-200">Email Address:</span>
            <a href="mailto:${request.email}" class="font-medium hover:underline break-all">${request.email}</a>
          </div>
          <button
            id="copy-email-btn"
            class="p-1.5 rounded-lg hover:bg-white/10 text-rose-300 hover:text-white transition-colors cursor-pointer"
            title="Copy email"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
          <span class="font-semibold text-rose-200">Emergency Contact:</span>
          <span class="font-medium">${request.emergencyContact}</span>
        </div>
      </div>

      <div class="pt-4 border-t border-rose-900/50 flex items-start gap-3 text-stone-200">
        <svg class="w-5 h-5 text-rose-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <span class="text-sm sm:text-base font-semibold text-white">
          ${request.hospitalName}
        </span>
      </div>

      <div class="mt-6 pt-4 flex gap-3">
        <a
          href="tel:${request.contactNumber}"
          class="flex-1 py-3 px-4 rounded-xl bg-white text-[#55080E] hover:bg-rose-100 font-extrabold text-sm text-center shadow transition-all block"
        >
          Call Family Directly
        </a>
        <button
          id="done-contact-modal-btn"
          class="py-3 px-5 rounded-xl bg-black/30 hover:bg-black/40 text-stone-200 font-bold text-sm cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  `;

  document.getElementById('close-contact-modal-btn')?.addEventListener('click', closeContactModal);
  document.getElementById('done-contact-modal-btn')?.addEventListener('click', closeContactModal);

  document.getElementById('copy-phone-btn')?.addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(request.contactNumber);
      showToast('Phone number copied to clipboard!');
    }
  });

  document.getElementById('copy-email-btn')?.addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(request.email);
      showToast('Email address copied to clipboard!');
    }
  });

  elements.viewContactModal?.classList.remove('hidden-view');
}

export function closeContactModal() {
  elements.viewContactModal?.classList.add('hidden-view');
  state.selectedRequest = null;
}
