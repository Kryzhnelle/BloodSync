import { isSupabaseConfigured } from '../supabase.js';

export function normalizeRoleName(role) {
  if (!role) return 'Donor';
  if (role === 'Hospital Admin' || role === 'Admin') return 'Webpage Admin';
  return role;
}

function getInitialUserState() {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('bloodsync_active_session_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email && parsed.isLoggedIn) {
          parsed.role = normalizeRoleName(parsed.role);
          if (parsed.role === 'Webpage Admin') {
            parsed.hospital = '';
            parsed.hospitalId = '';
          }
          parsed.notifyBloodTypeMatch = Boolean(parsed.notifyBloodTypeMatch);
          return parsed;
        }
      }
    } catch {}
  }
  return {
    id: null,
    username: '',
    email: '',
    contactNumber: '',
    isLoggedIn: false,
    role: 'Donor',
    hospital: '',
    hospitalId: '',
    bloodType: 'O+',
    notifyBloodTypeMatch: false,
  };
}

const useSupabaseLive = isSupabaseConfigured();

export const state = {
  hospitals: [],
  requests: [],
  events: [],
  staffAccounts: [],
  user: getInitialUserState(),
  activeTab: 'home',
  selectedHospital: null,
  selectedRequest: null,
  activeMapHospital: null,
  selectedCertificateRequest: null,
  profileSearchQuery: '',
  profileApprovalFilterOnly: false,
  isMapFocused: false,
  hospitalsFilter: {
    municipality: 'All',
    bloodType: 'All',
    sort: 'name',
    view: 'both',
    search: '',
  },
  requestsFilter: {
    bloodType: 'All',
    urgency: 'All',
    search: '',
  },
  theme: localStorage.getItem('bloodsync_theme') || 'dark',
  activeModalEvent: null,
  bookedEventIds: new Set(),
  userLocation: null, // { lat: number, lng: number, name: string, type: 'gps' | 'manual' | 'pin' }
};

/**
 * Dynamically calculates each hospital's bloodNeeded totals directly from active blood requests.
 * Excludes archived, expired, cancelled, or fulfilled requests and ensures each request is counted once.
 */
export function recalculateHospitalBloodNeeded() {
  if (!Array.isArray(state.hospitals)) return;
  const now = Date.now();
  const seenRequestIds = new Set();

  // Map of hospital.id -> { [bloodType]: totalUnits }
  const totalsByHospital = new Map();
  state.hospitals.forEach((h) => {
    totalsByHospital.set(h.id, {});
  });

  if (Array.isArray(state.requests)) {
    state.requests.forEach((req) => {
      if (!req || !req.id) return;
      if (seenRequestIds.has(req.id)) return;

      // Only include active/current requests
      if (req.isArchived || req.is_archived) return;
      const status = req.status || 'Pending';
      if (status === 'Archived' || status === 'Cancelled' || status === 'Fulfilled') return;

      const expRaw = req.expiresAt || req.expires_at;
      if (expRaw) {
        const expTime = new Date(expRaw).getTime();
        if (!isNaN(expTime) && expTime <= now) return;
      }

      const units = Number(req.unitsNeeded ?? req.units_needed ?? 0);
      const bType = (req.bloodType || req.blood_type || '').trim();
      if (!bType || units <= 0) return;

      // Match hospital by hospitalId first, fallback to hospitalName
      const reqHospId = (req.hospitalId || req.hospital_id || '').trim();
      const reqHospName = (req.hospitalName || req.hospital_name || '').trim().toLowerCase();

      let matchedHospital = null;
      if (reqHospId) {
        matchedHospital = state.hospitals.find((h) => h.id === reqHospId);
      }
      if (!matchedHospital && reqHospName) {
        matchedHospital = state.hospitals.find(
          (h) => (h.name || '').trim().toLowerCase() === reqHospName
        );
      }
      if (!matchedHospital) return;

      seenRequestIds.add(req.id);
      const hospTotals = totalsByHospital.get(matchedHospital.id) || {};
      hospTotals[bType] = (hospTotals[bType] || 0) + units;
      totalsByHospital.set(matchedHospital.id, hospTotals);
    });
  }

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });

  state.hospitals.forEach((hospital) => {
    const hospTotals = totalsByHospital.get(hospital.id) || {};
    const computedList = Object.entries(hospTotals)
      .filter(([, unitsNeeded]) => unitsNeeded > 0)
      .map(([type, unitsNeeded]) => ({ type, unitsNeeded }))
      .sort((a, b) => b.unitsNeeded - a.unitsNeeded || a.type.localeCompare(b.type));

    hospital.bloodNeeded = computedList;
    hospital.lastUpdated = todayFormatted;
  });
}

// Set initial active map hospital and calculate initial bloodNeeded totals
state.activeMapHospital = state.hospitals[0] || null;
recalculateHospitalBloodNeeded();

export const elements = {};

// Ensure state and elements are globally accessible in window as well
if (typeof window !== 'undefined') {
  window.state = state;
  window.elements = elements;
}
