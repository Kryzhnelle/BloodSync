import { state } from './state.js';
import { navigateTo } from './navigation-tabs.js';
import { showToast } from './ToastNotif.js';
import L from 'leaflet';

let leafletMap = null;
let leafletTileLayer = null;
let markersLayer = null;
let userLocationMarker = null;
let controlsInitialized = false;
let currentFilteredHospitals = [];
let hospitalMarkersById = new Map();

/**
 * Calculates distance in kilometers between two geographic coordinates using Haversine formula
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null ||
    isNaN(Number(lat1)) ||
    isNaN(Number(lon1)) ||
    isNaN(Number(lat2)) ||
    isNaN(Number(lon2))
  ) {
    return null;
  }
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (nLat1 === 0 && nLon1 === 0) return null;
  if (nLat2 === 0 && nLon2 === 0) return null;

  const R = 6371; // Radius of the Earth in km
  const dLat = (nLat2 - nLat1) * (Math.PI / 180);
  const dLon = (nLon2 - nLon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * (Math.PI / 180)) *
      Math.cos(nLat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Round to 1 decimal place (e.g. 4.2 km)
}

// Expose hospital navigation and pin removal to window for Leaflet HTML popups
if (typeof window !== 'undefined') {
  window.bloodsyncNavigateToHospital = (hospitalId) => {
    const target = state.hospitals.find((h) => h.id === hospitalId);
    if (target) {
      navigateTo('hospitals', target);
    }
  };
  window.bloodsyncRemoveUserPin = () => {
    clearUserLocation();
  };
}

/**
 * Clears the user's selected/pinned location and refreshes rankings and distances
 */
export function clearUserLocation() {
  state.userLocation = null;
  if (userLocationMarker && leafletMap) {
    leafletMap.removeLayer(userLocationMarker);
    userLocationMarker = null;
  }

  const clearPinBtn = document.getElementById('map-clear-pin-btn');
  clearPinBtn?.classList.add('hidden');
  clearPinBtn?.classList.remove('inline-flex');

  updateDistanceBadge();
  renderHospitalsMap(currentFilteredHospitals.length > 0 ? currentFilteredHospitals : state.hospitals);
  syncHospitalCardSelectionUI();
  showToast('Selected map pin removed.');
}

/**
 * Sets and updates the user's selected location (GPS, manual search, or map pin)
 * Recalculates distance to all hospitals and updates the map, ranking panel, and preview
 */
