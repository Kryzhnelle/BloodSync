import { state, elements } from './state.js';
import { renderHomeUrgentRequests } from './HUrgntReq.js';
import { renderHospitals } from './View.js';
import { renderHospitalDetail } from './hosDetails.js';
import { renderRequests } from './requests.js';
import { renderEvents } from './events.js';
import { renderProfileView } from './user-profile.js';

export function navigateTo(tab, hospital = null) {
  state.activeTab = tab;
  state.selectedHospital = hospital;

  // Update URL hash
  if (hospital) {
    window.location.hash = `#hospital-${hospital.id}`;
  } else {
    window.location.hash = `#${tab}`;
  }

  // Update navigation styling
  elements.navLinks.forEach((link) => {
    const linkTab = link.getAttribute('data-tab');
    const indicator = link.querySelector('.nav-indicator');
    if (linkTab === tab && !hospital) {
      link.classList.add('text-white', 'font-bold');
      link.classList.remove('text-stone-300');
      if (indicator) indicator.classList.remove('hidden');
    } else {
      link.classList.remove('text-white', 'font-bold');
      link.classList.add('text-stone-300');
      if (indicator) indicator.classList.add('hidden');
    }
  });

  // User Profile button active state
  const userProfileBtn = document.getElementById('user-profile-btn');
  if (userProfileBtn) {
    if (tab === 'profile' && !hospital) {
      userProfileBtn.classList.add('bg-white/25', 'ring-2', 'ring-white/80');
      userProfileBtn.classList.remove('bg-white/10');
    } else {
      userProfileBtn.classList.remove('bg-white/25', 'ring-2', 'ring-white/80');
      userProfileBtn.classList.add('bg-white/10');
    }
  }

  // Mobile drawer links
  elements.mobileNavLinks.forEach((link) => {
    const linkTab = link.getAttribute('data-mobile-tab');
    const dot = link.querySelector('.mobile-dot');
    if (linkTab === tab && !hospital) {
      link.classList.add('bg-white/15', 'text-white', 'font-bold');
      link.classList.remove('text-stone-300');
      if (dot) dot.classList.remove('hidden');
    } else {
      link.classList.remove('bg-white/15', 'text-white', 'font-bold');
      link.classList.add('text-stone-300');
      if (dot) dot.classList.add('hidden');
    }
  });

  // Toggle views
  elements.homeView?.classList.add('hidden-view');
  elements.hospitalsView?.classList.add('hidden-view');
  elements.hospitalDetailView?.classList.add('hidden-view');
  elements.requestsView?.classList.add('hidden-view');
  elements.eventsView?.classList.add('hidden-view');
  elements.profileView?.classList.add('hidden-view');

  if (hospital) {
    renderHospitalDetail(hospital);
    elements.hospitalDetailView?.classList.remove('hidden-view');
  } else {
    if (tab === 'home') {
      elements.homeView?.classList.remove('hidden-view');
      renderHomeUrgentRequests();
    } else if (tab === 'hospitals') {
      elements.hospitalsView?.classList.remove('hidden-view');
      renderHospitals();
    } else if (tab === 'requests') {
      elements.requestsView?.classList.remove('hidden-view');
      renderRequests();
    } else if (tab === 'events') {
      elements.eventsView?.classList.remove('hidden-view');
      renderEvents();
    } else if (tab === 'profile') {
      elements.profileView?.classList.remove('hidden-view');
      renderProfileView();
    }
  }

  // Close mobile drawer
  if (elements.mobileDrawer) {
    elements.mobileDrawer.classList.add('hidden');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
