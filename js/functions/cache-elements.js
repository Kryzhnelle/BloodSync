import { elements } from './state.js';

export function cacheElements() {
  elements.html = document.documentElement;
  elements.themeToggles = document.querySelectorAll('.theme-toggle-btn');
  elements.navLinks = document.querySelectorAll('[data-tab]');
  elements.mobileNavLinks = document.querySelectorAll('[data-mobile-tab]');
  elements.mobileDrawer = document.getElementById('mobile-drawer');
  elements.mobileMenuToggle = document.getElementById('mobile-nav-toggle-btn');
  elements.profileDropdownMenu = document.getElementById('profile-dropdown-menu');
  elements.userProfileContainer = document.getElementById('user-profile-container');
  elements.mobileAuthContainer = document.getElementById('mobile-auth-container');

  // Views
  elements.homeView = document.getElementById('home-view');
  elements.hospitalsView = document.getElementById('hospitals-view');
  elements.hospitalDetailView = document.getElementById('hospital-detail-view');
  elements.requestsView = document.getElementById('requests-view');
  elements.eventsView = document.getElementById('events-view');
  elements.profileView = document.getElementById('profile-view');

  // Dynamic View Containers
  elements.hospitalsGrid = document.getElementById('hospitals-grid');
  elements.hospitalsCount = document.getElementById('hospitals-count');
  elements.requestsGrid = document.getElementById('patients-requests-grid');
  elements.requestsEmpty = document.getElementById('requests-empty-state');
  elements.eventsGrid = document.getElementById('events-cards-grid');
  elements.profileViewContent = document.getElementById('profile-view-content');

  // Modals
  elements.authModal = document.getElementById('auth-modal');
  elements.viewContactModal = document.getElementById('view-contact-modal');
  elements.screeningModal = document.getElementById('donor-screening-modal');
  elements.newRequestModal = document.getElementById('new-request-modal');
  elements.eventBookingModal = document.getElementById('event-booking-modal');
  elements.addEventModal = document.getElementById('add-event-modal');
  elements.certificateModal = document.getElementById('certificate-modal');
}