export function setUserLocation(lat, lng, name, type = 'manual') {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) return;

  state.userLocation = { lat: numLat, lng: numLng, name, type };

  const clearPinBtn = document.getElementById('map-clear-pin-btn');
  if (clearPinBtn) {
    clearPinBtn.classList.remove('hidden');
    clearPinBtn.classList.add('inline-flex');
  }

  // Place or update visually distinguishable user location pin on the Leaflet map
  if (leafletMap) {
    const popupContent = `
      <div class="p-3 text-stone-100 font-sans space-y-1.5 min-w-[190px]">
        <div class="flex items-center gap-1.5 text-blue-300 font-extrabold text-xs uppercase tracking-wider">
          <span>📍 Selected Pin Location</span>
        </div>
        <p class="text-xs font-bold text-white leading-snug">${name}</p>
        <p class="text-[11px] text-stone-300 font-mono">${numLat.toFixed(4)}, ${numLng.toFixed(4)}</p>
        <button
          type="button"
          onclick="window.bloodsyncRemoveUserPin()"
          class="w-full mt-1.5 py-1.5 px-2.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px] transition-colors cursor-pointer"
        >
          Remove Pin
        </button>
      </div>
    `;

    if (userLocationMarker) {
      userLocationMarker.setLatLng([numLat, numLng]);
      userLocationMarker.getPopup()?.setContent(popupContent);
    } else {
      const userIcon = L.divIcon({
        className: '',
        html: `
          <div class="user-location-marker" title="Your Pinned Reference Location (Drag or click map to move)">
            <div class="user-location-pulse"></div>
            <div class="user-location-core">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -18],
      });
      userLocationMarker = L.marker([numLat, numLng], { icon: userIcon, draggable: true }).addTo(leafletMap);
      userLocationMarker.bindPopup(popupContent, { className: 'bloodsync-popup' });

      userLocationMarker.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        if (pos) {
          setUserLocation(
            pos.lat,
            pos.lng,
            `Pinned Location (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`,
            'pin'
          );
        }
      });
    }

    leafletMap.panTo([numLat, numLng]);
  }

  // Update distance badge, ranking panel, markers, and bottom drawer preview
  updateDistanceBadge();
  renderHospitalsMap(currentFilteredHospitals.length > 0 ? currentFilteredHospitals : state.hospitals, {
    skipFitBounds: true,
  });
  syncHospitalCardSelectionUI();
}

/**
 * Enlarges the map in Map Focus Mode and shows the Exit Map Focus button
 */
export function enterMapFocusMode() {
  state.isMapFocused = true;
  const mapColumn = document.getElementById('map-canvas-column');
  const mapViewport = document.getElementById('map-viewport-box');
  const enterBtn = document.getElementById('enter-map-focus-btn');
  const exitBtn = document.getElementById('exit-map-focus-btn');
  const floatingExitBtn = document.getElementById('floating-exit-map-focus-btn');
  const modeBadge = document.getElementById('map-focus-status-badge');

  if (mapColumn) {
    mapColumn.classList.remove('lg:col-span-8');
    mapColumn.classList.add('lg:col-span-12');
  }
  if (mapViewport) {
    mapViewport.classList.remove('h-[440px]', 'sm:h-[520px]');
    mapViewport.classList.add('h-[72vh]', 'sm:h-[78vh]', 'ring-4', 'ring-rose-500/70');
  }

  enterBtn?.classList.add('hidden');
  enterBtn?.classList.remove('inline-flex');
  exitBtn?.classList.remove('hidden');
  exitBtn?.classList.add('inline-flex');
  floatingExitBtn?.classList.remove('hidden');
  floatingExitBtn?.classList.add('inline-flex');

  if (modeBadge) {
    modeBadge.textContent = 'Focus Mode Active — Click Exit Map Focus to return to normal scrolling';
    modeBadge.classList.add('bg-amber-400', 'text-stone-950');
    modeBadge.classList.remove('bg-[#40070B]', 'text-rose-200');
  }

  if (leafletMap) {
    leafletMap.scrollWheelZoom.enable();
    setTimeout(() => {
      leafletMap.invalidateSize();
      mapViewport?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }
}

/**
 * Restores the map to its normal page layout and scrolling behavior
 */
export function exitMapFocusMode() {
  state.isMapFocused = false;
  const mapColumn = document.getElementById('map-canvas-column');
  const mapViewport = document.getElementById('map-viewport-box');
  const enterBtn = document.getElementById('enter-map-focus-btn');
  const exitBtn = document.getElementById('exit-map-focus-btn');
  const floatingExitBtn = document.getElementById('floating-exit-map-focus-btn');
  const modeBadge = document.getElementById('map-focus-status-badge');

  if (mapColumn) {
    mapColumn.classList.remove('lg:col-span-12');
    mapColumn.classList.add('lg:col-span-8');
  }
  if (mapViewport) {
    mapViewport.classList.remove('h-[72vh]', 'sm:h-[78vh]', 'ring-4', 'ring-rose-500/70');
    mapViewport.classList.add('h-[440px]', 'sm:h-[520px]');
  }

  enterBtn?.classList.remove('hidden');
  enterBtn?.classList.add('inline-flex');
  exitBtn?.classList.add('hidden');
  exitBtn?.classList.remove('inline-flex');
  floatingExitBtn?.classList.add('hidden');
  floatingExitBtn?.classList.remove('inline-flex');

  if (modeBadge) {
    modeBadge.textContent = 'Click anywhere on map to place pin or focus';
    modeBadge.classList.remove('bg-amber-400', 'text-stone-950');
    modeBadge.classList.add('bg-[#40070B]', 'text-rose-200');
  }

  if (leafletMap) {
    leafletMap.scrollWheelZoom.disable();
    setTimeout(() => {
      leafletMap.invalidateSize();
    }, 120);
  }
}

let isMapPreviewClosed = false;

/**
 * Focuses the map on a specific hospital marker and synchronizes the list & ranking highlight
 */
export function focusHospitalOnMap(hospitalId, options = { scrollToMap: false, scrollToCard: false }) {
  const target = state.hospitals.find((h) => h.id === hospitalId);
  if (!target) return;

  state.activeMapHospital = target;
  isMapPreviewClosed = false;
  updateDistanceBadge();
  renderMapDrawerPreview(target);
  renderHospitalsMap(currentFilteredHospitals.length > 0 ? currentFilteredHospitals : state.hospitals, {
    skipFitBounds: true,
  });
  syncHospitalCardSelectionUI();

  if (leafletMap && target.lat && target.lng) {
    leafletMap.flyTo([target.lat, target.lng], Math.max(leafletMap.getZoom(), 14), {
      duration: 0.6,
    });
    const marker = hospitalMarkersById.get(target.id);
    if (marker) {
      setTimeout(() => marker.openPopup(), 350);
    }
  }

  if (options.scrollToMap) {
    document.getElementById('hospitals-map-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (options.scrollToCard) {
    const cardEl = document.getElementById(`hospital-card-${target.id}`);
    cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Synchronizes the visual selection state on hospital cards in #hospitals-grid
 */
export function syncHospitalCardSelectionUI() {
  const gridContainer = document.getElementById('hospitals-grid');
  if (!gridContainer) return;

  const activeId = state.activeMapHospital?.id;
  gridContainer.querySelectorAll('[data-hospital-card-id]').forEach((card) => {
    const cid = card.getAttribute('data-hospital-card-id');
    const badge = card.querySelector('[data-selected-hospital-badge]');
    if (cid === activeId) {
      card.classList.add('hospital-card-selected');
      badge?.classList.remove('hidden');
    } else {
      card.classList.remove('hospital-card-selected');
      badge?.classList.add('hidden');
    }
  });
}

/**
 * Updates the Distance Badge text in the control panel
 */
export function updateDistanceBadge() {
  const badgeText = document.getElementById('map-distance-text');
  if (!badgeText) return;

  if (!state.userLocation) {
    badgeText.textContent = 'Click map to pin or use GPS';
    return;
  }

  const activeHosp = state.activeMapHospital || state.hospitals[0];
  if (activeHosp && activeHosp.lat && activeHosp.lng) {
    const dist = calculateDistanceKm(
      state.userLocation.lat,
      state.userLocation.lng,
      activeHosp.lat,
      activeHosp.lng
    );
    if (dist !== null) {
      badgeText.innerHTML = `<strong>${dist} km</strong> to ${activeHosp.name}`;
      return;
    }
  }

  badgeText.textContent = `Pinned: ${state.userLocation.name}`;
}

/**
 * Renders the Closest Hospital Ranking Panel sorted from closest to farthest
 */
export function renderClosestHospitalRanking(hospitalsToRank) {
  const listEl = document.getElementById('closest-hospital-ranking-list');
  const refEl = document.getElementById('ranking-reference-location');
  if (!listEl) return;

  if (refEl) {
    if (state.userLocation) {
      const modeLabel =
        state.userLocation.type === 'gps'
          ? 'Current GPS Location'
          : state.userLocation.type === 'pin'
          ? 'Pinned Map Location'
          : 'Searched Address';
      refEl.innerHTML = `Reference: <strong class="text-white">${state.userLocation.name}</strong> <span class="text-rose-300">(${modeLabel})</span>`;
    } else {
      refEl.innerHTML = `Reference: <strong class="text-amber-300">Not set — click map to pin, use GPS, or search address above</strong>`;
    }
  }

  const sourceList = Array.isArray(hospitalsToRank) && hospitalsToRank.length > 0 ? hospitalsToRank : state.hospitals;

  // Compute actual distance for each hospital using registered Supabase coordinates
  const ranked = sourceList
    .map((hospital) => {
      const hasValidCoords =
        hospital.lat != null &&
        hospital.lng != null &&
        !isNaN(Number(hospital.lat)) &&
        !isNaN(Number(hospital.lng)) &&
        (Number(hospital.lat) !== 0 || Number(hospital.lng) !== 0);

      const distanceKm =
        hasValidCoords && state.userLocation
          ? calculateDistanceKm(state.userLocation.lat, state.userLocation.lng, hospital.lat, hospital.lng)
          : null;

      return {
        hospital,
        hasValidCoords,
        distanceKm,
      };
    })
    .sort((a, b) => {
      // Hospitals with valid calculated distances appear first, sorted closest to farthest
      if (a.distanceKm !== null && b.distanceKm !== null) {
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        return a.hospital.name.localeCompare(b.hospital.name);
      }
      if (a.distanceKm !== null && b.distanceKm === null) return -1;
      if (a.distanceKm === null && b.distanceKm !== null) return 1;
      // Hospitals with valid coordinates come before missing/invalid coordinates
      if (a.hasValidCoords && !b.hasValidCoords) return -1;
      if (!a.hasValidCoords && b.hasValidCoords) return 1;
      return a.hospital.name.localeCompare(b.hospital.name);
    });

  if (ranked.length === 0) {
    listEl.innerHTML = `
      <div class="p-4 rounded-xl bg-black/20 border border-rose-900/40 text-center text-xs text-rose-200">
        No hospitals match the current filter.
      </div>
    `;
    return;
  }

  listEl.innerHTML = ranked
    .map((item, idx) => {
      const { hospital, hasValidCoords, distanceKm } = item;
      const rankNum = idx + 1;
      const isSelected = state.activeMapHospital?.id === hospital.id;
      const totalUnits = Array.isArray(hospital.bloodNeeded)
        ? hospital.bloodNeeded.reduce((sum, b) => sum + (Number(b.unitsNeeded) || 0), 0)
        : 0;

      let distanceBadgeHtml = '';
      if (distanceKm !== null) {
        distanceBadgeHtml = `
          <span class="px-2 py-0.5 rounded-full ${
            rankNum === 1
              ? 'bg-emerald-500 text-stone-950 font-black'
              : 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/70 font-bold'
          } text-[11px] shrink-0">
            ${distanceKm} km
          </span>
        `;
      } else if (!hasValidCoords) {
        distanceBadgeHtml = `
          <span class="px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 text-[10px] font-semibold shrink-0">
            Coords N/A
          </span>
        `;
      } else {
        distanceBadgeHtml = `
          <span class="px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60 text-[10px] font-semibold shrink-0">
            Set pin / GPS
          </span>
        `;
      }

      return `
        <div
          data-rank-hospital-id="${hospital.id}"
          class="p-3 rounded-xl transition-all cursor-pointer border ${
            isSelected
              ? 'bg-rose-900/70 border-amber-300 shadow-md'
              : 'bg-black/25 hover:bg-black/40 border-rose-900/40'
          } flex items-center justify-between gap-2.5"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-7 h-7 rounded-lg ${
              rankNum === 1 && distanceKm !== null
                ? 'bg-amber-400 text-stone-950 font-black'
                : isSelected
                ? 'bg-white text-[#52090E] font-black'
                : 'bg-rose-950 text-rose-200 font-bold border border-rose-800'
            } flex items-center justify-center text-xs shrink-0">
              #${rankNum}
            </div>
            <div class="min-w-0">
              <p class="text-xs font-bold text-white truncate leading-snug">${hospital.name}</p>
              <p class="text-[11px] text-rose-200/80 truncate">
                ${hospital.municipality || hospital.address}
                ${totalUnits > 0 ? ` • <strong class="text-rose-200">${totalUnits}u needed</strong>` : ''}
              </p>
            </div>
          </div>
          ${distanceBadgeHtml}
        </div>
      `;
    })
    .join('');

  listEl.querySelectorAll('[data-rank-hospital-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const hid = row.getAttribute('data-rank-hospital-id');
      if (hid) {
        focusHospitalOnMap(hid, { scrollToMap: false, scrollToCard: false });
      }
    });
  });
}

/**
 * Geocodes an address or landmark using fast local known landmarks and live OpenStreetMap Nominatim
 */
async function geocodeAddress(query) {
  if (!query || !query.trim()) return null;
  const clean = query.trim();
  const lower = clean.toLowerCase();

  // Known Cavite landmark fast matches for reliability & responsiveness
  const knownLocations = [
    { match: 'caridad', lat: 14.4820, lng: 120.8965, name: 'Caridad, Cavite City' },
    { match: 'san roque', lat: 14.4788, lng: 120.9022, name: 'San Roque, Cavite City' },
    { match: 'samonte', lat: 14.4855, lng: 120.9080, name: 'Samonte Park, Cavite City' },
    { match: 'dalahican', lat: 14.4633, lng: 120.8818, name: 'Dalahican, Cavite City' },
    { match: 'cavite city', lat: 14.4820, lng: 120.8965, name: 'Cavite City Center' },
    { match: 'kawit', lat: 14.4443, lng: 120.9025, name: 'Kawit, Cavite' },
    { match: 'noveleta', lat: 14.4285, lng: 120.8803, name: 'Noveleta, Cavite' },
    { match: 'rosario', lat: 14.4144, lng: 120.8572, name: 'Rosario, Cavite' },
    { match: 'bacoor', lat: 14.4624, lng: 120.9647, name: 'Bacoor City, Cavite' },
    { match: 'imus', lat: 14.4296, lng: 120.9367, name: 'Imus City, Cavite' },
    { match: 'dasma', lat: 14.3294, lng: 120.9367, name: 'Dasmariñas City, Cavite' },
    { match: 'general trias', lat: 14.3833, lng: 120.8833, name: 'General Trias, Cavite' },
    { match: 'tanza', lat: 14.3944, lng: 120.8528, name: 'Tanza, Cavite' },
  ];

  const localMatch = knownLocations.find((k) => lower.includes(k.match));
  if (localMatch) {
    return { lat: localMatch.lat, lng: localMatch.lng, displayName: localMatch.name };
  }

  // Live Nominatim geocoding
  try {
    const searchQuery = clean.includes('cavite') || clean.includes('philippines') ? clean : `${clean}, Cavite, Philippines`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name.split(',').slice(0, 3).join(','),
        };
      }
    }
  } catch (err) {
    console.warn('[Geocoding API]', err);
  }

  return null;
}

/**
 * Setup location, pinning, and map focus event listeners
 */
function initLocationControls() {
  if (controlsInitialized) return;
  controlsInitialized = true;

  const gpsBtn = document.getElementById('map-use-current-location-btn');
  const locateMeBtn = document.getElementById('map-locate-me-btn');
  const clearPinBtn = document.getElementById('map-clear-pin-btn');
  const enterFocusBtn = document.getElementById('enter-map-focus-btn');
  const exitFocusBtn = document.getElementById('exit-map-focus-btn');
  const floatingExitFocusBtn = document.getElementById('floating-exit-map-focus-btn');
  const searchForm = document.getElementById('map-address-search-form');
  const searchInput = document.getElementById('map-address-search-input');
  const searchBtn = document.getElementById('map-address-search-btn');

  const handleGpsRequest = () => {
    if (!('geolocation' in navigator)) {
      showToast('Geolocation is not supported by your browser. Please enter your address manually.', 'error');
      searchInput?.focus();
      return;
    }

    showToast('Requesting device GPS location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        setUserLocation(uLat, uLng, 'My Current Location (GPS)', 'gps');
        showToast('Location acquired! Hospital distance ranking updated.');
      },
      (err) => {
        console.warn('[Geolocation error]', err);
        showToast('Device location access was denied or unavailable. Please type your address or click on the map to place a pin.', 'error');
        if (searchInput) {
          searchInput.focus();
          searchInput.classList.add('ring-2', 'ring-rose-500');
          setTimeout(() => searchInput.classList.remove('ring-2', 'ring-rose-500'), 2500);
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  gpsBtn?.addEventListener('click', handleGpsRequest);
  locateMeBtn?.addEventListener('click', handleGpsRequest);
  clearPinBtn?.addEventListener('click', clearUserLocation);

  enterFocusBtn?.addEventListener('click', enterMapFocusMode);
  exitFocusBtn?.addEventListener('click', exitMapFocusMode);
  floatingExitFocusBtn?.addEventListener('click', exitMapFocusMode);

  searchForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = searchInput?.value?.trim();
    if (!query) {
      showToast('Please type an address, street, or municipality name.', 'error');
      searchInput?.focus();
      return;
    }

    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.innerHTML = `
        <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
        <span>Locating...</span>
      `;
    }

    try {
      const geo = await geocodeAddress(query);
      if (geo && !isNaN(geo.lat) && !isNaN(geo.lng)) {
        setUserLocation(geo.lat, geo.lng, geo.displayName, 'manual');
        showToast(`Found: ${geo.displayName}. Closest hospitals ranked!`);
      } else {
        showToast(`Could not find "${query}". Please check the spelling or click directly on the map to drop a pin.`, 'error');
      }
    } catch (err) {
      console.error('[Geocoding error]', err);
      showToast('Geocoding service is temporarily unreachable. Please try again.', 'error');
    } finally {
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.innerHTML = `
          <svg class="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>Search</span>
        `;
      }
    }
  });
}

export function renderHospitalsMap(filteredHospitals, options = {}) {
  initLocationControls();
  currentFilteredHospitals = Array.isArray(filteredHospitals) ? filteredHospitals : state.hospitals;

  // Ensure active map hospital is within filtered or fallback
  if (!currentFilteredHospitals.some((h) => h.id === state.activeMapHospital?.id)) {
    state.activeMapHospital = currentFilteredHospitals[0] || state.hospitals[0];
  }

  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl) return;

  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Initialize map if not yet created
  if (!leafletMap) {
    leafletMap = L.map('leaflet-map', {
      center: [14.4750, 120.8980], // Cavite City center
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false, // Disabled in normal layout so page scroll isn't hijacked; enabled in Focus Mode
    });

    L.control.zoom({ position: 'topright' }).addTo(leafletMap);

    leafletTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(leafletMap);

    markersLayer = L.layerGroup().addTo(leafletMap);

    // Clicking on the map places/updates the user-selected pin AND activates Focus Mode if not yet focused
    leafletMap.on('click', (e) => {
      if (!state.isMapFocused) {
        enterMapFocusMode();
      }
      if (e?.latlng) {
        const { lat, lng } = e.latlng;
        setUserLocation(
          lat,
          lng,
          `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          'pin'
        );
        showToast('Pin placed on map! Closest hospitals updated.');
      }
    });
  }

  // Clear previous hospital markers
  if (markersLayer) {
    markersLayer.clearLayers();
  }
  hospitalMarkersById.clear();

  // Add Leaflet markers for each hospital
  const bounds = L.latLngBounds();

  currentFilteredHospitals.forEach((hospital) => {
    if (!hospital.lat || !hospital.lng) return;

    const isSelected = state.activeMapHospital?.id === hospital.id;
    bounds.extend([hospital.lat, hospital.lng]);

    const markerIcon = L.divIcon({
      className: '',
      html: `
        <div class="bloodsync-marker-wrapper ${isSelected ? 'is-selected' : ''}" data-hospital-id="${hospital.id}">
          <div class="bloodsync-marker-pulse"></div>
          <div class="bloodsync-marker-core">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5C12 2.5 5 13 5 17.5C5 21.5 8.1 24 12 24C15.9 24 19 21.5 19 17.5C19 13 12 2.5 12 2.5Z"/></svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -18],
    });

    const marker = L.marker([hospital.lat, hospital.lng], { icon: markerIcon });

    // Calculate distance from user selected location if available
    const distance = state.userLocation
      ? calculateDistanceKm(state.userLocation.lat, state.userLocation.lng, hospital.lat, hospital.lng)
      : null;

    // Urgent blood badges for popup (derived from active blood requests)
    const urgentBadges =
      Array.isArray(hospital.bloodNeeded) && hospital.bloodNeeded.length > 0
        ? hospital.bloodNeeded
            .slice(0, 4)
            .map(
              (b) =>
                `<span class="px-1.5 py-0.5 rounded bg-rose-950 text-rose-200 font-bold text-[10px] border border-rose-800">${b.type} (${b.unitsNeeded}u)</span>`
            )
            .join(' ')
        : `<span class="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-semibold text-[10px]">No active blood requests</span>`;

    const popupHtml = `
      <div class="w-64 p-3.5 space-y-2 text-stone-100 font-sans">
        <div class="h-24 w-full rounded-xl overflow-hidden mb-2 bg-stone-900 border border-rose-900/40">
          <img src="${hospital.image}" alt="${hospital.name}" class="w-full h-full object-cover" />
        </div>
        <h4 class="font-bold text-sm text-white leading-tight">${hospital.name}</h4>
        <p class="text-xs text-rose-200/80 leading-snug">${hospital.address}</p>
        ${
          distance !== null
            ? `<div class="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                <span>${distance} km away from your location</span>
              </div>`
            : ''
        }
        <div class="flex flex-wrap gap-1 pt-1">${urgentBadges}</div>
        <button
          onclick="window.bloodsyncNavigateToHospital('${hospital.id}')"
          class="w-full mt-2.5 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase tracking-wider text-center cursor-pointer shadow transition-colors block"
        >
          View Hospital Details →
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml, { className: 'bloodsync-popup', maxWidth: 280 });

    marker.on('click', (ev) => {
      L.DomEvent.stopPropagation(ev);
      state.activeMapHospital = hospital;
      isMapPreviewClosed = false;
      updateDistanceBadge();
      renderMapDrawerPreview(hospital);
      renderHospitalsMap(currentFilteredHospitals, { skipFitBounds: true });
      syncHospitalCardSelectionUI();
      setTimeout(() => {
        const refreshedMarker = hospitalMarkersById.get(hospital.id);
        refreshedMarker?.openPopup();
      }, 50);
    });

    markersLayer.addLayer(marker);
    hospitalMarkersById.set(hospital.id, marker);
  });

  // Fit bounds if valid and user location hasn't been set
  if (!options.skipFitBounds && !state.userLocation && currentFilteredHospitals.length > 0 && bounds.isValid()) {
    leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }

  // Render Closest Hospital Ranking Panel
  renderClosestHospitalRanking(currentFilteredHospitals);

  // Invalidate map size so tiles render smoothly
  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 100);

  // Render bottom drawer preview
  if (state.activeMapHospital) {
    updateDistanceBadge();
    renderMapDrawerPreview(state.activeMapHospital);
  }
}

