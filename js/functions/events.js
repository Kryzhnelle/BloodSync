import { state, elements } from './state.js';
import { formatContactDisplay } from './contact-utils.js';
import { removeEventInDB, parseEventDateTime } from '../supabase.js';
import { showToast } from './ToastNotif.js';

let showArchivedEvents = false;

export function renderEvents() {
  if (!elements.eventsGrid) return;

  const isAuthorized =
    state.user &&
    (state.user.role === 'Healthcare Worker' ||
      state.user.role === 'Hospital Admin' ||
      state.user.role === 'Admin');

  // Donor view must not have add event view/button
  const addEventBtn = document.getElementById('events-add-drive-cta-btn');
  if (addEventBtn) {
    if (isAuthorized) {
      addEventBtn.classList.remove('hidden');
    } else {
      addEventBtn.classList.add('hidden');
    }
  }

  const now = Date.now();

  // Helper to check if an event has expired or is archived
  const isEventExpiredOrArchived = (evt) => {
    if (evt.isArchived === true || evt.status === 'Archived') return true;
    const parsed = parseEventDateTime(evt.date, evt.time);
    return parsed ? parsed.getTime() < now : false;
  };

  const activeEvents = state.events.filter((evt) => !isEventExpiredOrArchived(evt));
  const pastEvents = state.events.filter((evt) => isEventExpiredOrArchived(evt));

  // Determine which list to display based on toggle
  const displayedEvents = showArchivedEvents ? pastEvents : activeEvents;

  // Render header filter / archive toggle toolbar
  let toolbar = document.getElementById('events-archive-toolbar');
  if (!toolbar && elements.eventsGrid.parentElement) {
    toolbar = document.createElement('div');
    toolbar.id = 'events-archive-toolbar';
    toolbar.className = 'w-full flex flex-wrap items-center justify-between gap-3 mb-6';
    elements.eventsGrid.parentElement.insertBefore(toolbar, elements.eventsGrid);
  }

  if (toolbar) {
    toolbar.innerHTML = `
      <div class="flex items-center gap-2">
        <button
          type="button"
          id="btn-filter-active-events"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            !showArchivedEvents
              ? 'bg-[#52090E] text-white shadow-md'
              : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300'
          }"
        >
          Active Blood Drives (${activeEvents.length})
        </button>
        <button
          type="button"
          id="btn-filter-archived-events"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            showArchivedEvents
              ? 'bg-[#52090E] text-white shadow-md'
              : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300'
          }"
        >
          Past / Archived Drives (${pastEvents.length})
        </button>
      </div>
      <div class="text-xs text-stone-500">
        ${
          showArchivedEvents
            ? 'Showing past completed or archived blood drives'
            : 'Showing active, upcoming blood drives'
        }
      </div>
    `;

    document.getElementById('btn-filter-active-events')?.addEventListener('click', () => {
      showArchivedEvents = false;
      renderEvents();
    });
    document.getElementById('btn-filter-archived-events')?.addEventListener('click', () => {
      showArchivedEvents = true;
      renderEvents();
    });
  }

  if (displayedEvents.length === 0) {
    elements.eventsGrid.innerHTML = `
      <div class="col-span-full py-16 text-center bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-8">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600">
          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <h4 class="text-base font-bold text-stone-900 dark:text-white mb-1">
          ${showArchivedEvents ? 'No Past or Archived Event Drives' : 'No Active Blood Drives Currently Scheduled'}
        </h4>
        <p class="text-xs text-stone-500 max-w-sm mx-auto">
          ${
            showArchivedEvents
              ? 'Archived and concluded event drives will appear here.'
              : 'Check back soon or healthcare workers can schedule a new blood drive mission above.'
          }
        </p>
      </div>
    `;
    return;
  }

  elements.eventsGrid.innerHTML = displayedEvents
    .map((evt) => {
      const eventHref = evt.link && evt.link.trim() ? evt.link.trim() : '#events';
      const isExternal = eventHref.startsWith('http://') || eventHref.startsWith('https://');
      const isExpired = isEventExpiredOrArchived(evt);

      return `
      <div
        id="event-card-${evt.id}"
        class="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-lg border border-stone-200 dark:border-stone-800 flex flex-col justify-between space-y-5 relative"
      >
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
              ${evt.municipality || 'Cavite City, Cavite'}
            </span>
            ${
              isExpired
                ? `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-700">Concluded / Archived</span>`
                : `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800/60">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Open Registration</span>
                  </span>`
            }
          </div>

          <h3 class="text-lg font-bold text-stone-900 dark:text-white leading-snug">
            ${evt.title}
          </h3>

          <div class="space-y-2 text-xs text-stone-600 dark:text-stone-300">
            <p class="flex items-start gap-2">
              <svg class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${evt.location}</span>
            </p>
            <p class="flex items-center gap-2">
              <svg class="w-4 h-4 text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>${evt.date}</span>
            </p>
            <p class="flex items-center gap-2">
              <svg class="w-4 h-4 text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${evt.time}</span>
            </p>
            ${
              evt.contactDetails
                ? `
              <p class="flex items-center gap-2 font-mono text-[11px] text-stone-700 dark:text-stone-300">
                <svg class="w-4 h-4 text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>${formatContactDisplay(evt.contactDetails)}</span>
              </p>
            `
                : ''
            }
          </div>

          <div class="pt-2 border-t border-stone-100 dark:border-stone-800 text-[11px] text-stone-500">
            <span>Organizer: </span>
            <strong class="text-stone-700 dark:text-stone-300 font-semibold">${evt.organizer || 'Philippine Red Cross - Cavite'}</strong>
          </div>
        </div>

        <div class="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-2">
          <a
            href="${eventHref}"
            target="${isExternal ? '_blank' : '_self'}"
            rel="noopener noreferrer"
            class="w-full py-2.5 rounded-xl bg-[#52090E] hover:bg-[#3B070B] text-white text-xs font-bold transition-all shadow hover:shadow-md flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            <span>Redirect To The Event</span>
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>

          ${
            isAuthorized && !isExpired
              ? `
              <button
                type="button"
                data-event-id="${evt.id}"
                data-event-title="${evt.title.replace(/"/g, '&quot;')}"
                class="btn-remove-event-drive w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all border border-rose-200 dark:border-rose-900/60 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                <span>Remove Event Drive</span>
              </button>
            `
              : ''
          }
        </div>
      </div>
    `;
    })
    .join('');

  // Attach event listeners for Remove Event Drive buttons (only rendered for authorized users)
  if (isAuthorized) {
    const removeButtons = elements.eventsGrid.querySelectorAll('.btn-remove-event-drive');
    removeButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const eventId = btn.getAttribute('data-event-id');
        const eventTitle = btn.getAttribute('data-event-title') || 'this event';

        const confirmed = window.confirm(
          `Are you sure you want to remove the event drive:\n"${eventTitle}"?\n\nThis will remove it from active donation events and archive it.`
        );

        if (!confirmed) return;

        btn.disabled = true;
        btn.innerHTML = `
          <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
          <span>Removing...</span>
        `;

        try {
          const res = await removeEventInDB(eventId);
          if (res && res.error) {
            showToast(`Failed to remove event: ${res.error.message || 'Database error'}`, 'error');
            renderEvents();
            return;
          }

          // Update local state
          const target = state.events.find((e) => e.id === eventId);
          if (target) {
            target.isArchived = true;
            target.status = 'Archived';
          }

          showToast(`Event drive "${eventTitle}" was removed successfully.`);
          renderEvents();
        } catch (err) {
          console.error('[Remove Event Drive error]', err);
          showToast('Failed to remove event drive. Please try again.', 'error');
          renderEvents();
        }
      });
    });
  }
}
