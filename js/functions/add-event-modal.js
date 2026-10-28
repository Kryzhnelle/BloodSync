import { state, elements } from './state.js';
import { renderEvents } from './events.js';
import { showToast } from './ToastNotif.js';
import { createEventInDB } from '../supabase.js';
import { isValidContactNumber } from './contact-utils.js';

export function openAddEventModal() {
  const modal = elements.addEventModal;
  if (!modal) return;

  const content = document.getElementById('add-event-modal-content');
  if (content) {
    const todayIso = new Date().toISOString().split('T')[0];

    content.innerHTML = `
      <div class="relative w-full max-w-lg bg-[#1c1212] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-800">
        <!-- Close Button (x in #d9cfc1) -->
        <button
          type="button"
          id="close-add-event-btn"
          class="absolute top-5 right-5 p-1.5 rounded-full text-[#d9cfc1] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <!-- Top Header with Heart Badge -->
        <div class="flex items-center gap-3.5 mb-6">
          <div class="w-12 h-12 rounded-2xl bg-[#5c0e24] flex items-center justify-center shrink-0 shadow-inner">
            <svg class="w-7 h-7 text-[#ec3e72] fill-[#ec3e72]" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <h2 class="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide">
            Event Registration
          </h2>
        </div>

        <!-- Form fields matching 2.svg -->
        <form id="add-event-form" class="space-y-4 text-xs sm:text-sm">
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-stone-200 mb-1.5">Event Title*</label>
            <input
              type="text"
              id="event-input-title"
              required
              placeholder="e.g. Cavite Community Blood Caravan"
              class="w-full px-4 py-3 rounded-xl bg-[#2c2424] border border-[#d9cfc1]/30 text-white placeholder-stone-500 focus:outline-none focus:border-rose-500 transition-all text-xs sm:text-sm"
            />
          </div>

          <div>
            <label class="block text-xs sm:text-sm font-semibold text-stone-200 mb-1.5">Organizer*</label>
            <input
              type="text"
              id="event-input-organizer"
              required
              value="${state.user?.hospital || 'Philippine Red Cross - Cavite City Chapter'}"
              placeholder="e.g. Philippine Red Cross / Cavite Medical Center"
              class="w-full px-4 py-3 rounded-xl bg-[#2c2424] border border-[#d9cfc1]/30 text-white placeholder-stone-500 focus:outline-none focus:border-rose-500 transition-all text-xs sm:text-sm"
            />
          </div>

          <div>
            <label class="block text-xs sm:text-sm font-semibold text-stone-200 mb-1.5">Exact Venue/Address*</label>
            <div class="relative">
              <input
                type="text"
                id="event-input-venue"
                required
                placeholder="e.g. Montano Hall, Caridad, Cavite City"
                class="w-full pl-4 pr-11 py-3 rounded-xl bg-[#2c2424] border border-[#d9cfc1]/30 text-white placeholder-stone-500 focus:outline-none focus:border-rose-500 transition-all text-xs sm:text-sm"
              />
              <svg class="w-5 h-5 text-[#900c1c] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>

          <div>
            <label class="block text-xs sm:text-sm font-semibold text-stone-200 mb-1.5">
              Contact Number (11 digits)*
            </label>
            <input
              type="tel"
              id="event-input-contact"
              required
              maxlength="14"
              placeholder="09123456789"
              value="${state.user?.contactNumber || ''}"
              class="w-full px-4 py-3 rounded-xl bg-[#2c2424] border border-[#d9cfc1]/30 text-white placeholder-stone-500 focus:outline-none focus:border-rose-500 transition-all text-xs sm:text-sm font-mono"
            />
            <p class="text-[11px] text-stone-400 mt-1">Must be an 11-digit contact number</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="block text-xs sm:text-sm font-semibold text-stone-200 mb-1.5">Select Date:*</label>
              <div class="relative">
                <input
                  type="date"
                  id="event-input-date"
                  required
                  min="${todayIso}"
                  value="${todayIso}"
                  class="w-full px-3.5 py-3 rounded-xl bg-[#2c2424] border border-[#d9cfc1]/30 text-white focus:outline-none focus:border-rose-500 transition-all text-xs sm:text-sm [color-scheme:dark]"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs sm:text-sm font-semibold text-stone-200 mb-1.5">Time Slot (Select):*</label>
              <div class="grid grid-cols-2 gap-2">
                <div class="relative">
                  <span class="block text-[11px] text-stone-400 mb-1 font-medium">From</span>
                  <div class="relative">
                    <select
                      id="event-time-from"
                      required
                      class="w-full pl-3 pr-8 py-2.5 rounded-xl bg-[#2c2424] border border-[#d9cfc1]/30 text-white focus:outline-none focus:border-rose-500 transition-all text-xs appearance-none cursor-pointer"
                    >
                      <option value="6:00 AM">6:00 AM</option>
                      <option value="7:00 AM">7:00 AM</option>
                      <option value="8:00 AM" selected>8:00 AM</option>
                      <option value="8:30 AM">8:30 AM</option>
                      <option value="9:00 AM">9:00 AM</option>
                      <option value="9:30 AM">9:30 AM</option>
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="11:00 AM">11:00 AM</option>
                      <option value="12:00 PM">12:00 PM</option>
                      <option value="1:00 PM">1:00 PM</option>
                      <option value="2:00 PM">2:00 PM</option>
                      <option value="3:00 PM">3:00 PM</option>
                      <option value="4:00 PM">4:00 PM</option>
                      <option value="5:00 PM">5:00 PM</option>
                      <option value="6:00 PM">6:00 PM</option>
                    </select>
                    <svg class="w-4 h-4 text-[#900c1c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>

                <div class="relative">
                  <span class="block text-[11px] text-stone-400 mb-1 font-medium">To</span>
                  <div class="relative">
                    <select
                      id="event-time-to"
                      required
                      class="w-full pl-3 pr-8 py-2.5 rounded-xl bg-[#2c2424] border border-[#d9cfc1]/30 text-white focus:outline-none focus:border-rose-500 transition-all text-xs appearance-none cursor-pointer"
                    >
                      <option value="7:00 AM">7:00 AM</option>
                      <option value="8:00 AM">8:00 AM</option>
                      <option value="9:00 AM">9:00 AM</option>
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="11:00 AM">11:00 AM</option>
                      <option value="12:00 PM">12:00 PM</option>
                      <option value="1:00 PM">1:00 PM</option>
                      <option value="2:00 PM">2:00 PM</option>
                      <option value="3:00 PM" selected>3:00 PM</option>
                      <option value="4:00 PM">4:00 PM</option>
                      <option value="5:00 PM">5:00 PM</option>
                      <option value="6:00 PM">6:00 PM</option>
                      <option value="7:00 PM">7:00 PM</option>
                      <option value="8:00 PM">8:00 PM</option>
                    </select>
                    <svg class="w-4 h-4 text-[#900c1c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs sm:text-sm font-semibold text-stone-200 mb-1.5">Registration Link:</label>
            <input
              type="text"
              id="event-input-link"
              placeholder="e.g. https://bloodsync.ph/events/cavite-drive"
              class="w-full px-4 py-3 rounded-xl bg-[#2c2424] border border-[#d9cfc1]/30 text-white placeholder-stone-500 focus:outline-none focus:border-rose-500 transition-all text-xs sm:text-sm"
            />
          </div>

          <div class="pt-2">
            <button
              type="submit"
              id="register-event-submit-btn"
              class="w-full py-3.5 rounded-xl bg-[#900c1c] hover:bg-[#720916] text-white font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-xl cursor-pointer"
            >
              Register Event
            </button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('close-add-event-btn')?.addEventListener('click', closeAddEventModal);

    document.getElementById('add-event-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('event-input-title').value.trim();
      const organizer = document.getElementById('event-input-organizer').value.trim();
      const location = document.getElementById('event-input-venue').value.trim();
      const contact = document.getElementById('event-input-contact').value.trim();
      const rawDate = document.getElementById('event-input-date').value.trim();
      const fromTime = document.getElementById('event-time-from')?.value.trim() || '8:00 AM';
      const toTime = document.getElementById('event-time-to')?.value.trim() || '3:00 PM';
      const time = `${fromTime} - ${toTime}`;
      const link = document.getElementById('event-input-link')?.value.trim() || '';

      if (!isValidContactNumber(contact)) {
        showToast('Please enter a valid 11-digit contact number (e.g. 09123456789)', 'error');
        document.getElementById('event-input-contact')?.focus();
        return;
      }

      let formattedDate = rawDate;
      if (rawDate && rawDate.includes('-')) {
        const [y, m, d] = rawDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        formattedDate = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }

      const newEvent = {
        id: `event-${Date.now()}`,
        title,
        organizer,
        location,
        municipality: 'Cavite City, Cavite',
        contactDetails: contact,
        date: formattedDate || 'Saturday, Nov 14, 2026',
        time,
        link: link || '#events',
      };

      state.events.unshift(newEvent);
      closeAddEventModal();
      renderEvents();
      showToast(`Event "${title}" has been registered and scheduled!`);

      // Sync to Supabase
      try {
        await createEventInDB(newEvent);
      } catch (err) {
        console.warn('[Supabase Event Insert]', err);
      }
    });
  }

  modal.classList.remove('hidden-view');
}

export function closeAddEventModal() {
  const modal = elements.addEventModal;
  if (modal) modal.classList.add('hidden-view');
}