export function closeMapDrawerPreview() {
  isMapPreviewClosed = true;
  const previewContainer = document.getElementById('map-preview-container');
  if (previewContainer) {
    previewContainer.classList.add('hidden');
    previewContainer.innerHTML = '';
  }
}

export function renderMapDrawerPreview(hospital) {
  const previewContainer = document.getElementById('map-preview-container');
  if (!previewContainer || !hospital) return;

  if (isMapPreviewClosed) {
    previewContainer.classList.add('hidden');
    return;
  }

  previewContainer.classList.remove('hidden');

  const distance = state.userLocation
    ? calculateDistanceKm(state.userLocation.lat, state.userLocation.lng, hospital.lat, hospital.lng)
    : null;

  const bloodNeedsSummary =
    Array.isArray(hospital.bloodNeeded) && hospital.bloodNeeded.length > 0
      ? hospital.bloodNeeded.map((b) => `${b.type} (${b.unitsNeeded}u)`).join(', ')
      : 'None currently requested';

  previewContainer.innerHTML = `
    <div class="relative bg-[#4E080C] text-white rounded-2xl p-4 sm:p-5 pr-11 sm:pr-14 shadow-2xl border border-rose-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <button
        type="button"
        id="close-map-preview-btn"
        class="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/35 hover:bg-black/60 text-rose-200 hover:text-white border border-rose-800/50 flex items-center justify-center transition-colors cursor-pointer"
        aria-label="Close hospital preview"
        title="Close preview"
      >
        <svg class="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>

      <div class="flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-rose-300 shrink-0 mt-0.5">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="text-base sm:text-lg font-bold text-white leading-tight">
              ${hospital.name}
            </h4>
            ${
              distance !== null
                ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-900/90 text-emerald-200 border border-emerald-500/80 text-xs font-bold shadow-sm">
                    <svg class="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                    <span>${distance} km away</span>
                  </span>`
                : ''
            }
          </div>
          <p class="text-xs sm:text-sm text-stone-300">
            ${hospital.address}
          </p>
          <div class="flex flex-wrap items-center gap-2 pt-0.5">
            <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-200 border border-rose-800/40">
              Active Blood Requests: ${bloodNeedsSummary}
            </span>
            ${
              state.userLocation
                ? `<span class="text-[11px] text-stone-300">
                    From: <strong class="text-white">${state.userLocation.name}</strong>
                  </span>`
                : `<span class="text-[11px] text-rose-300/80 italic">Click map to drop a pin or use GPS above to calculate distance</span>`
            }
          </div>
        </div>
      </div>

      <button
        id="choose-hospital-cta-btn"
        class="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-[#4E080C] hover:bg-rose-100 font-extrabold text-sm uppercase tracking-wider shadow-lg transition-all text-center shrink-0 cursor-pointer"
      >
        Choose this Hospital
      </button>
    </div>
  `;

  document.getElementById('close-map-preview-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMapDrawerPreview();
  });

  document.getElementById('choose-hospital-cta-btn')?.addEventListener('click', () => {
    navigateTo('hospitals', hospital);
  });
}
