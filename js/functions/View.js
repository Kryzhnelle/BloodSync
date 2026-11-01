import { state, elements, recalculateHospitalBloodNeeded } from './state.js';
import { navigateTo } from './navigation-tabs.js';
import { renderHospitalsMap, focusHospitalOnMap, calculateDistanceKm } from './hosMap.js';

/* Hospital View: Displays Hospital Map + Ranking Panel ABOVE the Hospital List on the same page */

export function renderHospitals() {
  // Always recalculate each hospital's bloodNeeded dynamically from active blood requests
  recalculateHospitalBloodNeeded();

  const { municipality, bloodType, sort, search } = state.hospitalsFilter;

  // Filter using the same Supabase hospital data for both map and list
  const filtered = state.hospitals
    .filter((h) => {
      const matchesLoc = municipality === 'All' || h.municipality === municipality;
      const matchesBlood =
        bloodType === 'All' ||
        (Array.isArray(h.bloodNeeded) && h.bloodNeeded.some((b) => b.type === bloodType));
      const matchesSearch =
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        h.address.toLowerCase().includes(search.toLowerCase());
      return matchesLoc && matchesBlood && matchesSearch;
    })
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'urgency') {
        const sumA = (a.bloodNeeded || []).reduce((acc, curr) => acc + (Number(curr.unitsNeeded) || 0), 0);
        const sumB = (b.bloodNeeded || []).reduce((acc, curr) => acc + (Number(curr.unitsNeeded) || 0), 0);
        return sumB - sumA;
      }
      if (sort === 'distance' && state.userLocation) {
        const distA = calculateDistanceKm(state.userLocation.lat, state.userLocation.lng, a.lat, a.lng);
        const distB = calculateDistanceKm(state.userLocation.lat, state.userLocation.lng, b.lat, b.lng);
        if (distA !== null && distB !== null) return distA - distB;
        if (distA !== null) return -1;
        if (distB !== null) return 1;
      }
      return 0;
    });

  if (elements.hospitalsCount) {
    elements.hospitalsCount.textContent = `${filtered.length} Facilities Found`;
  }

  const gridContainer = document.getElementById('hospitals-grid');
  const mapContainer = document.getElementById('hospitals-map-container');

  // Ensure both the Map section (above) and Hospital List section (below) are visible on the same page
  if (mapContainer) mapContainer.classList.remove('hidden-view');
  if (gridContainer) gridContainer.classList.remove('hidden-view');

  // Render Map + Closest Hospital Ranking Panel first so state.activeMapHospital is initialized
  renderHospitalsMap(filtered);

  if (gridContainer) {
    if (filtered.length === 0) {
      gridContainer.innerHTML = `
        <div class="col-span-full p-10 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center space-y-2">
          <p class="font-bold text-stone-800 dark:text-stone-200 text-base">No hospitals match your current filters.</p>
          <p class="text-xs text-stone-500">Try selecting "All Locations" or "All Blood Types" above.</p>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = filtered
      .map((hospital) => {
        const bloodNeededString =
          Array.isArray(hospital.bloodNeeded) && hospital.bloodNeeded.length > 0
            ? hospital.bloodNeeded.map((b) => `${b.type} (${b.unitsNeeded}u)`).join(' | ')
            : 'NONE CURRENTLY REQUESTED';

        const isSelected = state.activeMapHospital?.id === hospital.id;
        const distanceKm = state.userLocation
          ? calculateDistanceKm(state.userLocation.lat, state.userLocation.lng, hospital.lat, hospital.lng)
          : null;

        return `
        <div
          id="hospital-card-${hospital.id}"
          data-hospital-card-id="${hospital.id}"
          class="group bg-[#520A0F] text-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between border border-rose-900/40 cursor-pointer ${
            isSelected ? 'hospital-card-selected' : ''
          }"
        >
          <div class="relative h-48 sm:h-52 w-full overflow-hidden bg-stone-900">
            <img
              src="${hospital.image}"
              alt="${hospital.name}"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 filter brightness-95"
              loading="lazy"
            />
            <div class="absolute top-3 left-3 flex items-center gap-1.5">
              <span
                data-selected-hospital-badge
                class="${
                  isSelected ? '' : 'hidden'
                } px-2.5 py-1 rounded-full bg-amber-400 text-stone-950 text-[11px] font-black uppercase tracking-wider shadow"
              >
                Selected on Map
              </span>
              ${
                distanceKm !== null
                  ? `<span class="px-2.5 py-1 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 text-[11px] font-bold shadow">
                      ${distanceKm} km away
                    </span>`
                  : ''
              }
            </div>
            <div class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-semibold text-rose-200 border border-white/10">
              ${hospital.municipality || 'Cavite Facility'}
            </div>
          </div>

          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div class="space-y-2">
              <h3 class="text-lg font-bold text-white group-hover:text-rose-200 transition-colors leading-snug">
                ${hospital.name}
              </h3>
              <p class="text-xs text-stone-300 flex items-start gap-1.5 leading-relaxed">
                <svg class="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>${hospital.address}</span>
              </p>
              <p class="text-xs text-stone-300 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>${hospital.phone}</span>
              </p>
            </div>

            <div class="pt-3 border-t border-rose-900/50 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <span class="text-[11px] font-black uppercase tracking-wider text-rose-200 block truncate" title="BLOOD NEEDED: ${bloodNeededString}">
                  BLOOD NEEDED: ${bloodNeededString}
                </span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-focus-map-hospital="${hospital.id}"
                  class="px-3 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-bold text-xs border border-rose-800/80 transition-all cursor-pointer"
                  title="Focus this hospital on the map above"
                >
                  Pin on Map
                </button>
                <button
                  type="button"
                  data-select-hospital="${hospital.id}"
                  class="px-4 py-2 rounded-lg bg-[#270407] hover:bg-[#160204] text-white font-bold text-xs uppercase tracking-wider border border-rose-900/80 hover:border-rose-400 transition-all shadow hover:shadow-md shrink-0 cursor-pointer"
                >
                  DONATE
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    // Clicking a hospital card (or its "Pin on Map" button) focuses its marker on the map above
    gridContainer.querySelectorAll('[data-hospital-card-id]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-select-hospital]')) return;
        const hid = card.getAttribute('data-hospital-card-id');
        const clickedFocusBtn = Boolean(e.target.closest('[data-focus-map-hospital]'));
        if (hid) {
          focusHospitalOnMap(hid, { scrollToMap: clickedFocusBtn, scrollToCard: false });
        }
      });
    });

    // Clicking DONATE navigates to the Hospital Detail View
    gridContainer.querySelectorAll('[data-select-hospital]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hid = btn.getAttribute('data-select-hospital');
        const target = state.hospitals.find((h) => h.id === hid);
        if (target) navigateTo('hospitals', target);
      });
    });
  }
}
