import { state, elements } from './state.js';
import { navigateTo } from './navigation-tabs.js';
import { openScreeningModal } from './donor-screening-modal.js';
import { showToast } from './ToastNotif.js';

/* Hospital Detail View */

export function renderHospitalDetail(hospital) {
  const container = elements.hospitalDetailView;
  if (!container) return;

  container.innerHTML = `
    <div class="w-full flex flex-col space-y-8 pb-20">
      <!-- Back Navigation -->
      <div class="max-w-6xl mx-auto px-4 sm:px-6 w-full pt-4">
        <button
          id="back-to-hospitals-btn"
          class="inline-flex items-center gap-2 text-sm font-bold text-[#52090E] dark:text-rose-400 hover:underline cursor-pointer"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          <span>Back to All Hospitals</span>
        </button>
      </div>

      <!-- Hero Banner -->
      <div class="max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div class="bg-white dark:bg-stone-900 rounded-3xl overflow-hidden shadow-xl border border-stone-200 dark:border-stone-800">
          <div class="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden bg-stone-900">
            <img
              src="${hospital.image}"
              alt="${hospital.name}"
              class="w-full h-full object-cover filter contrast-105"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          </div>

          <div class="p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative">
            <!-- Seal Emblem -->
            <div class="-mt-16 sm:-mt-20 md:-mt-24 w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-white dark:bg-stone-800 p-2 shadow-2xl border-4 border-white dark:border-stone-700 flex items-center justify-center shrink-0">
              <div class="w-full h-full rounded-full bg-[#1E3A8A] flex flex-col items-center justify-center text-white border-2 border-amber-400 p-2 text-center select-none shadow-inner">
                <div class="w-4 h-4 rounded-full bg-amber-400 mb-0.5"></div>
                <span class="text-[9px] font-black uppercase tracking-tighter leading-none text-amber-200">SEAL OF</span>
                <span class="text-[10px] sm:text-xs font-black uppercase tracking-tight text-white line-clamp-1">MEDICAL CTR</span>
                <span class="text-[8px] font-bold text-amber-300 mt-0.5">EST. 2014</span>
              </div>
            </div>

            <div class="flex-1 text-center md:text-left space-y-2">
              <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight leading-tight">
                ${hospital.name}
              </h1>
              <p class="text-sm sm:text-base text-stone-600 dark:text-stone-300 font-medium flex items-center justify-center md:justify-start gap-2">
                <svg class="w-4 h-4 text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>${hospital.address}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="max-w-6xl mx-auto px-4 sm:px-6 w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left: Blood Needed Huge Box -->
        <div class="lg:col-span-8 flex flex-col justify-between">
          <div class="bg-[#4E080C] text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-rose-900/50 flex flex-col justify-between h-full space-y-8">
            <div class="flex items-center justify-between flex-wrap gap-4">
              <h2 class="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">
                BLOOD NEEDED
              </h2>
              <span class="px-3.5 py-1.5 rounded-lg bg-stone-200/90 text-stone-900 text-xs sm:text-sm font-bold tracking-wide">
                UPDATED: ${hospital.lastUpdated}
              </span>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-y border-rose-900/60 divide-y sm:divide-y-0 sm:divide-x divide-rose-900/60">
              ${hospital.bloodNeeded
                .map(
                  (b, idx) => `
                <div class="flex flex-col items-center justify-center text-center ${
                  idx > 0 ? 'pt-6 sm:pt-0 sm:pl-6' : 'sm:pr-6'
                }">
                  <span class="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white drop-shadow-md font-sans">
                    ${b.type}
                  </span>
                  <span class="text-lg sm:text-xl font-bold text-rose-200 mt-1">
                    ${b.unitsNeeded} unit/s needed
                  </span>
                </div>
              `
                )
                .join('')}
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row items-center gap-4">
              <button
                id="hospital-verify-eligibility-btn"
                class="w-full sm:w-auto flex-1 py-4 px-6 rounded-2xl bg-white text-[#4E080C] hover:bg-rose-50 font-extrabold text-base sm:text-lg shadow-lg transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg class="w-5 h-5 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                <span>Verify Donor Eligibility</span>
              </button>

              <button
                id="hospital-share-btn"
                class="w-full sm:w-auto py-4 px-6 rounded-2xl bg-black/30 hover:bg-black/50 text-white font-bold text-base border border-rose-800/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                <span>Share Need</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Right: Schedule, Contact, Booking -->
        <div class="lg:col-span-4 flex flex-col space-y-6">
          <!-- Schedule -->
          <div class="bg-[#4E080C] text-white rounded-3xl p-6 shadow-xl border border-rose-900/50 space-y-4">
            <div class="flex items-center gap-2.5">
              <svg class="w-5 h-5 text-rose-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <h3 class="text-base sm:text-lg font-bold uppercase tracking-wider text-white">SCHEDULE</h3>
            </div>
            <div class="space-y-3 text-sm text-stone-200">
              <div class="flex items-center justify-between pb-2 border-b border-rose-900/40">
                <span class="font-semibold text-white">MON - FRI</span>
                <span class="text-rose-200">${hospital.scheduleWeekdays}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="font-semibold text-white">SAT - SUN</span>
                <span class="text-rose-200">${hospital.scheduleWeekends}</span>
              </div>
            </div>
          </div>

          <!-- Contact -->
          <div class="bg-[#4E080C] text-white rounded-3xl p-6 shadow-xl border border-rose-900/50 space-y-4">
            <div class="flex items-center gap-2.5">
              <svg class="w-5 h-5 text-rose-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <h3 class="text-base sm:text-lg font-bold uppercase tracking-wider text-white">CONTACT INFO</h3>
            </div>
            <div class="space-y-3 text-xs sm:text-sm">
              <div class="flex items-start gap-3 text-stone-200">
                <svg class="w-4 h-4 text-rose-300 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <a href="mailto:${hospital.email}" class="hover:underline hover:text-white break-all">${hospital.email}</a>
              </div>
              <div class="flex items-start gap-3 text-stone-200">
                <svg class="w-4 h-4 text-rose-300 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <a href="tel:${hospital.phone}" class="hover:underline hover:text-white">${hospital.phone}</a>
              </div>
            </div>
          </div>

          <!-- Appointment Booking Form -->
          <div id="hospital-booking-container" class="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-md border border-stone-200 dark:border-stone-800">
            <h4 class="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2 mb-3">
              <svg class="w-4 h-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Book Donation Slot</span>
            </h4>

            <form id="hospital-booking-form" class="space-y-3 text-xs">
              <div>
                <label class="block text-stone-600 dark:text-stone-400 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  id="booking-name"
                  placeholder="Full name"
                  class="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label class="block text-stone-600 dark:text-stone-400 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  id="booking-phone"
                  placeholder="09123456789"
                  class="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-stone-600 dark:text-stone-400 mb-1">Date</label>
                  <input
                    type="date"
                    id="booking-date"
                    value="2026-09-18"
                    class="w-full px-2 py-2 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-stone-600 dark:text-stone-400 mb-1">Time Slot</label>
                  <select
                    id="booking-timeslot"
                    class="w-full px-2 py-2 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white"
                  >
                    <option value="08:30 AM">08:30 AM</option>
                    <option value="09:30 AM" selected>09:30 AM</option>
                    <option value="10:30 AM">10:30 AM</option>
                    <option value="01:30 PM">01:30 PM</option>
                    <option value="02:30 PM">02:30 PM</option>
                    <option value="03:30 PM">03:30 PM</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                class="w-full py-2.5 rounded-lg bg-[#52090E] hover:bg-[#3B070B] text-white font-bold transition-colors shadow cursor-pointer"
              >
                Confirm Donation Slot
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  document.getElementById('back-to-hospitals-btn')?.addEventListener('click', () => {
    navigateTo('hospitals');
  });

  document.getElementById('hospital-verify-eligibility-btn')?.addEventListener('click', () => {
    openScreeningModal();
  });

  document.getElementById('hospital-share-btn')?.addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Hospital donation link copied to clipboard!');
    }
  });

  document.getElementById('hospital-booking-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('booking-name').value;
    const phone = document.getElementById('booking-phone').value;
    const date = document.getElementById('booking-date').value;
    const slot = document.getElementById('booking-timeslot').value;

    const bookingBox = document.getElementById('hospital-booking-container');
    if (bookingBox) {
      bookingBox.innerHTML = `
        <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-center space-y-2">
          <svg class="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          <p class="font-bold text-sm">Appointment Reserved!</p>
          <p class="text-xs">
            We look forward to seeing you, ${name}, on ${date} at ${slot}. Confirmation sent to ${phone}.
          </p>
        </div>
      `;
    }
  });
}
