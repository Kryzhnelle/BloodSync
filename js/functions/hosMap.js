import { state } from './state.js';
import { navigateTo } from './navigation-tabs.js';
import { showToast } from './ToastNotif.js';
import L from 'leaflet';

let leafletMap = null;
let leafletTileLayer = null;
let markersLayer = null;
let userLocationMarker = null;
let controlsInitialized = false;

/**
 * Calculates distance in kilometers between two geographic coordinates using Haversine formula
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Round to 1 decimal place (e.g. 4.2 km)
}

// Expose hospital navigation to window for Leaflet HTML popups
if (typeof window !== 'undefined') {
  window.bloodsyncNavigateToHospital = (hospitalId) => {
    const target = state.hospitals.find((h) => h.id === hospitalId);
    if (target) {
      navigateTo('hospitals', target);
    }
  };
}

/**
 * Sets and updates the user's selected location (GPS or manual)
 * Recalculates distance to the active hospital and updates the UI
 */
export function setUserLocation(lat, lng, name, type = 'manual') {
  state.userLocation = { lat, lng, name, type };

  // Place or update user location marker on the Leaflet map
  if (leafletMap) {
    if (userLocationMarker) {
      userLocationMarker.setLatLng([lat, lng]);
      userLocationMarker.getPopup()?.setContent(`<b>${name}</b><br><span style="font-size: 11px;">Your Selected Starting Point</span>`);
    } else {
      const userIcon = L.divIcon({
        className: '',
        html: `
          <div class="user-location-marker">
            <div class="user-location-pulse"></div>
            <div class="user-location-core"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      userLocationMarker = L.marker([lat, lng], { icon: userIcon }).addTo(leafletMap);
      userLocationMarker.bindPopup(`<b>${name}</b><br><span style="font-size: 11px;">Your Selected Starting Point</span>`);
    }

    userLocationMarker.openPopup();
    leafletMap.panTo([lat, lng]);
  }

  // Update distance badge in the control panel
  updateDistanceBadge();

  // Re-render bottom drawer preview for the currently active hospital
  if (state.activeMapHospital) {
    renderMapDrawerPreview(state.activeMapHospital);
  }
}

/**
 * Updates the Distance Badge text in the control panel
 */
export function updateDistanceBadge() {
  const badgeText = document.getElementById('map-distance-text');
  if (!badgeText) return;

  if (!state.userLocation) {
    badgeText.textContent = 'Select location to compute distance';
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

  badgeText.textContent = `Location: ${state.userLocation.name}`;
}

/**
 * Setup location event listeners for GPS and manual dropdown
 */
function initLocationControls() {
  if (controlsInitialized) return;
  controlsInitialized = true;

  const gpsBtn = document.getElementById('map-use-current-location-btn');
  const locateMeBtn = document.getElementById('map-locate-me-btn');
  const manualSelect = document.getElementById('map-manual-location-select');

  const handleGpsRequest = () => {
    if (!('geolocation' in navigator)) {
      showToast('Geolocation is not supported by your browser. Please enter location manually.', 'error');
      manualSelect?.focus();
      return;
    }

    showToast('Requesting your device GPS location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        setUserLocation(uLat, uLng, 'My Current Location (GPS)', 'gps');
        showToast('Location acquired! Distance to hospitals updated.');
      },
      (err) => {
        console.warn('[Geolocation error]', err);
        showToast('Device location access was denied or unavailable. Please choose from manual locations.', 'error');
        if (manualSelect) {
          manualSelect.focus();
          manualSelect.classList.add('ring-2', 'ring-rose-500');
          setTimeout(() => manualSelect.classList.remove('ring-2', 'ring-rose-500'), 2500);
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  gpsBtn?.addEventListener('click', handleGpsRequest);
  locateMeBtn?.addEventListener('click', handleGpsRequest);

  manualSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    const [latStr, lngStr] = val.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const selectedOption = e.target.options[e.target.selectedIndex]?.text || 'Manual Location';

    if (!isNaN(lat) && !isNaN(lng)) {
      setUserLocation(lat, lng, selectedOption, 'manual');
      showToast(`Selected ${selectedOption}. Distance computed!`);
    }
  });
}

export function renderHospitalsMap(filteredHospitals) {
  initLocationControls();

  const floatingPillLocation = document.getElementById('map-floating-location');
  const floatingPillBlood = document.getElementById('map-floating-blood');

  if (floatingPillLocation) {
    floatingPillLocation.textContent = state.hospitalsFilter.municipality;
  }
  if (floatingPillBlood) {
    floatingPillBlood.textContent =
      state.hospitalsFilter.bloodType === 'All' ? 'All Blood' : state.hospitalsFilter.bloodType;
  }

  // Ensure active map hospital is within filtered or fallback
  if (!filteredHospitals.some((h) => h.id === state.activeMapHospital?.id)) {
    state.activeMapHospital = filteredHospitals[0] || state.hospitals[0];
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
    });

    L.control.zoom({ position: 'topright' }).addTo(leafletMap);

    leafletTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(leafletMap);

    markersLayer = L.layerGroup().addTo(leafletMap);
  }

  // Clear previous hospital markers
  if (markersLayer) {
    markersLayer.clearLayers();
  }

  // Add Leaflet markers for each hospital
  const bounds = L.latLngBounds();

  filteredHospitals.forEach((hospital) => {
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

    // Urgent blood badges for popup
    const urgentBadges = hospital.bloodNeeded
      .slice(0, 3)
      .map(
        (b) =>
          `<span class="px-1.5 py-0.5 rounded bg-rose-950 text-rose-200 font-bold text-[10px] border border-rose-800">${b.type} (${b.unitsNeeded}u)</span>`
      )
      .join(' ');

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

    marker.on('click', () => {
      state.activeMapHospital = hospital;
      updateDistanceBadge();
      renderMapDrawerPreview(hospital);
      renderHospitalsMap(filteredHospitals);
    });

    markersLayer.addLayer(marker);
  });

  // Fit bounds if valid and user location hasn't been set
  if (!state.userLocation && filteredHospitals.length > 0 && bounds.isValid()) {
    leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }

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

export function renderMapDrawerPreview(hospital) {
  const previewContainer = document.getElementById('map-preview-container');
  if (!previewContainer || !hospital) return;

  const distance = state.userLocation
    ? calculateDistanceKm(state.userLocation.lat, state.userLocation.lng, hospital.lat, hospital.lng)
    : null;

  previewContainer.innerHTML = `
    <div class="bg-[#4E080C] text-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-rose-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
              Urgent Needs: ${hospital.bloodNeeded.map((b) => `${b.type} (${b.unitsNeeded}u)`).join(', ')}
            </span>
            ${
              state.userLocation
                ? `<span class="text-[11px] text-stone-300">
                    From: <strong class="text-white">${state.userLocation.name}</strong>
                  </span>`
                : `<span class="text-[11px] text-rose-300/80 italic">Select your location above to calculate distance</span>`
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

  document.getElementById('choose-hospital-cta-btn')?.addEventListener('click', () => {
    navigateTo('hospitals', hospital);
  });
}
