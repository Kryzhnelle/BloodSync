export const state = {
  hospitals: [],
  requests: [],
  events: [],
  staffAccounts: [],
  user: {},
  activeTab: 'home',
  selectedHospital: null,
  selectedRequest: null,
  activeMapHospital: null,
  selectedCertificateRequest: null,
  profileSearchQuery: '',
  profileApprovalFilterOnly: false,
  hospitalsFilter: {
    municipality: 'All',
    bloodType: 'All',
    sort: 'name',
    view: 'grid',
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
  userLocation: null, // { lat: number, lng: number, name: string, type: 'gps' | 'manual' }
};

// Set initial active map hospital
state.activeMapHospital = state.hospitals[0];

export const elements = {};

// Ensure state and elements are globally accessible in window as well
if (typeof window !== 'undefined') {
  window.state = state;
  window.elements = elements;
}
