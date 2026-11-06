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
  renderProfileView,
  showToast,
  normalizeRoleName,
  recalculateHospitalBloodNeeded,
} from './functions/index.js';

import {
  isSupabaseConfigured,
  getCurrentUser,
  onAuthStateChange,
  fetchUserProfileFromDB,
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

function mapBloodRequestRow(d) {
  const isAnon = Boolean(d.is_anonymous);
  return {
    id: d.id,
    userId: d.user_id || null,
    initials:
      d.initials ||
      (d.patient_name
        ? d.patient_name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : 'PT'),
    patientName: d.patient_name,
    age: isAnon ? null : d.age,
    bloodType: d.blood_type,
    unitsNeeded: d.units_needed,
    urgency: d.urgency,
    condition: d.condition || null,
    hospitalId: d.hospital_id,
    hospitalName: d.hospital_name,
    postedTime: d.posted_time ? formatRelativeTime(d.posted_time) : 'Recently',
    contactNumber: isAnon ? null : d.contact_number,
    email: isAnon ? null : d.email,
    emergencyContact: isAnon ? null : d.emergency_contact,
    relationshipToPatient: isAnon ? null : d.relationship_to_patient || null,
    doctorSlipUrl: d.doctor_slip_url || null,
    medicalReceiptNo: d.medical_receipt_no || null,
    receiptDate: d.medical_receipt_date || null,
    receiptPayor: isAnon ? null : d.medical_receipt_payor || null,
    receiptServices: d.medical_receipt_services || null,
    isAnonymous: isAnon,
    status: d.status || 'Pending',
    expiresAt: d.expires_at || null,
    isArchived: Boolean(d.is_archived),
    archivedReason: d.archived_reason || null,
    archivedAt: d.archived_at || null,
    verifiedByName: d.verified_by_name || null,
  };
}

export function init() {
  cacheElements();
  applyTheme(state.theme);
  recalculateHospitalBloodNeeded();
  updateUserProfileUI();
  setupEventListeners();

  // Supabase Auth and Database Synchronization
  if (isSupabaseConfigured()) {
    console.info('[BloodSync] Connected to Supabase backend! Synchronizing live tables...');

    // 1. Authenticated User Sync (retrieves session, profile, permissions, navigation, and user-specific data)
    getCurrentUser().then(async (u) => {
      if (u) {
        const profile = await fetchUserProfileFromDB(u.id, u.email);
        const normalizedRole = normalizeRoleName(profile?.role || u.user_metadata?.role || 'Donor');
        const isWebpageAdmin = normalizedRole === 'Webpage Admin';
        state.user = {
          id: u.id,
          username: profile?.username || u.user_metadata?.username || u.email?.split('@')[0] || 'User',
          email: u.email || profile?.email || '',
          contactNumber: profile?.contactNumber || u.user_metadata?.contact_number || '',
          isLoggedIn: true,
          role: normalizedRole,
          hospital: isWebpageAdmin ? '' : profile?.hospital || u.user_metadata?.hospital || '',
          hospitalId: isWebpageAdmin ? '' : profile?.hospitalId || u.user_metadata?.hospital_id || '',
          licenseNumber: profile?.licenseNumber || u.user_metadata?.license_number || '',
          bloodType: profile?.bloodType || u.user_metadata?.blood_type || 'O+',
        };
        try {
          localStorage.setItem('bloodsync_active_session_user', JSON.stringify(state.user));
        } catch {}
      } else {
        try {
          localStorage.removeItem('bloodsync_active_session_user');
        } catch {}
        state.user = { id: null, username: '', email: '', contactNumber: '', isLoggedIn: false, role: 'Donor' };
      }
      updateUserProfileUI();
      renderEvents();
      renderRequests();
      if (state.activeTab === 'profile') {
        renderProfileView();
      }
    });

    onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchUserProfileFromDB(session.user.id, session.user.email);
        const normalizedRole = normalizeRoleName(
          profile?.role || session.user.user_metadata?.role || 'Donor'
        );
        const isWebpageAdmin = normalizedRole === 'Webpage Admin';
        state.user = {
          id: session.user.id,
          username:
            profile?.username ||
            session.user.user_metadata?.username ||
            session.user.email?.split('@')[0] ||
            'User',
          email: session.user.email || profile?.email || '',
          contactNumber: profile?.contactNumber || session.user.user_metadata?.contact_number || '',
          isLoggedIn: true,
          role: normalizedRole,
          hospital: isWebpageAdmin ? '' : profile?.hospital || session.user.user_metadata?.hospital || '',
          hospitalId: isWebpageAdmin ? '' : profile?.hospitalId || session.user.user_metadata?.hospital_id || '',
          licenseNumber: profile?.licenseNumber || session.user.user_metadata?.license_number || '',
          bloodType: profile?.bloodType || session.user.user_metadata?.blood_type || 'O+',
        };
        try {
          localStorage.setItem('bloodsync_active_session_user', JSON.stringify(state.user));
        } catch {}
        updateUserProfileUI();
        renderEvents();
        renderRequests();
        if (state.activeTab === 'profile') {
          renderProfileView();
        }
      } else if (event === 'SIGNED_OUT') {
        try {
          localStorage.removeItem('bloodsync_active_session_user');
        } catch {}
        state.user = { id: null, username: '', email: '', contactNumber: '', isLoggedIn: false, role: 'Donor' };
        updateUserProfileUI();
        renderEvents();
        renderRequests();
      }
    });

    // 2. Fetch Hospitals from Supabase
    fetchHospitalsFromDB().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
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
        recalculateHospitalBloodNeeded();
        if (!state.hospitals.some((h) => h.id === state.activeMapHospital?.id)) {
          state.activeMapHospital = state.hospitals[0];
        }
        renderHospitals();
      }
    });

    // 3. Fetch Urgent Patient Requests from Supabase
    fetchRequestsFromDB().then((data) => {
      if (Array.isArray(data)) {
        state.requests = data.map(mapBloodRequestRow);
        recalculateHospitalBloodNeeded();
        renderHospitals();
        renderRequests();
        renderHomeUrgentRequests();
        if (state.activeTab === 'profile') {
          renderProfileView();
        }
      }
    });

    // 4. Fetch Donation Events from Supabase
    fetchEventsFromDB().then((data) => {
      if (Array.isArray(data)) {
        state.events = data.map((e) => ({
          id: e.id,
          title: e.title,
          location: e.location || e.venue || '',
          municipality: e.municipality || 'Cavite City, Cavite',
          contactDetails: e.contact_details || '',
          date: e.date,
          time: e.time,
          organizer: e.organizer,
          link: e.link || '',
          createdBy: e.created_by || null,
          creatorEmail: e.created_by_email || null,
          status: e.status || (e.is_archived ? 'Archived' : 'Active'),
          isArchived: Boolean(e.is_archived || e.status === 'Archived'),
          archivedAt: e.archived_at || null,
        }));
        renderEvents();
        if (state.activeTab === 'profile') {
          renderProfileView();
        }
      }
    });

    // 5. Real-time Subscriptions
    subscribeToNewRequests((payload) => {
      const newReq = payload?.new || payload;
      if (newReq && newReq.id && !state.requests.some((r) => r.id === newReq.id)) {
        state.requests.unshift(mapBloodRequestRow(newReq));
        recalculateHospitalBloodNeeded();
        renderHospitals();
        renderRequests();
        renderHomeUrgentRequests();
        if (state.activeTab === 'profile') {
          renderProfileView();
        }
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
            scheduleWeekdays: payload.new.schedule_weekdays || state.hospitals[idx].scheduleWeekdays,
            scheduleWeekends: payload.new.schedule_weekends || state.hospitals[idx].scheduleWeekends,
          };
          recalculateHospitalBloodNeeded();
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
            title: payload.new.title ?? state.events[idx].title,
            location: payload.new.location ?? state.events[idx].location,
            date: payload.new.date ?? state.events[idx].date,
            time: payload.new.time ?? state.events[idx].time,
            organizer: payload.new.organizer ?? state.events[idx].organizer,
            link: payload.new.link ?? state.events[idx].link,
            status: payload.new.status ?? (payload.new.is_archived ? 'Archived' : state.events[idx].status),
            isArchived: Boolean(payload.new.is_archived || payload.new.status === 'Archived'),
            archivedAt: payload.new.archived_at ?? state.events[idx].archivedAt,
          };
          renderEvents();
          if (state.activeTab === 'profile') {
            renderProfileView();
          }
        }
      } else if (payload.eventType === 'INSERT' && payload.new) {
        const e = payload.new;
        if (!state.events.some((existing) => existing.id === e.id)) {
          state.events.unshift({
            id: e.id,
            title: e.title,
            location: e.location || e.venue || '',
            municipality: e.municipality || 'Cavite City, Cavite',
            contactDetails: e.contact_details || '',
            date: e.date,
            time: e.time,
            organizer: e.organizer,
            link: e.link || '',
            createdBy: e.created_by || null,
            creatorEmail: e.created_by_email || null,
            status: e.status || (e.is_archived ? 'Archived' : 'Active'),
            isArchived: Boolean(e.is_archived || e.status === 'Archived'),
            archivedAt: e.archived_at || null,
          });
          renderEvents();
          if (state.activeTab === 'profile') {
            renderProfileView();
          }
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

  if (['home', 'hospitals', 'requests', 'events', 'profile'].includes(hash)) {
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
