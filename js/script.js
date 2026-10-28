import {
  state,
  elements,
  cacheElements,
  applyTheme,
  updateUserProfileUI,
  setupEventListeners,
  navigateTo,
  renderHomeUrgentRequests,
  renderHospitals,
  renderRequests,
  renderEvents,
  showToast,
} from './functions/index.js';

import {
  isSupabaseConfigured,
  getCurrentUser,
  onAuthStateChange,
  fetchHospitalsFromDB,
  fetchRequestsFromDB,
  fetchEventsFromDB,
  subscribeToNewRequests,
  subscribeToHospitals,
  subscribeToEvents,
} from './supabase.js';

function formatRelativeTime(dateInput) {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Recently';
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } catch {
    return 'Recently';
  }
}

export function init() {
  cacheElements();
  applyTheme(state.theme);
  updateUserProfileUI();
  setupEventListeners();

  // Supabase Auth and Database Synchronization
  if (isSupabaseConfigured()) {
    console.info('[BloodSync] Connected to Supabase backend! Synchronizing live tables...');

    // 1. Authenticated User Sync
    getCurrentUser().then((u) => {
      if (u) {
        state.user = {
          username: u.user_metadata?.username || u.email?.split('@')[0] || 'User',
          email: u.email || '',
          contactNumber: u.user_metadata?.contact_number || '',
          isLoggedIn: true,
          role: u.user_metadata?.role || 'Donor',
          bloodType: u.user_metadata?.blood_type || '',
        };
        updateUserProfileUI();
      }
    });

    onAuthStateChange((event, session) => {
      if (session?.user) {
        state.user = {
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          contactNumber: session.user.user_metadata?.contact_number || '',
          isLoggedIn: true,
          role: session.user.user_metadata?.role || 'Donor',
          bloodType: session.user.user_metadata?.blood_type || '',
        };
        updateUserProfileUI();
      } else if (event === 'SIGNED_OUT') {
        state.user = { username: '', email: '', contactNumber: '', isLoggedIn: false, role: 'Donor' };
        updateUserProfileUI();
      }
    });

    // 2. Fetch Hospitals from Supabase
    fetchHospitalsFromDB().then((data) => {
      if (data && data.length > 0) {
        state.hospitals = data.map((h) => ({
          id: h.id,
          name: h.name,
          address: h.address,
          municipality: h.municipality || 'Cavite City, Cavite',
          phone: h.phone || '',
          email: h.email || '',
          scheduleWeekdays: h.schedule_weekdays || '24 Hours',
          scheduleWeekends: h.schedule_weekends || '24 Hours',
          lat: Number(h.lat),
          lng: Number(h.lng),
          coordinates: { x: h.coord_x ?? 50, y: h.coord_y ?? 50 },
          bloodNeeded: Array.isArray(h.blood_needed) ? h.blood_needed : [],
          lastUpdated: h.last_updated || 'Live',
          image: h.image || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80',
        }));
        if (!state.hospitals.some((h) => h.id === state.activeMapHospital?.id)) {
          state.activeMapHospital = state.hospitals[0];
        }
        renderHospitals();
      }
    });

    // 3. Fetch Urgent Patient Requests from Supabase
    fetchRequestsFromDB().then((data) => {
      if (data && data.length > 0) {
        state.requests = data.map((d) => ({
          id: d.id,
          initials: d.initials || (d.patient_name ? d.patient_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) : 'PT'),
          patientName: d.patient_name,
          age: d.age,
          bloodType: d.blood_type,
          unitsNeeded: d.units_needed,
          urgency: d.urgency,
          condition: d.condition,
          hospitalId: d.hospital_id,
          hospitalName: d.hospital_name,
          postedTime: d.posted_time ? formatRelativeTime(d.posted_time) : 'Verified',
          contactNumber: d.contact_number,
          email: d.email,
          emergencyContact: d.emergency_contact,
        }));
        renderRequests();
        renderHomeUrgentRequests();
      }
    });

    // 4. Fetch Donation Events from Supabase
    fetchEventsFromDB().then((data) => {
      if (data && data.length > 0) {
        state.events = data.map((e) => ({
          id: e.id,
          title: e.title,
          location: e.location || e.venue || '',
          municipality: e.municipality || 'Cavite City, Cavite',
          date: e.date,
          time: e.time,
          organizer: e.organizer,
          link: e.link || '',
          totalSlots: e.total_slots ?? 50,
          slotsRemaining: e.slots_remaining ?? 35,
        }));
        renderEvents();
      }
    });

    // 5. Real-time Subscriptions
    subscribeToNewRequests((newReq) => {
      if (newReq && !state.requests.some((r) => r.id === newReq.id)) {
        state.requests.unshift({
          id: newReq.id,
          initials: newReq.initials || 'PT',
          patientName: newReq.patient_name,
          age: newReq.age,
          bloodType: newReq.blood_type,
          unitsNeeded: newReq.units_needed,
          urgency: newReq.urgency,
          condition: newReq.condition,
          hospitalId: newReq.hospital_id,
          hospitalName: newReq.hospital_name,
          postedTime: 'Just now',
          contactNumber: newReq.contact_number,
          email: newReq.email,
          emergencyContact: newReq.emergency_contact,
        });
        renderRequests();
        renderHomeUrgentRequests();
        showToast(`Realtime: New urgent appeal for ${newReq.patient_name || 'Patient'} (${newReq.blood_type})!`);
      }
    });

    subscribeToHospitals((payload) => {
      if (payload.eventType === 'UPDATE' && payload.new) {
        const idx = state.hospitals.findIndex((h) => h.id === payload.new.id);
        if (idx !== -1) {
          state.hospitals[idx] = {
            ...state.hospitals[idx],
            ...payload.new,
            bloodNeeded: payload.new.blood_needed || state.hospitals[idx].bloodNeeded,
            scheduleWeekdays: payload.new.schedule_weekdays || state.hospitals[idx].scheduleWeekdays,
            scheduleWeekends: payload.new.schedule_weekends || state.hospitals[idx].scheduleWeekends,
          };
          renderHospitals();
        }
      }
    });

    subscribeToEvents((payload) => {
      if (payload.eventType === 'UPDATE' && payload.new) {
        const idx = state.events.findIndex((e) => e.id === payload.new.id);
        if (idx !== -1) {
          state.events[idx] = {
            ...state.events[idx],
            totalSlots: payload.new.total_slots ?? state.events[idx].totalSlots,
            slotsRemaining: payload.new.slots_remaining ?? state.events[idx].slotsRemaining,
          };
          renderEvents();
        }
      }
    });
  }

  // Route according to initial URL hash or tab
  const hash = window.location.hash.replace('#', '');
  if (hash.startsWith('hospital-')) {
    const hid = hash.replace('hospital-', '');
    const h = state.hospitals.find((item) => item.id === hid);
    if (h) {
      navigateTo('hospitals', h);
      return;
    }
  }

  if (['home', 'hospitals', 'requests', 'events'].includes(hash)) {
    navigateTo(hash);
  } else {
    const pathname = window.location.pathname;
    if (pathname.includes('hospitals')) {
      navigateTo('hospitals');
    } else if (pathname.includes('requests')) {
      navigateTo('requests');
    } else if (pathname.includes('events')) {
      navigateTo('events');
    } else {
      navigateTo('home');
    }
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
