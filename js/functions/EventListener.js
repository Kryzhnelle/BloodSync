import { state, elements } from './state.js';
import { toggleTheme } from './theme.js';
import { navigateTo } from './navigation-tabs.js';
import { renderHospitals } from './View.js';
import { renderRequests } from './requests.js';
import { closeAuthModal } from './authModal.js';
import { closeContactModal } from './view-contact-modal.js';
import { openScreeningModal, closeScreeningModal } from './donor-screening-modal.js';
import { openNewRequestModal, closeNewRequestModal } from './new-patient-req-modal.js';
import { closeEventBookingModal } from './OpenCloseBookingModal.js';
import { openAddEventModal, closeAddEventModal } from './add-event-modal.js';
import { closeCertificateModal } from './check-certificate-modal.js';
import { closeAdminProvisionModal, setupAdminProvisionListeners } from './admin-provision-modal.js';
import { renderProfileView } from './user-profile.js';
import { showToast } from './ToastNotif.js';
import { createBloodRequestInDB } from '../supabase.js';
import { isValidContactNumber } from './contact-utils.js';

/* ==========================================================================
   Global Event Handlers Setup
   ========================================================================== */
export function setupEventListeners() {
  // Theme toggles
  elements.themeToggles.forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });

  // Mobile menu toggle
  elements.mobileMenuToggle?.addEventListener('click', () => {
    elements.mobileDrawer?.classList.toggle('hidden');
  });

  // Nav links
  elements.navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.getAttribute('data-tab');
      if (tab) navigateTo(tab);
    });
  });

  elements.mobileNavLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.getAttribute('data-mobile-tab');
      if (tab) navigateTo(tab);
    });
  });

  // Brand logo clicks -> go Home
  document.querySelectorAll('[data-nav-home]').forEach((el) => {
    el.addEventListener('click', () => navigateTo('home'));
  });

  // Hero CTAs
  document.getElementById('hero-register-donate-btn')?.addEventListener('click', () => {
    openScreeningModal();
  });

  document.getElementById('hero-request-blood-btn')?.addEventListener('click', () => {
    openNewRequestModal();
  });

  document.getElementById('view-all-requests-btn')?.addEventListener('click', () => {
    navigateTo('requests');
  });

  document.getElementById('find-nearest-hospital-hero-btn')?.addEventListener('click', () => {
    navigateTo('hospitals');
  });

  // Feature cards CTAs in Home
  document.getElementById('feat-action-screening')?.addEventListener('click', openScreeningModal);
  document.getElementById('feat-action-hospitals')?.addEventListener('click', () => navigateTo('hospitals'));
  document.getElementById('feat-action-new-request')?.addEventListener('click', openNewRequestModal);
  document.getElementById('feat-action-events')?.addEventListener('click', () => navigateTo('events'));
  document.getElementById('feat-action-requests')?.addEventListener('click', () => navigateTo('requests'));

  // Hospitals Filter Bar controls
  document.getElementById('filter-location-select')?.addEventListener('change', (e) => {
    state.hospitalsFilter.municipality = e.target.value;
    renderHospitals();
  });

  document.getElementById('filter-blood-select')?.addEventListener('change', (e) => {
    state.hospitalsFilter.bloodType = e.target.value;
    renderHospitals();
  });

  document.getElementById('filter-sort-btn')?.addEventListener('click', () => {
    const cur = state.hospitalsFilter.sort;
    const next = cur === 'name' ? 'urgency' : cur === 'urgency' ? 'distance' : 'name';
    state.hospitalsFilter.sort = next;
    const sortBtn = document.getElementById('filter-sort-btn');
    if (sortBtn) sortBtn.textContent = `Sort: ${next.toUpperCase()} →`;
    renderHospitals();
  });

  document.getElementById('hospitals-search-input')?.addEventListener('input', (e) => {
    state.hospitalsFilter.search = e.target.value;
    renderHospitals();
  });

  // Grid / Map View switch
  const gridBtn = document.getElementById('view-grid-btn');
  const mapBtn = document.getElementById('view-map-btn');

  gridBtn?.addEventListener('click', () => {
    state.hospitalsFilter.view = 'grid';
    gridBtn.classList.add('bg-[#52090E]', 'text-white', 'shadow-sm');
    gridBtn.classList.remove('text-stone-600', 'dark:text-stone-400');
    mapBtn.classList.remove('bg-[#52090E]', 'text-white', 'shadow-sm');
    mapBtn.classList.add('text-stone-600', 'dark:text-stone-400');
    renderHospitals();
  });

  mapBtn?.addEventListener('click', () => {
    state.hospitalsFilter.view = 'map';
    mapBtn.classList.add('bg-[#52090E]', 'text-white', 'shadow-sm');
    mapBtn.classList.remove('text-stone-600', 'dark:text-stone-400');
    gridBtn.classList.remove('bg-[#52090E]', 'text-white', 'shadow-sm');
    gridBtn.classList.add('text-stone-600', 'dark:text-stone-400');
    renderHospitals();
  });

  // Requests Controls
  document.getElementById('filter-patient-blood-type')?.addEventListener('change', (e) => {
    state.requestsFilter.bloodType = e.target.value;
    renderRequests();
  });

  document.getElementById('requests-search-input')?.addEventListener('input', (e) => {
    state.requestsFilter.search = e.target.value;
    renderRequests();
  });

  document.getElementById('create-patient-request-btn')?.addEventListener('click', openNewRequestModal);

  document.querySelectorAll('[data-urgency-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lvl = btn.getAttribute('data-urgency-filter');
      state.requestsFilter.urgency = lvl;
      document.querySelectorAll('[data-urgency-filter]').forEach((b) => {
        if (b === btn) {
          b.classList.add('bg-rose-900', 'text-white', 'dark:bg-rose-700');
          b.classList.remove('bg-stone-100', 'dark:bg-stone-800', 'text-stone-700', 'dark:text-stone-300');
        } else {
          b.classList.remove('bg-rose-900', 'text-white', 'dark:bg-rose-700');
          b.classList.add('bg-stone-100', 'dark:bg-stone-800', 'text-stone-700', 'dark:text-stone-300');
        }
      });
      renderRequests();
    });
  });

  document.getElementById('clear-requests-filters-btn')?.addEventListener('click', () => {
    state.requestsFilter = { bloodType: 'All', urgency: 'All', search: '' };
    const bloodSelect = document.getElementById('filter-patient-blood-type');
    const searchInput = document.getElementById('requests-search-input');
    if (bloodSelect) bloodSelect.value = 'All';
    if (searchInput) searchInput.value = '';
    renderRequests();
  });

  // Modal Closers
  document.getElementById('auth-modal-backdrop')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-close-btn')?.addEventListener('click', closeAuthModal);
  document.getElementById('contact-modal-backdrop')?.addEventListener('click', closeContactModal);
  document.getElementById('screening-modal-backdrop')?.addEventListener('click', closeScreeningModal);
  document.getElementById('screening-close-btn')?.addEventListener('click', closeScreeningModal);
  document.getElementById('new-request-modal-backdrop')?.addEventListener('click', closeNewRequestModal);
  document.getElementById('new-request-close-btn')?.addEventListener('click', closeNewRequestModal);
  document.getElementById('event-booking-modal-backdrop')?.addEventListener('click', closeEventBookingModal);
  document.getElementById('add-event-modal-backdrop')?.addEventListener('click', closeAddEventModal);
  document.getElementById('certificate-modal-backdrop')?.addEventListener('click', closeCertificateModal);

  // Add Event Drive CTAs - only allow healthcare workers
  document.getElementById('events-add-drive-cta-btn')?.addEventListener('click', () => {
    const isHealthcare = state.user.role === 'Healthcare Worker' || state.user.role === 'Hospital Admin';
    if (!isHealthcare) {
      showToast('Only accredited Healthcare Workers can post donation drives.', 'info');
      return;
    }
    openAddEventModal();
  });

  // New Request Form Submission with Requestee Certificate Upload
  let uploadedSlipDataUrl = null;
  const slipInput = document.getElementById('new-req-slip-file');
  const slipStatus = document.getElementById('new-req-slip-status');

  slipInput?.addEventListener('change', () => {
    if (slipInput.files && slipInput.files[0]) {
      const file = slipInput.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        uploadedSlipDataUrl = ev.target.result;
        if (slipStatus) {
          slipStatus.innerHTML = `
            <div class="flex flex-col items-center gap-2">
              <div class="relative w-36 h-28 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md bg-stone-900">
                <img src="${uploadedSlipDataUrl}" alt="Certificate Preview" class="w-full h-full object-cover" />
                <div class="absolute bottom-0 inset-x-0 bg-emerald-800/90 text-white text-[10px] font-bold py-0.5 text-center">
                  Certificate Attached
                </div>
              </div>
              <p class="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                ✓ ${file.name}
              </p>
              <span class="text-[10px] text-stone-500">Image will be audited during verification</span>
            </div>
          `;
        }
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('new-request-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-req-name').value.trim();
    const age = Number(document.getElementById('new-req-age').value);
    const bloodType = document.getElementById('new-req-blood-type').value;
    const units = Number(document.getElementById('new-req-units').value);
    const urgency = document.getElementById('new-req-urgency').value;
    const hospitalId = document.getElementById('new-req-hospital').value;
    const condition = document.getElementById('new-req-condition').value.trim();
    const phone = document.getElementById('new-req-phone').value.trim();
    const emergency = document.getElementById('new-req-emergency').value.trim();

    if (!isValidContactNumber(phone)) {
      showToast('Contact number must be exactly 11 digits (e.g. 09123456789).', 'error');
      document.getElementById('new-req-phone')?.focus();
      return;
    }

    setupAdminProvisionListeners(renderProfileView);

    const expireDate = document.getElementById('new-req-expire-date')?.value;
    const expireTime = document.getElementById('new-req-expire-time')?.value || '17:00';

    if (!expireDate || !expireTime) {
      showToast('Please select an expiration date and time for this appeal.', 'error');
      return;
    }

    const expireTimestamp = new Date(`${expireDate}T${expireTime}`);
    if (isNaN(expireTimestamp.getTime()) || expireTimestamp.getTime() <= Date.now()) {
      showToast('Appeal expiration date and time must be set in the future.', 'error');
      document.getElementById('new-req-expire-date')?.focus();
      return;
    }

    const matchedHosp = state.hospitals.find((h) => h.id === hospitalId) || state.hospitals[0];
    const initials = name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const userContact = state.user?.isLoggedIn && state.user.contactNumber ? state.user.contactNumber : phone;
    const userEmail = state.user?.isLoggedIn && state.user.email ? state.user.email : 'emergency.contact@gmail.com';
    const userId = state.user?.isLoggedIn ? (state.user.id || `usr-${userEmail}`) : null;

    const receiptNo = `OR-${matchedHosp.id.slice(0, 3).toUpperCase()}-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const newReq = {
      id: `req-${Date.now()}`,
      userId,
      initials: initials || 'PT',
      patientName: name,
      age,
      bloodType,
      unitsNeeded: units,
      urgency,
      condition: condition || 'Emergency surgical requirement',
      hospitalId,
      hospitalName: matchedHosp.name,
      postedTime: 'Just now',
      contactNumber: phone || userContact,
      email: userEmail,
      emergencyContact: emergency || 'Family Representative',
      doctorSlipUrl: uploadedSlipDataUrl,
      medicalReceiptNo: receiptNo,
      receiptAmount: 1700 + units * 1800,
      receiptDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      receiptPayor: emergency || name,
      receiptServices: `Blood Compatibility Test + ${units} unit(s) Transfusion Preparation`,
      receiptStatus: 'Paid (Cashier Terminal 01)',
      expiresAt: expireTimestamp.toISOString(),
      isArchived: false,
      archivedReason: null,
      archivedAt: null,
    };

    state.requests.unshift(newReq);
    createBloodRequestInDB(newReq).catch((err) => console.warn('[Supabase]', err));
    uploadedSlipDataUrl = null;
    closeNewRequestModal();
    navigateTo('requests');
    showToast(`Urgent request posted for ${name} (${bloodType})! Valid until ${expireTimestamp.toLocaleDateString()}.`);
  });

  // Wire admin provision modal listeners
  setupAdminProvisionListeners(renderProfileView);

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
      closeContactModal();
      closeScreeningModal();
      closeNewRequestModal();
      closeEventBookingModal();
      closeAddEventModal();
      closeCertificateModal();
      closeAdminProvisionModal();
    }
  });

  // Handle URL hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('hospital-')) {
      const hid = hash.replace('hospital-', '');
      const h = state.hospitals.find((item) => item.id === hid);
      if (h) navigateTo('hospitals', h);
    } else if (['home', 'hospitals', 'requests', 'events', 'profile'].includes(hash)) {
      navigateTo(hash);
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const profileMenu = document.getElementById('profile-dropdown-menu');
    const profileBtn = document.getElementById('user-profile-btn');
    if (profileMenu && !profileMenu.classList.contains('hidden')) {
      if (!profileMenu.contains(e.target) && !profileBtn?.contains(e.target)) {
        profileMenu.classList.add('hidden');
      }
    }
  });
}
