import { state, elements, normalizeRoleName, recalculateHospitalBloodNeeded } from './state.js';
import { toggleTheme } from './theme.js';
import { navigateTo } from './navigation-tabs.js';
import { renderHospitals } from './View.js';
import { renderRequests } from './requests.js';
import { renderHomeUrgentRequests } from './HUrgntReq.js';
import { openAuthModal, closeAuthModal } from './authModal.js';
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
import { isValidContactNumber, attachPhoneInputFormatter, normalizePhoneNumber } from './contact-utils.js';

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
    if (!state.user?.isLoggedIn) {
      openAuthModal('register', 'Please register or sign in to join the verified blood donor network.', () => {
        openScreeningModal();
      });
      return;
    }
    openScreeningModal();
  });

  document.getElementById('hero-request-blood-btn')?.addEventListener('click', () => {
    if (!state.user?.isLoggedIn) {
      openAuthModal('login', 'Please sign in or register before submitting an urgent blood request.', () => {
        openNewRequestModal();
      });
      return;
    }
    openNewRequestModal();
  });

  document.getElementById('view-all-requests-btn')?.addEventListener('click', () => {
    navigateTo('requests');
  });

  document.getElementById('find-nearest-hospital-hero-btn')?.addEventListener('click', () => {
    navigateTo('hospitals');
  });

  // Feature cards CTAs in Home
  document.getElementById('feat-action-screening')?.addEventListener('click', () => {
    if (!state.user?.isLoggedIn) {
      openAuthModal('login', 'Please sign in or register to complete the donor screening eligibility check.', () => {
        openScreeningModal();
      });
      return;
    }
    openScreeningModal();
  });
  document.getElementById('feat-action-hospitals')?.addEventListener('click', () => navigateTo('hospitals'));
  document.getElementById('feat-action-new-request')?.addEventListener('click', () => {
    if (!state.user?.isLoggedIn) {
      openAuthModal('login', 'Please sign in or register before submitting an urgent blood appeal.', () => {
        openNewRequestModal();
      });
      return;
    }
    openNewRequestModal();
  });
  document.getElementById('feat-action-events')?.addEventListener('click', () => navigateTo('events'));

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

  // Grid / Map quick scroll buttons (both Map and List stay visible on the same page)
  const gridBtn = document.getElementById('view-grid-btn');
  const mapBtn = document.getElementById('view-map-btn');

  gridBtn?.addEventListener('click', () => {
    state.hospitalsFilter.view = 'grid';
    gridBtn.classList.add('bg-[#52090E]', 'text-white', 'shadow-sm');
    gridBtn.classList.remove('text-stone-600', 'dark:text-stone-400');
    mapBtn?.classList.remove('bg-[#52090E]', 'text-white', 'shadow-sm');
    mapBtn?.classList.add('text-stone-600', 'dark:text-stone-400');
    renderHospitals();
    document.getElementById('hospitals-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  mapBtn?.addEventListener('click', () => {
    state.hospitalsFilter.view = 'map';
    mapBtn.classList.add('bg-[#52090E]', 'text-white', 'shadow-sm');
    mapBtn.classList.remove('text-stone-600', 'dark:text-stone-400');
    gridBtn?.classList.remove('bg-[#52090E]', 'text-white', 'shadow-sm');
    gridBtn?.classList.add('text-stone-600', 'dark:text-stone-400');
    renderHospitals();
    document.getElementById('hospitals-map-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  document.getElementById('create-patient-request-btn')?.addEventListener('click', () => {
    if (!state.user?.isLoggedIn) {
      openAuthModal('login', 'Please sign in or register before submitting an urgent blood request.', () => {
        openNewRequestModal();
      });
      return;
    }
    openNewRequestModal();
  });

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

  // Add Event Drive CTAs - only allow authenticated Healthcare Workers or Webpage Admins
  document.getElementById('events-add-drive-cta-btn')?.addEventListener('click', () => {
    const role = normalizeRoleName(state.user?.role);
    const isHealthcare =
      Boolean(state.user?.isLoggedIn) &&
      (role === 'Healthcare Worker' || role === 'Webpage Admin');
    if (!isHealthcare) {
      showToast('Only accredited Healthcare Workers and Webpage Admins can post donation drives.', 'error');
      return;
    }
    openAddEventModal();
  });

  // Requirement 13: Relationship to Patient dropdown ("Other" custom input toggle)
  const relSelect = document.getElementById('new-req-relationship');
  const relOtherWrapper = document.getElementById('new-req-relationship-other-wrapper');
  const relOtherInput = document.getElementById('new-req-relationship-other');

  relSelect?.addEventListener('change', () => {
    if (relSelect.value === 'Other') {
      relOtherWrapper?.classList.remove('hidden');
      if (relOtherInput) {
        relOtherInput.required = true;
        relOtherInput.focus();
      }
    } else {
      relOtherWrapper?.classList.add('hidden');
      if (relOtherInput) {
        relOtherInput.required = false;
        relOtherInput.value = '';
      }
    }
  });

  // Emergency contact phone real-time formatting
  const reqPhoneInput = document.getElementById('new-req-phone');
  if (reqPhoneInput) {
    attachPhoneInputFormatter(reqPhoneInput);
  }

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
    if (!state.user?.isLoggedIn || !state.user?.email) {
      closeNewRequestModal();
      openAuthModal('login', 'Please sign in with your email before submitting a blood request.');
      return;
    }

    const name = document.getElementById('new-req-name').value.trim();
    const age = Number(document.getElementById('new-req-age').value);
    const bloodType = document.getElementById('new-req-blood-type').value;
    const units = Number(document.getElementById('new-req-units').value);
    const urgency = document.getElementById('new-req-urgency').value;
    const hospitalId = document.getElementById('new-req-hospital').value;
    const rawCondition = document.getElementById('new-req-condition')?.value || '';
    const condition = rawCondition.trim() || null;

    // Relationship to Patient validation
    const selectedRel = document.getElementById('new-req-relationship')?.value || '';
    const customRel = document.getElementById('new-req-relationship-other')?.value.trim() || '';
    const relationshipToPatient = selectedRel === 'Other' ? customRel : selectedRel;

    if (!relationshipToPatient) {
      showToast('Please select or specify your relationship to the patient.', 'error');
      document.getElementById('new-req-relationship')?.focus();
      return;
    }

    const rawPhone = document.getElementById('new-req-phone').value.trim();
    const phone = normalizePhoneNumber(rawPhone);
    const emergency = document.getElementById('new-req-emergency').value.trim();

    if (!isValidContactNumber(rawPhone)) {
      showToast('Contact number must be an 11-digit mobile number in XXXX-XXX-XXXX format (e.g. 0912-345-6789).', 'error');
      document.getElementById('new-req-phone')?.focus();
      return;
    }

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

    const userContact = state.user.contactNumber || phone;
    const userEmail = state.user.email;
    const userId = state.user.id || null;

    const isAnonymous = document.getElementById('new-req-anonymous')?.checked || false;

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
      condition,
      hospitalId,
      hospitalName: matchedHosp.name,
      postedTime: 'Just now',
      contactNumber: phone || normalizePhoneNumber(userContact),
      email: userEmail,
      emergencyContact: emergency || 'Family Representative',
      relationshipToPatient,
      doctorSlipUrl: uploadedSlipDataUrl || null,
      medicalReceiptNo: receiptNo,
      receiptDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      receiptPayor: emergency || name,
      receiptServices: `Blood Compatibility Test + ${units} unit(s) Transfusion Preparation`,
      isAnonymous,
      status: 'Pending',
      expiresAt: expireTimestamp.toISOString(),
      isArchived: false,
      archivedReason: null,
      archivedAt: null,
    };

    state.requests.unshift(newReq);
    // Requirement 11: Recalculate hospital bloodNeeded from active blood requests
    recalculateHospitalBloodNeeded();
    renderHospitals();
    renderHomeUrgentRequests();

    createBloodRequestInDB(newReq).catch((err) => console.warn('[Supabase]', err));
    uploadedSlipDataUrl = null;
    e.target.reset();
    relOtherWrapper?.classList.add('hidden');
    if (relOtherInput) relOtherInput.required = false;

    if (slipStatus) {
      slipStatus.innerHTML = `
        <svg class="w-6 h-6 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
        <p class="font-semibold text-xs">Drag &amp; drop doctor's slip or click to browse</p>
        <span class="text-[11px] text-stone-500">Supports JPG, PNG, PDF up to 10MB</span>
      `;
    }
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
