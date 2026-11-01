import { state, elements } from './state.js';
import { renderEvents } from './events.js';
import { showToast } from './ToastNotif.js';
import { bookEventSlotInDB } from '../supabase.js';
import { isValidContactNumber, formatContactDisplay } from './contact-utils.js';

export function openEventBookingModal(event) {
  state.activeModalEvent = event;
  const container = document.getElementById('event-booking-modal-content');
  if (!container) return;

  const slots = [
    '08:00 AM - 09:00 AM',
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '01:00 PM - 02:00 PM',
    '02:00 PM - 03:00 PM',
  ];

  container.innerHTML = `
    <div>
      <span class="text-[11px] uppercase tracking-wider font-bold text-rose-600 dark:text-rose-400">Mobile Blood Drive Registration</span>
      <h3 class="text-xl font-bold text-stone-900 dark:text-white">${event.title}</h3>
      <p class="text-xs text-stone-500 mt-1">${event.location}</p>
      ${event.contactDetails ? `<p class="text-[11px] font-mono text-stone-600 dark:text-stone-400 mt-0.5">Event Hotline: ${formatContactDisplay(event.contactDetails)}</p>` : ''}
    </div>

    <form id="event-booking-form" class="space-y-3.5 text-xs sm:text-sm">
      <div>
        <label class="block font-semibold mb-1">Your Full Name*</label>
        <input
          type="text"
          id="event-donor-name"
          required
          value="${state.user?.username || ''}"
          placeholder="Juan Dela Cruz"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
        />
      </div>

      <div>
        <label class="block font-semibold mb-1">Contact Phone Number (11 digits)*</label>
        <input
          type="tel"
          id="event-donor-phone"
          required
          maxlength="14"
          value="${state.user?.contactNumber || ''}"
          placeholder="09123456789"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono"
        />
      </div>

      <div>
        <label class="block font-semibold mb-1">Select Time Window</label>
        <div class="space-y-1.5">
          ${slots
            .map(
              (s, idx) => `
            <label class="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer text-xs transition-colors">
              <span>${s}</span>
              <input type="radio" name="event-slot" value="${s}" ${idx === 1 ? 'checked' : ''} class="text-rose-600"/>
            </label>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="pt-2 flex gap-2">
        <button
          type="submit"
          class="flex-1 py-2.5 rounded-xl bg-[#52090E] hover:bg-[#3B070B] text-white font-bold text-xs shadow cursor-pointer"
        >
          Confirm Registration
        </button>
        <button
          type="button"
          id="close-event-booking-btn"
          class="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold text-xs cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  `;

  document.getElementById('close-event-booking-btn')?.addEventListener('click', closeEventBookingModal);

  document.getElementById('event-booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const donorName = document.getElementById('event-donor-name').value.trim();
    const donorPhone = document.getElementById('event-donor-phone').value.trim();
    const selectedSlotEl = document.querySelector('input[name="event-slot"]:checked');
    const selectedSlot = selectedSlotEl ? selectedSlotEl.value : '09:00 AM - 10:00 AM';

    if (!isValidContactNumber(donorPhone)) {
      showToast('Please enter a valid 11-digit contact number (e.g. 09123456789)', 'error');
      document.getElementById('event-donor-phone')?.focus();
      return;
    }

    state.bookedEventIds.add(event.id);
    closeEventBookingModal();
    renderEvents();
    showToast(`Registered for ${event.title} (${selectedSlot})!`);

    // Sync reservation with Supabase
    try {
      await bookEventSlotInDB({
        eventId: event.id,
        name: donorName,
        email: state.user.email || 'donor@bloodsync.ph',
        phone: donorPhone,
        bloodType: state.user.bloodType || 'Donor',
        timeSlot: selectedSlot,
      });
    } catch (err) {
      console.warn('[Supabase Booking Error]', err);
    }
  });

  elements.eventBookingModal?.classList.remove('hidden-view');
}

export function closeEventBookingModal() {
  elements.eventBookingModal?.classList.add('hidden-view');
  state.activeModalEvent = null;
}
