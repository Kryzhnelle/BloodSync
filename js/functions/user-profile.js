import { state, elements, normalizeRoleName, recalculateHospitalBloodNeeded } from './state.js';
import { openAuthModal } from './authModal.js';
import { openAddEventModal } from './add-event-modal.js';
import { openCertificateModal } from './check-certificate-modal.js';
import { openNewRequestModal } from './new-patient-req-modal.js';
import { openAdminProvisionModal } from './admin-provision-modal.js';
import { navigateTo } from './navigation-tabs.js';
import { showToast } from './ToastNotif.js';
import {
  signOutUser,
  archiveRequestInDB,
  updateUserProfileInDB,
  removeEventInDB,
  fetchUserRequestsFromDB,
  isSupabaseConfigured,
} from '../supabase.js';
import { formatContactDisplay, isValidContactNumber } from './contact-utils.js';
import { renderEvents } from './events.js';
import { renderRequests } from './requests.js';
import { renderHospitals } from './View.js';
import { renderHomeUrgentRequests } from './HUrgntReq.js';

// Profile view subtab state: 'active' | 'pending' | 'archived' | 'staff' | 'events'
if (!state.profileSubTab) {
  state.profileSubTab = 'active';
}

/**
 * Helper to determine if a blood request belongs to the currently authenticated user.
 * Uses the authenticated user's email as the primary lookup criterion (alongside userId).
 */
export function isRequestOwnedByUser(req, user = state.user) {
  if (!req || !user || !user.isLoggedIn) return false;
  const userEmail = (user.email || '').trim().toLowerCase();
  const reqEmail = (req.email || '').trim().toLowerCase();
  if (userEmail && reqEmail && userEmail === reqEmail) {
    return true;
  }
  if (user.id && req.userId && user.id === req.userId && (!reqEmail || reqEmail === userEmail)) {
    return true;
  }
  return false;
}

/**
 * Helper to determine if a donation event drive can be managed/removed by the current user.
 * Only the authorized creator (matching email/id) or a Webpage Admin is permitted.
 */
export function canUserManageEvent(evt, user = state.user) {
  if (!evt || !user || !user.isLoggedIn) return false;
  const role = normalizeRoleName(user.role);
  if (role === 'Webpage Admin') return true;
  if (role !== 'Healthcare Worker') return false;
  const userEmail = (user.email || '').trim().toLowerCase();
  const evtEmail = (evt.creatorEmail || evt.created_by_email || '').trim().toLowerCase();
  if (userEmail && evtEmail && userEmail === evtEmail) return true;
  if (user.id && evt.createdBy && user.id === evt.createdBy) return true;
  return false;
}

export function updateUserProfileUI() {
  if (!elements.userProfileContainer) return;

  const mobileAuthContainer = document.getElementById('mobile-auth-container');

  if (state.user?.isLoggedIn) {
    state.user.role = normalizeRoleName(state.user.role);
    if (state.user.role === 'Webpage Admin') {
      state.user.hospital = '';
      state.user.hospitalId = '';
    }

    const initials =
      (state.user.username || state.user.email || 'U')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'US';

    const isHealthcare =
      state.user.role === 'Healthcare Worker' || state.user.role === 'Webpage Admin';
    const isAdmin = state.user.role === 'Webpage Admin';

    elements.userProfileContainer.innerHTML = `
      <div class="relative flex items-center">
        <button
          id="user-profile-btn"
          type="button"
          class="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-400 cursor-pointer shadow-sm group"
          title="Profile (${state.user.username})"
          aria-label="Open profile menu"
        >
          <div class="w-8 h-8 rounded-full ${
            isAdmin
              ? 'bg-amber-300 text-stone-950 font-black'
              : isHealthcare
              ? 'bg-white text-[#52090E]'
              : 'bg-rose-200 text-rose-950'
          } flex items-center justify-center font-black text-xs border border-white shadow">
            ${initials}
          </div>
          <span class="font-bold text-sm text-white group-hover:text-rose-200 transition-colors">Profile</span>
          <svg id="profile-chevron-icon" class="w-3.5 h-3.5 text-stone-300 ml-0.5 group-hover:text-white transition-colors" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>

        <div
          id="profile-dropdown-menu"
          class="hidden absolute right-0 top-full mt-2 w-72 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-3 z-50 text-stone-900 dark:text-stone-100 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div class="px-3 py-2.5 border-b border-stone-100 dark:border-stone-800">
            <p class="text-sm font-extrabold truncate text-stone-900 dark:text-white">${state.user.username}</p>
            <p class="text-xs text-stone-500 dark:text-stone-400 truncate">${state.user.email}</p>
            <div class="mt-1.5 flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400 font-bold">
              <span class="w-2 h-2 rounded-full ${isAdmin ? 'bg-amber-500' : 'bg-rose-600'} animate-pulse"></span>
              <span>${state.user.role}</span>
              ${
                !isAdmin && state.user.hospital
                  ? `<span class="text-stone-400 font-normal truncate">(${state.user.hospital})</span>`
                  : ''
              }
            </div>
          </div>

          <div class="py-2 space-y-1.5">
            <button
              id="see-profile-btn"
              type="button"
              class="w-full text-center px-4 py-2.5 text-xs font-bold text-white bg-[#52090E] hover:bg-[#3B070B] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow hover:shadow-md"
            >
              <svg class="w-4 h-4 text-rose-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>See Profile</span>
            </button>
          </div>

          <div class="border-t border-stone-100 dark:border-stone-800 pt-1">
            <button
              id="profile-logout-btn"
              type="button"
              class="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    `;

    if (mobileAuthContainer) {
      mobileAuthContainer.innerHTML = '';
    }

    const userProfileBtn = document.getElementById('user-profile-btn');
    const dropdownMenu = document.getElementById('profile-dropdown-menu');
    const seeProfileBtn = document.getElementById('see-profile-btn');
    const logoutBtn = document.getElementById('profile-logout-btn');

    if (userProfileBtn && dropdownMenu) {
      userProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!elements.userProfileContainer?.contains(e.target)) {
          dropdownMenu.classList.add('hidden');
        }
      });
    }

    if (seeProfileBtn) {
      seeProfileBtn.addEventListener('click', () => {
        dropdownMenu?.classList.add('hidden');
        document.getElementById('mobile-drawer')?.classList.add('hidden');
        navigateTo('profile');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await signOutUser();
        } catch (e) {
          console.warn('[Supabase SignOut]', e);
        }
        try {
          localStorage.removeItem('bloodsync_active_session_user');
        } catch {}
        state.user = { id: null, username: '', email: '', contactNumber: '', isLoggedIn: false, role: 'Donor' };
        state.userRequests = [];
        updateUserProfileUI();
        renderEvents();
        renderRequests();
        navigateTo('home');
      });
    }
  } else {
    // Logged Out UI in top header
    elements.userProfileContainer.innerHTML = `
      <button
        id="login-btn"
        class="px-4 sm:px-5 py-2 rounded-full bg-white hover:bg-stone-100 text-[#52090E] font-bold text-xs sm:text-sm shadow-sm transition-all hover:shadow-md cursor-pointer"
      >
        Sign In / Register
      </button>
    `;

    document.getElementById('login-btn')?.addEventListener('click', () => {
      document.getElementById('mobile-drawer')?.classList.add('hidden');
      openAuthModal('login');
    });

    // Requirement 7: Mobile hamburger menu Login & Register actions that automatically close the drawer
    if (mobileAuthContainer) {
      mobileAuthContainer.innerHTML = `
        <div class="pt-2 mt-1 border-t border-rose-900/50 grid grid-cols-2 gap-2">
          <button
            type="button"
            id="mobile-menu-login-btn"
            class="w-full py-2.5 px-3 rounded-xl bg-white text-[#52090E] font-extrabold text-xs uppercase tracking-wider shadow cursor-pointer"
          >
            Login
          </button>
          <button
            type="button"
            id="mobile-menu-register-btn"
            class="w-full py-2.5 px-3 rounded-xl bg-[#40070B] text-white border border-rose-700 font-extrabold text-xs uppercase tracking-wider shadow cursor-pointer"
          >
            Register
          </button>
        </div>
      `;

      document.getElementById('mobile-menu-login-btn')?.addEventListener('click', () => {
        document.getElementById('mobile-drawer')?.classList.add('hidden');
        openAuthModal('login');
      });

      document.getElementById('mobile-menu-register-btn')?.addEventListener('click', () => {
        document.getElementById('mobile-drawer')?.classList.add('hidden');
        openAuthModal('register');
      });
    }
  }
}

/**
 * Synchronize the authenticated user's own blood requests from Supabase by email.
 */
async function syncAuthenticatedUserRequests() {
  if (!state.user?.isLoggedIn || !state.user?.email || !isSupabaseConfigured()) return;
  const rows = await fetchUserRequestsFromDB(state.user.email, state.user.id);
  if (Array.isArray(rows)) {
    const mappedOwn = rows.map((d) => ({
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
      age: d.age,
      bloodType: d.blood_type,
      unitsNeeded: d.units_needed,
      urgency: d.urgency,
      condition: d.condition || null,
      hospitalId: d.hospital_id,
      hospitalName: d.hospital_name,
      postedTime: d.posted_time ? new Date(d.posted_time).toLocaleDateString() : 'Recently',
      contactNumber: d.contact_number,
      email: d.email,
      emergencyContact: d.emergency_contact,
      relationshipToPatient: d.relationship_to_patient || null,
      doctorSlipUrl: d.doctor_slip_url || null,
      medicalReceiptNo: d.medical_receipt_no || null,
      receiptDate: d.medical_receipt_date || null,
      receiptPayor: d.medical_receipt_payor || null,
      receiptServices: d.medical_receipt_services || null,
      isAnonymous: Boolean(d.is_anonymous),
      status: d.status || 'Pending',
      expiresAt: d.expires_at || null,
      isArchived: Boolean(d.is_archived),
      archivedReason: d.archived_reason || null,
      archivedAt: d.archived_at || null,
      verifiedByName: d.verified_by_name || null,
    }));

    // Merge user's isolated requests into state.requests without duplicating
    const otherRequests = state.requests.filter((r) => !isRequestOwnedByUser(r, state.user));
    state.requests = [...mappedOwn, ...otherRequests];
    recalculateHospitalBloodNeeded();
  }
}

/**
 * Main Profile View Renderer
 */
export function renderProfileView() {
  const container = document.getElementById('profile-view-content');
  if (!container) return;

  if (!state.user?.isLoggedIn) {
    container.innerHTML = `
      <div class="p-8 sm:p-12 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-sm max-w-xl mx-auto my-8">
        <h3 class="text-xl font-extrabold text-stone-900 dark:text-white">Sign In Required</h3>
        <p class="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
          Please sign in with your registered email and password to view your personal profile and blood request history.
        </p>
        <button
          id="profile-guest-login-btn"
          class="px-6 py-2.5 rounded-full bg-[#52090E] hover:bg-[#3B070B] text-white font-bold text-xs sm:text-sm cursor-pointer shadow"
        >
          Sign In
        </button>
      </div>
    `;
    document.getElementById('profile-guest-login-btn')?.addEventListener('click', () => {
      openAuthModal('login');
    });
    return;
  }

  // Trigger background sync of the user's isolated requests from Supabase if not yet synced in this view cycle
  if (!state._syncingUserProfileRequests && isSupabaseConfigured()) {
    state._syncingUserProfileRequests = true;
    syncAuthenticatedUserRequests()
      .then(() => {
        if (state.activeTab === 'profile') {
          renderProfileViewInternal(container);
        }
      })
      .finally(() => {
        setTimeout(() => {
          state._syncingUserProfileRequests = false;
        }, 1500);
      });
  }

  renderProfileViewInternal(container);
}

function renderProfileViewInternal(container) {
  const now = new Date();
  let anyAutoArchived = false;
  // Auto-archive any expired requests
  state.requests.forEach((r) => {
    if (!r.isArchived && r.expiresAt && new Date(r.expiresAt) <= now) {
      r.isArchived = true;
      r.status = 'Archived';
      r.archivedReason = 'automatically_expired';
      r.archivedAt = r.expiresAt;
      anyAutoArchived = true;
      archiveRequestInDB(r.id, 'automatically_expired').catch(() => {});
    }
  });
  if (anyAutoArchived) {
    recalculateHospitalBloodNeeded();
  }

  state.user.role = normalizeRoleName(state.user.role);
  const isHealthcare =
    state.user.role === 'Healthcare Worker' || state.user.role === 'Webpage Admin';
  const isAdmin = state.user.role === 'Webpage Admin';

  // Isolate personal blood requests strictly by the authenticated user's email (and userId)
  const myOwnActiveRequests = state.requests.filter(
    (r) => !r.isArchived && r.status !== 'Archived' && isRequestOwnedByUser(r, state.user)
  );
  const myOwnArchivedRequests = state.requests.filter(
    (r) => (r.isArchived || r.status === 'Archived') && isRequestOwnedByUser(r, state.user)
  );
  const pendingAuditRequests = state.requests.filter(
    (r) => !r.isArchived && r.status === 'Pending'
  );
  const staffCount = state.staffAccounts?.length || 0;

  const initials =
    (state.user.username || state.user.email || 'U')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || (isHealthcare ? 'DR' : 'US');

  if (isHealthcare) {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Top Profile Banner Card -->
        <div class="relative bg-[#52090E] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-rose-950/40 space-y-6">
          <div class="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
            <button
              id="staff-edit-profile-btn"
              type="button"
              class="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Edit profile information"
            >
              <svg class="w-3.5 h-3.5 text-rose-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span>Edit Profile</span>
            </button>
          </div>

          <!-- Avatar & Doctor/Admin Details Row -->
          <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 pt-1">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full ${
              isAdmin ? 'bg-amber-300 text-stone-950 font-black' : 'bg-white text-[#52090E]'
            } flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg border-2 border-rose-200 shrink-0">
              ${initials}
            </div>

            <div class="space-y-3 flex-1 text-center sm:text-left">
              <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight font-sans">
                  ${state.user.username}
                </h1>
                ${
                  isAdmin
                    ? `<span class="px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-xs font-black tracking-wide uppercase">Webpage Admin</span>`
                    : `<span class="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wide">Accredited Doctor</span>`
                }
              </div>

              <!-- Metadata Grid: Webpage Admin has NO hospital association -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 text-xs sm:text-sm text-stone-200">
                <div class="flex items-center justify-center sm:justify-start gap-2">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">ROLE:</span>
                  <span class="font-semibold text-white">${state.user.role}</span>
                </div>
                <div class="flex items-center justify-center sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-rose-800/80 sm:pl-8">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">CONTACT NUMBER:</span>
                  <span class="font-semibold font-mono text-white">${formatContactDisplay(state.user.contactNumber || 'N/A')}</span>
                </div>
                ${
                  !isAdmin
                    ? `
                  <div class="flex items-center justify-center sm:justify-start gap-2">
                    <span class="font-bold text-rose-200 uppercase tracking-wide">HOSPITAL:</span>
                    <span class="font-semibold text-white">${state.user.hospital || 'N/A'}</span>
                  </div>
                `
                    : `
                  <div class="flex items-center justify-center sm:justify-start gap-2">
                    <span class="font-bold text-rose-200 uppercase tracking-wide">BLOOD TYPE:</span>
                    <span class="font-semibold text-white">${state.user.bloodType || 'O+'}</span>
                  </div>
                `
                }
                <div class="flex items-center justify-center sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-rose-800/80 sm:pl-8">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">EMAIL:</span>
                  <span class="font-semibold text-white truncate">${state.user.email}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Divider line & Navigation Subtabs (2-column grid on mobile, flex wrap on larger screens) -->
          <div class="border-t border-rose-900/60 pt-4">
            <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
              <!-- My Active Appeals Tab (Isolated to logged-in user) -->
              <button
                id="tab-active-appeals-btn"
                class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-2 rounded-2xl sm:rounded-full ${
                  state.profileSubTab === 'active'
                    ? 'bg-white text-[#52090E] ring-2 ring-rose-300 font-extrabold'
                    : 'bg-black/30 hover:bg-black/50 text-rose-100 font-bold'
                } text-[11px] sm:text-sm text-center leading-tight shadow-md transition-all cursor-pointer"
              >
                <span>My Active Appeals (${myOwnActiveRequests.length})</span>
              </button>

              <!-- Request Approval Tab (Clinical verification queue for Healthcare Worker / Webpage Admin) -->
              <button
                id="tab-pending-approval-btn"
                class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-2 rounded-2xl sm:rounded-full ${
                  state.profileSubTab === 'pending'
                    ? 'bg-amber-300 text-stone-950 ring-2 ring-white font-extrabold'
                    : 'bg-black/30 hover:bg-black/50 text-rose-100 font-bold'
                } text-[11px] sm:text-sm text-center leading-tight shadow-md transition-all cursor-pointer"
              >
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                <span>Pending Audit (${pendingAuditRequests.length})</span>
              </button>

              <!-- Archived Appeals & Expiration History Tab (Isolated to logged-in user) -->
              <button
                id="tab-archived-appeals-btn"
                class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-2 rounded-2xl sm:rounded-full ${
                  state.profileSubTab === 'archived'
                    ? 'bg-rose-200 text-[#52090E] ring-2 ring-white font-extrabold'
                    : 'bg-black/30 hover:bg-black/50 text-rose-100 font-bold'
                } text-[11px] sm:text-sm text-center leading-tight shadow-md transition-all cursor-pointer"
              >
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                <span>My Archived (${myOwnArchivedRequests.length})</span>
              </button>

              <!-- Managed Event Drives Tab -->
              <button
                id="tab-my-events-btn"
                class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-2 rounded-2xl sm:rounded-full ${
                  state.profileSubTab === 'events'
                    ? 'bg-white text-[#52090E] ring-2 ring-rose-300 font-extrabold'
                    : 'bg-black/30 hover:bg-black/50 text-rose-100 font-bold'
                } text-[11px] sm:text-sm text-center leading-tight shadow-md transition-all cursor-pointer"
              >
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>My Event Drives</span>
              </button>

              <!-- If Webpage Admin: Staff Accounts Tab -->
              ${
                isAdmin
                  ? `
                <button
                  id="tab-staff-accounts-btn"
                  class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-2 rounded-2xl sm:rounded-full ${
                    state.profileSubTab === 'staff'
                      ? 'bg-amber-400 text-stone-950 ring-2 ring-white font-extrabold'
                      : 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 font-bold border border-amber-600/60'
                  } text-[11px] sm:text-sm text-center leading-tight shadow-md transition-all cursor-pointer"
                >
                  <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span>Staff Roster (${staffCount})</span>
                </button>
              `
                  : ''
              }

              <!-- Add Event Drive button (Authorized for Healthcare Worker & Webpage Admin) -->
              <button
                id="add-event-drive-pill-btn"
                class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-2 rounded-2xl sm:rounded-full bg-[#40070B] hover:bg-[#300508] text-white font-extrabold text-[11px] sm:text-sm text-center leading-tight border border-rose-800/80 shadow transition-all cursor-pointer sm:ml-auto"
              >
                <svg class="w-3.5 h-3.5 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>Add Event Drive</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Dynamic Body based on state.profileSubTab -->
        <div id="profile-subtab-container" class="space-y-5">
          <!-- Populated below -->
        </div>
      </div>
    `;

    renderSubTabContent();

    document.getElementById('staff-edit-profile-btn')?.addEventListener('click', () => {
      openEditProfileModal();
    });

    document.getElementById('tab-active-appeals-btn')?.addEventListener('click', () => {
      state.profileSubTab = 'active';
      renderProfileView();
    });

    document.getElementById('tab-pending-approval-btn')?.addEventListener('click', () => {
      state.profileSubTab = 'pending';
      renderProfileView();
    });

    document.getElementById('tab-archived-appeals-btn')?.addEventListener('click', () => {
      state.profileSubTab = 'archived';
      renderProfileView();
    });

    document.getElementById('tab-my-events-btn')?.addEventListener('click', () => {
      state.profileSubTab = 'events';
      renderProfileView();
    });

    document.getElementById('tab-staff-accounts-btn')?.addEventListener('click', () => {
      if (normalizeRoleName(state.user.role) !== 'Webpage Admin') return;
      state.profileSubTab = 'staff';
      renderProfileView();
    });

    document.getElementById('add-event-drive-pill-btn')?.addEventListener('click', () => {
      openAddEventModal();
    });
  } else {
    // Normal User Profile UI (Donor / Patient)
    const myAppeals = myOwnActiveRequests;

    container.innerHTML = `
      <div class="space-y-8">
        <!-- Normal User Profile Banner -->
        <div class="relative bg-[#52090E] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-rose-950/40 space-y-6">
          <div class="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
            <button
              id="donor-edit-profile-btn"
              type="button"
              class="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Edit profile information"
            >
              <svg class="w-3.5 h-3.5 text-rose-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span>Edit Profile</span>
            </button>
          </div>

          <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 pt-1">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-rose-200 text-[#52090E] flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg border-2 border-white shrink-0">
              ${initials}
            </div>

            <div class="space-y-3 flex-1 text-center sm:text-left">
              <h1 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight font-sans">
                ${state.user.username}
              </h1>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-xs sm:text-sm text-stone-200">
                <div class="flex items-center justify-center sm:justify-start gap-2">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">BLOOD TYPE:</span>
                  <span class="font-bold text-white px-2.5 py-0.5 rounded-md bg-rose-900 border border-rose-700/60 shadow-sm">${state.user.bloodType || 'O+'}</span>
                </div>
                <div class="flex items-center justify-center sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-rose-800/80 sm:pl-6">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">CONTACT:</span>
                  <span class="font-semibold font-mono text-white">${formatContactDisplay(state.user.contactNumber || 'N/A')}</span>
                </div>
                <div class="flex items-center justify-center sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-rose-800/80 sm:pl-6">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">EMAIL:</span>
                  <span class="font-semibold text-white truncate">${state.user.email}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="border-t border-rose-900/60 pt-4 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
            <button
              id="normal-book-drive-btn"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl sm:rounded-full bg-white text-[#52090E] font-extrabold text-xs sm:text-sm shadow hover:bg-stone-100 transition-all cursor-pointer"
            >
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Browse Mobile Drives</span>
            </button>
            <button
              id="normal-post-req-btn"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl sm:rounded-full bg-[#40070B] hover:bg-[#300508] text-white font-extrabold text-xs sm:text-sm border border-rose-800/80 shadow transition-all cursor-pointer"
            >
              <span>+ Post Blood Appeal</span>
            </button>
          </div>
        </div>

        <!-- Active Blood Appeals Created by Authenticated User -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                <span>Active Blood Appeals (${myAppeals.length})</span>
              </h3>
              <p class="text-xs text-stone-500 dark:text-stone-400">
                Displaying blood requests associated with your authenticated email (${state.user.email}).
              </p>
            </div>

            <button
              id="profile-create-appeal-top-btn"
              class="px-4 py-2 rounded-full bg-[#52090E] hover:bg-[#3B070B] text-white font-bold text-xs shadow transition-all cursor-pointer"
            >
              + Create Appeal
            </button>
          </div>

          ${
            myAppeals.length === 0
              ? `
            <div class="p-8 sm:p-12 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center space-y-3.5 shadow-sm">
              <div class="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center font-bold">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </div>
              <h4 class="font-extrabold text-stone-900 dark:text-white text-lg">No Active Blood Appeals</h4>
              <p class="text-stone-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                You do not have any active patient blood requests submitted under your account (${state.user.email}). Click below to submit an emergency appeal to accredited hospitals and donors.
              </p>
              <button
                id="donor-post-first-appeal-btn"
                class="px-6 py-2.5 rounded-full bg-[#52090E] hover:bg-[#3B070B] text-white font-bold text-xs sm:text-sm cursor-pointer shadow hover:shadow-md transition-all inline-flex items-center gap-2"
              >
                <span>+ Submit an Urgent Appeal</span>
              </button>
            </div>
          `
              : `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              ${myAppeals
                .map((req) => {
                  const expDate = req.expiresAt ? new Date(req.expiresAt) : null;
                  const expStr = expDate
                    ? expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : null;
                  const isVerified = req.status === 'Verified';
                  const isOwner = isRequestOwnedByUser(req, state.user);

                  return `
                <div class="bg-white dark:bg-stone-900 rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3.5 flex flex-col justify-between">
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="font-black text-rose-600 text-sm bg-rose-50 dark:bg-rose-950 px-3 py-1 rounded-full border border-rose-200/60">${req.bloodType}</span>
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-bold ${req.urgency === 'Critical' ? 'text-rose-600' : 'text-orange-600'}">${req.urgency}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }">${isVerified ? '✓ Verified' : '⏳ Pending'}</span>
                      </div>
                    </div>

                    <h4 class="font-bold text-base text-stone-900 dark:text-white">${req.patientName} (${req.age} y/o)</h4>
                    <p class="text-xs text-stone-500 line-clamp-1">${req.hospitalName}</p>
                    ${
                      req.condition
                        ? `<p class="text-xs text-stone-600 dark:text-stone-300 line-clamp-2">${req.condition}</p>`
                        : `<p class="text-xs text-stone-400 italic">Medical Reason: N/A</p>`
                    }

                    ${
                      expStr
                        ? `<p class="text-[11px] text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                            <span>Expires: ${expStr}</span>
                          </p>`
                        : ''
                    }
                  </div>

                  <div class="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                    <span class="text-xs font-bold text-stone-700 dark:text-stone-300">${req.unitsNeeded} unit/s</span>
                    <div class="flex items-center gap-2">
                      ${
                        isOwner
                          ? `
                        <button
                          data-remove-req-id="${req.id}"
                          class="px-2.5 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 text-[11px] font-bold transition-all cursor-pointer"
                          title="Archive this appeal"
                        >
                          Remove
                        </button>
                      `
                          : ''
                      }
                      <button
                        data-check-cert-id="${req.id}"
                        class="text-xs font-bold text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Doctor Slip
                      </button>
                    </div>
                  </div>
                </div>
              `;
                })
                .join('')}
            </div>
          `
          }
        </div>
      </div>
    `;

    document.getElementById('donor-edit-profile-btn')?.addEventListener('click', () => {
      openEditProfileModal();
    });

    document.getElementById('normal-book-drive-btn')?.addEventListener('click', () => {
      navigateTo('events');
    });

    document.getElementById('normal-post-req-btn')?.addEventListener('click', () => {
      openNewRequestModal();
    });

    document.getElementById('donor-post-first-appeal-btn')?.addEventListener('click', () => {
      openNewRequestModal();
    });

    document.getElementById('profile-create-appeal-top-btn')?.addEventListener('click', () => {
      openNewRequestModal();
    });

    container.querySelectorAll('[data-remove-req-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rid = btn.getAttribute('data-remove-req-id');
        const target = state.requests.find((r) => r.id === rid);
        if (!target || !isRequestOwnedByUser(target, state.user)) {
          showToast('Unauthorized: You can only remove blood requests belonging to your account.', 'error');
          return;
        }
        if (!confirm('Are you sure you want to remove and archive this blood appeal?')) return;
        target.isArchived = true;
        target.status = 'Archived';
        target.archivedReason = 'user_removed';
        target.archivedAt = new Date().toISOString();
        recalculateHospitalBloodNeeded();
        await archiveRequestInDB(rid, 'user_removed');
        showToast('Blood appeal removed and archived.');
        renderProfileView();
        renderRequests();
        renderHospitals();
        renderHomeUrgentRequests();
      });
    });

    container.querySelectorAll('[data-check-cert-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rid = btn.getAttribute('data-check-cert-id');
        const req = state.requests.find((r) => r.id === rid);
        if (req && isRequestOwnedByUser(req, state.user)) {
          openCertificateModal(req);
        }
      });
    });
  }
}

/**
 * Render content based on current profile subtab
 */
function renderSubTabContent() {
  const container = document.getElementById('profile-subtab-container');
  if (!container) return;

  const isAdmin = normalizeRoleName(state.user.role) === 'Webpage Admin';

  if (state.profileSubTab === 'staff' && isAdmin) {
    renderStaffManagementSection(container);
  } else if (state.profileSubTab === 'archived') {
    renderArchivedAppealsSection(container);
  } else if (state.profileSubTab === 'events') {
    renderMyEventsSection(container);
  } else {
    renderAppealsListSection(container);
  }
}

/**
 * Render Managed Donation Events for Healthcare Worker / Webpage Admin
 */
function renderMyEventsSection(container) {
  const isAdmin = normalizeRoleName(state.user.role) === 'Webpage Admin';
  const myEvents = state.events.filter((evt) => {
    if (evt.isArchived) return false;
    return canUserManageEvent(evt, state.user);
  });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
        <div>
          <h2 class="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Managed Donation Drive Events (${myEvents.length})</span>
          </h2>
          <p class="text-xs text-stone-500 mt-1">
            Donation drive campaigns scheduled by your account (${state.user.email}). Only the authorized creator or Webpage Admin may remove an event.
          </p>
        </div>

        <button
          id="profile-add-new-event-btn"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#52090E] hover:bg-[#3B070B] text-white font-bold text-xs sm:text-sm shadow transition-all cursor-pointer shrink-0"
        >
          <span>+ Register New Drive</span>
        </button>
      </div>

      ${
        myEvents.length === 0
          ? `
        <div class="text-center py-12 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-8 space-y-3">
          <div class="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 mx-auto flex items-center justify-center font-bold">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <p class="font-bold text-stone-700 dark:text-stone-300 text-sm">No scheduled donation drives found under your account.</p>
          <p class="text-xs text-stone-500 max-w-md mx-auto">Click "Register New Drive" to organize and broadcast a mobile blood donation drive.</p>
        </div>
      `
          : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${myEvents
            .map((evt) => {
              const canRemove = isAdmin || canUserManageEvent(evt, state.user);
              return `
            <div class="bg-white dark:bg-stone-900 rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 flex flex-col justify-between">
              <div class="space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <span class="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2.5 py-1 rounded-full border border-rose-200">
                    ${evt.slotsRemaining || 35} / ${evt.totalSlots || 50} Slots Open
                  </span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Active Drive
                  </span>
                </div>

                <h3 class="font-extrabold text-base text-stone-900 dark:text-white leading-tight">
                  ${evt.title}
                </h3>
                <p class="text-xs text-rose-700 dark:text-rose-400 font-semibold">${evt.organizer}</p>

                <div class="space-y-1.5 text-xs text-stone-600 dark:text-stone-300 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <p class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>${evt.date} • ${evt.time}</span>
                  </p>
                  <p class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    <span class="truncate">${evt.location}</span>
                  </p>
                </div>
              </div>

              <div class="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                <span class="text-[11px] text-stone-400 font-mono">${evt.contactDetails || ''}</span>
                ${
                  canRemove
                    ? `
                  <button
                    data-remove-event-id="${evt.id}"
                    class="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    title="Archive this donation event drive"
                  >
                    Remove Event Drive
                  </button>
                `
                    : ''
                }
              </div>
            </div>
          `;
            })
            .join('')}
        </div>
      `
      }
    </div>
  `;

  document.getElementById('profile-add-new-event-btn')?.addEventListener('click', () => {
    openAddEventModal();
  });

  container.querySelectorAll('[data-remove-event-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const eid = btn.getAttribute('data-remove-event-id');
      const target = state.events.find((e) => e.id === eid);
      if (!target) return;

      if (!canUserManageEvent(target, state.user)) {
        showToast('Unauthorized: Only the event creator or a Webpage Admin can remove this drive.', 'error');
        return;
      }

      if (
        !confirm(
          `Are you sure you want to remove and archive the donation drive "${target.title}"? This action preserves the record in the database while taking it offline.`
        )
      ) {
        return;
      }

      target.isArchived = true;
      target.status = 'Archived';
      state.events = state.events.filter((e) => e.id !== eid);

      await removeEventInDB(eid);
      showToast(`Donation drive "${target.title}" has been removed and archived.`);
      renderProfileView();
      renderEvents();
    });
  });
}

/**
 * Open Modal to Edit Profile Information (Persists to public.profiles in Supabase)
 */
export function openEditProfileModal() {
  let modal = document.getElementById('edit-profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-profile-modal';
    modal.className =
      'fixed inset-0 z-[1050] flex items-start justify-center pt-24 sm:pt-28 pb-6 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto';
    document.body.appendChild(modal);
  }

  const normalizedRole = normalizeRoleName(state.user.role);
  const isHealthcareWorker = normalizedRole === 'Healthcare Worker';
  const isStaff = isHealthcareWorker || normalizedRole === 'Webpage Admin';
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  modal.innerHTML = `
    <div class="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 max-h-[calc(100vh-7.5rem)] overflow-y-auto my-auto">
      <button
        type="button"
        id="close-edit-profile-btn"
        class="absolute top-5 right-5 p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
        aria-label="Close modal"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>

      <div class="flex items-center gap-3 mb-5">
        <div class="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center font-black">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <div>
          <h2 class="text-xl font-bold">Edit Profile Information</h2>
          <p class="text-xs text-stone-500">Update your details. Account role is strictly read-only.</p>
        </div>
      </div>

      <div id="edit-profile-error-box" class="hidden mb-4 p-3 rounded-xl bg-red-100 text-red-800 border border-red-300 text-xs font-semibold"></div>

      <form id="edit-profile-form" class="space-y-4 text-xs sm:text-sm">
        <div>
          <label class="block font-semibold mb-1">Full Name / Username*</label>
          <input
            type="text"
            id="edit-user-username"
            required
            value="${state.user.username || ''}"
            class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label class="block font-semibold mb-1">Contact Number (11 digits)*</label>
          <input
            type="tel"
            id="edit-user-contact"
            required
            maxlength="11"
            placeholder="09123456789"
            value="${state.user.contactNumber || ''}"
            class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 font-mono focus:outline-none focus:border-rose-500"
          />
          <p class="text-[11px] text-stone-400 mt-1">Philippine 11-digit mobile starting with 09</p>
        </div>

        <div>
          <label class="block font-semibold mb-1">Blood Type*</label>
          <select
            id="edit-user-bloodtype"
            required
            class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:border-rose-500 cursor-pointer"
          >
            ${bloodTypes
              .map(
                (bt) =>
                  `<option value="${bt}" ${state.user.bloodType === bt ? 'selected' : ''}>${bt}</option>`
              )
              .join('')}
          </select>
        </div>

        ${
          isHealthcareWorker
            ? `
          <div>
            <label class="block font-semibold mb-1">Hospital Affiliation</label>
            <input
              type="text"
              id="edit-user-hospital"
              value="${state.user.hospital || ''}"
              class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:border-rose-500"
            />
          </div>
        `
            : ''
        }

        ${
          isStaff
            ? `
          <div>
            <label class="block font-semibold mb-1">PRC License / Staff ID</label>
            <input
              type="text"
              id="edit-user-license"
              value="${state.user.licenseNumber || ''}"
              class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 font-mono focus:outline-none focus:border-rose-500"
            />
          </div>
        `
            : ''
        }

        <!-- Account Role (Protected Read-Only Field) -->
        <div class="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-stone-500 uppercase tracking-wide">Account Role</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
              ${normalizedRole} (Locked)
            </span>
          </div>
          <p class="text-[11px] text-stone-500 mt-1">
            Role elevation is restricted by Supabase PostgreSQL Row Level Security. Only Webpage Admins can grant staff permissions.
          </p>
        </div>

        <div class="pt-2 flex items-center gap-3">
          <button
            type="button"
            id="cancel-edit-profile-btn"
            class="flex-1 py-3 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="save-edit-profile-btn"
            class="flex-1 py-3 rounded-xl bg-[#52090E] hover:bg-[#3B070B] text-white font-bold transition-all shadow-md cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  document.getElementById('close-edit-profile-btn')?.addEventListener('click', closeModal);
  document.getElementById('cancel-edit-profile-btn')?.addEventListener('click', closeModal);

  document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('edit-profile-error-box');
    errBox?.classList.add('hidden');

    const newUsername = document.getElementById('edit-user-username').value.trim();
    const newContact = document.getElementById('edit-user-contact').value.trim();
    const newBloodType = document.getElementById('edit-user-bloodtype').value.trim();
    const newHospital = isHealthcareWorker
      ? document.getElementById('edit-user-hospital')?.value.trim() || ''
      : '';
    const newLicense = document.getElementById('edit-user-license')?.value.trim();

    if (!newUsername) {
      showToast('Please enter your full name or username.', 'error');
      return;
    }

    if (!isValidContactNumber(newContact)) {
      showToast('Please enter a valid 11-digit Philippine contact number (e.g. 09123456789).', 'error');
      document.getElementById('edit-user-contact')?.focus();
      return;
    }

    const saveBtn = document.getElementById('save-edit-profile-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      // Requirement 15: Persist to Supabase database and confirm update before showing success
      const res = await updateUserProfileInDB(state.user.id, {
        email: state.user.email,
        role: normalizedRole,
        username: newUsername,
        contact_number: newContact,
        blood_type: newBloodType,
        hospital: isHealthcareWorker ? newHospital || null : null,
        hospital_id: isHealthcareWorker ? state.user.hospitalId || null : null,
        license_number: newLicense !== undefined ? newLicense || null : state.user.licenseNumber || null,
      });

      if (res?.error) {
        const msg = res.error.message || 'Failed to update profile in database.';
        if (errBox) {
          errBox.textContent = msg;
          errBox.classList.remove('hidden');
        }
        showToast(msg, 'error');
        return;
      }

      const confirmed = res?.data;
      state.user.username = confirmed?.username || newUsername;
      state.user.contactNumber = confirmed?.contactNumber || newContact;
      state.user.bloodType = confirmed?.bloodType || newBloodType;
      state.user.role = normalizeRoleName(confirmed?.role || normalizedRole);
      state.user.hospital = isHealthcareWorker ? confirmed?.hospital ?? newHospital : '';
      state.user.hospitalId = isHealthcareWorker ? confirmed?.hospitalId ?? state.user.hospitalId : '';
      if (newLicense !== undefined) {
        state.user.licenseNumber = confirmed?.licenseNumber ?? newLicense;
      }

      try {
        localStorage.setItem('bloodsync_active_session_user', JSON.stringify(state.user));
      } catch {}

      showToast('Profile information updated and saved to database!');
      closeModal();
      updateUserProfileUI();
      renderProfileView();
    } catch (err) {
      console.error('[Supabase Profile Update Error]', err);
      const msg = err?.message || 'An unexpected error occurred while saving your profile.';
      if (errBox) {
        errBox.textContent = msg;
        errBox.classList.remove('hidden');
      }
      showToast(msg, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  });
}

/**
 * Render Medical Staff Roster & Provisioning (Webpage Admin only)
 */
function renderStaffManagementSection(container) {
  if (normalizeRoleName(state.user?.role) !== 'Webpage Admin') {
    container.innerHTML = '';
    return;
  }
  const staff = state.staffAccounts || [];

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Admin Action Bar -->
      <div class="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full bg-amber-500 text-stone-950 font-black text-[11px] tracking-wide uppercase">
              Webpage Admin Exclusive
            </span>
            <h2 class="text-lg sm:text-xl font-extrabold text-stone-900 dark:text-white">
              Authorized Staff &amp; Healthcare Worker Accounts
            </h2>
          </div>
          <p class="text-xs text-stone-600 dark:text-stone-300 max-w-2xl leading-relaxed">
            Per security regulations, public staff registration is restricted. Only authorized Webpage Admins can provision and issue authenticated credentials to Healthcare Workers and Webpage Admins.
          </p>
        </div>

        <button
          id="admin-open-provision-btn"
          class="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#52090E] hover:bg-[#3B070B] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all hover:scale-105 cursor-pointer"
        >
          <svg class="w-4 h-4 text-rose-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          <span>+ Provision Staff Account</span>
        </button>
      </div>

      <!-- Staff Roster Grid -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-stone-900 dark:text-white">
            Accredited Personnel Directory (${staff.length})
          </h3>
          <span class="text-xs text-stone-500">Enforced by PostgreSQL RLS &amp; Supabase Auth</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${staff
            .map((member) => {
              const memberRole = normalizeRoleName(member.role);
              const isMemberAdmin = memberRole === 'Webpage Admin';
              const staffInitials =
                member.username
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'MD';

              return `
              <div class="bg-white dark:bg-stone-900 rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-all space-y-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl ${
                      isMemberAdmin
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-300'
                    } flex items-center justify-center font-black text-sm shrink-0 shadow-inner">
                      ${staffInitials}
                    </div>
                    <div>
                      <h4 class="font-extrabold text-sm sm:text-base text-stone-900 dark:text-white leading-tight">
                        ${member.username}
                      </h4>
                      <p class="text-xs text-stone-500 dark:text-stone-400 font-mono mt-0.5">${member.licenseNumber || 'N/A'}</p>
                    </div>
                  </div>

                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isMemberAdmin
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }">
                    ${memberRole}
                  </span>
                </div>

                <div class="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 space-y-1.5 text-xs">
                  ${
                    !isMemberAdmin
                      ? `
                    <div class="flex items-center justify-between text-stone-600 dark:text-stone-300">
                      <span class="font-bold">Hospital:</span>
                      <span class="font-semibold text-stone-800 dark:text-stone-100 truncate max-w-[160px]">${member.hospital || 'N/A'}</span>
                    </div>
                  `
                      : ''
                  }
                  <div class="flex items-center justify-between text-stone-600 dark:text-stone-300">
                    <span class="font-bold">Contact:</span>
                    <span class="font-mono text-stone-800 dark:text-stone-100">${formatContactDisplay(member.contactNumber)}</span>
                  </div>
                  <div class="flex items-center justify-between text-stone-600 dark:text-stone-300">
                    <span class="font-bold">Email:</span>
                    <span class="font-medium text-stone-800 dark:text-stone-100 truncate max-w-[160px]">${member.email}</span>
                  </div>
                </div>

                <div class="flex items-center justify-between text-[11px] pt-1">
                  <span class="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Status: Active</span>
                  </span>
                  <span class="text-stone-400">Created: ${new Date(member.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;

  document.getElementById('admin-open-provision-btn')?.addEventListener('click', () => {
    if (normalizeRoleName(state.user?.role) !== 'Webpage Admin') {
      showToast('Unauthorized: Only Webpage Admins can provision staff accounts.', 'error');
      return;
    }
    openAdminProvisionModal();
  });
}

/**
 * Render Archived & Expired Appeals Section (Isolated to the authenticated user's own requests)
 */
function renderArchivedAppealsSection(container) {
  const q = state.profileSearchQuery.toLowerCase();
  let archivedList = state.requests.filter(
    (r) => (r.isArchived || r.status === 'Archived') && isRequestOwnedByUser(r, state.user)
  );

  if (q) {
    archivedList = archivedList.filter(
      (r) =>
        (r.patientName && r.patientName.toLowerCase().includes(q)) ||
        (r.hospitalName && r.hospitalName.toLowerCase().includes(q)) ||
        (r.bloodType && r.bloodType.toLowerCase().includes(q)) ||
        (r.condition && r.condition.toLowerCase().includes(q))
    );
  }

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Search Bar -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="relative w-full max-w-2xl">
          <svg class="w-5 h-5 text-rose-300 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            id="archived-search-input"
            value="${state.profileSearchQuery}"
            placeholder="Search your archived requests by patient name, hospital, blood type..."
            class="w-full pl-11 pr-4 py-3 rounded-full bg-[#8A3F47] dark:bg-[#4E1318] text-white placeholder-rose-200/80 border border-rose-700/50 focus:outline-none focus:ring-2 focus:ring-rose-400 text-xs sm:text-sm font-medium shadow-inner"
          />
        </div>

        <div class="text-xs text-stone-500 font-bold">
          Showing ${archivedList.length} archived record(s) for ${state.user.email}
        </div>
      </div>

      <!-- Archived Cards List -->
      ${
        archivedList.length === 0
          ? `
        <div class="text-center py-12 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-8 space-y-2">
          <p class="font-bold text-stone-700 dark:text-stone-300 text-sm">No archived appeals found under your account.</p>
          <p class="text-xs text-stone-500">Your expired appeals and removed requests are preserved here.</p>
        </div>
      `
          : `
        <div class="space-y-4">
          ${archivedList
            .map((req) => {
              const isAutoExpired = req.archivedReason === 'automatically_expired';
              const reasonLabel = isAutoExpired ? '⏰ Automatically Expired' : '👤 User Removed';
              const expDate = req.expiresAt ? new Date(req.expiresAt).toLocaleString() : 'N/A';
              const archDate = req.archivedAt ? new Date(req.archivedAt).toLocaleString() : 'Recently';

              return `
              <div class="bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-6 shadow-md border border-stone-200/90 dark:border-stone-800 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="flex items-center gap-3 flex-wrap">
                    <span class="inline-flex items-center justify-center px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-black text-sm tracking-tight border border-stone-300 shrink-0">
                      ${req.bloodType}
                    </span>

                    <div class="flex items-baseline gap-2">
                      <h3 class="font-extrabold text-lg sm:text-xl text-stone-800 dark:text-stone-100 leading-tight">
                        ${req.patientName}
                      </h3>
                      <span class="text-xs sm:text-sm text-stone-500 font-semibold">
                        ${req.age} years old
                      </span>
                    </div>

                    <!-- Archive Reason Badge -->
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      isAutoExpired
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                        : 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300 border border-stone-400'
                    }">
                      ${reasonLabel}
                    </span>

                    <span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                      Archived
                    </span>
                  </div>

                  <button
                    data-check-cert-id="${req.id}"
                    class="self-start sm:self-auto px-4 sm:px-5 py-2 rounded-xl bg-[#C7D8EA] hover:bg-[#B3C9DF] text-[#1E293B] font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    View Doctor Slip
                  </button>
                </div>

                <p class="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 -mt-1 font-medium">
                  <svg class="w-4 h-4 text-rose-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span class="font-semibold text-stone-700 dark:text-stone-300">${req.hospitalName}</span>
                </p>

                <!-- Archival Timestamps Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 text-xs">
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase text-stone-500 tracking-wider">Original Expiration Cutoff:</span>
                    <p class="font-mono font-semibold text-stone-800 dark:text-stone-200">${expDate}</p>
                  </div>
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase text-stone-500 tracking-wider">Archived Date &amp; Time:</span>
                    <p class="font-mono font-semibold text-stone-800 dark:text-stone-200">${archDate}</p>
                  </div>
                </div>

                <!-- Requisition & Sent Info Row -->
                <div class="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40 text-xs space-y-2">
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span class="text-[10px] font-bold uppercase text-stone-500 tracking-wider">Reason / Diagnosis:</span>
                      <p class="font-medium text-stone-800 dark:text-stone-200">${req.condition || 'N/A'}</p>
                    </div>
                    <div class="text-right">
                      <span class="text-[10px] font-bold uppercase text-stone-500 tracking-wider">Units:</span>
                      <p class="font-bold text-stone-900 dark:text-white">${req.unitsNeeded} unit(s) (${req.bloodType})</p>
                    </div>
                  </div>

                  <div class="pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-300 flex-wrap gap-2">
                    <span class="font-semibold">Clinical Certificate: ${req.doctorSlipUrl || req.doctor_slip_url ? 'Uploaded' : 'N/A'}</span>
                    <span>Emergency Contact: ${req.emergencyContact || 'Family'} (${formatContactDisplay(req.contactNumber)})</span>
                  </div>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }
    </div>
  `;

  const searchInput = document.getElementById('archived-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.profileSearchQuery = e.target.value.trim();
      renderArchivedAppealsSection(container);
    });
  }

  container.querySelectorAll('[data-check-cert-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rid = btn.getAttribute('data-check-cert-id');
      const req = state.requests.find((r) => r.id === rid);
      if (req && isRequestOwnedByUser(req, state.user)) {
        openCertificateModal(req);
      }
    });
  });
}

/**
 * Render Active (personal isolated) or Pending Audit Appeals List
 */
function renderAppealsListSection(container) {
  container.innerHTML = `
    <!-- Search & Post Blood Request Row -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="relative w-full sm:flex-1 max-w-2xl">
        <svg class="w-5 h-5 text-rose-300 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          type="text"
          id="profile-search-input"
          value="${state.profileSearchQuery}"
          placeholder="Search patient name, hospital, blood type..."
          class="w-full pl-11 pr-4 py-3 rounded-full bg-[#8A3F47] dark:bg-[#4E1318] text-white placeholder-rose-200/80 border border-rose-700/50 focus:outline-none focus:ring-2 focus:ring-rose-400 text-xs sm:text-sm font-medium shadow-inner"
        />
      </div>

      <button
        id="profile-post-blood-req-btn"
        class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#D84762] hover:bg-[#C23953] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all hover:scale-105 cursor-pointer whitespace-nowrap"
      >
        <div class="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold leading-none">
          +
        </div>
        <span>Post Blood Request</span>
      </button>
    </div>

    <div id="profile-requests-list" class="space-y-4">
      <!-- Populated below -->
    </div>
  `;

  document.getElementById('profile-post-blood-req-btn')?.addEventListener('click', () => {
    openNewRequestModal();
  });

  const searchInput = document.getElementById('profile-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.profileSearchQuery = e.target.value.trim();
      renderHealthcareRequestsList();
    });
  }

  renderHealthcareRequestsList();
}

/**
 * Helper to render the list of patient cards in Healthcare Worker / Webpage Admin Profile.
 */
function renderHealthcareRequestsList() {
  const listContainer = document.getElementById('profile-requests-list');
  if (!listContainer) return;

  const q = state.profileSearchQuery.toLowerCase();
  const onlyPending = state.profileSubTab === 'pending';

  const filtered = state.requests.filter((r) => {
    if (r.isArchived || r.status === 'Archived') return false;

    if (!onlyPending) {
      // Personal Active Appeals tab: strictly isolate to the authenticated user's email
      if (!isRequestOwnedByUser(r, state.user)) return false;
    } else {
      // Pending Audit tab: only Pending requests
      if (r.status !== 'Pending') return false;
    }

    const matchesSearch =
      !q ||
      (r.patientName && r.patientName.toLowerCase().includes(q)) ||
      (r.hospitalName && r.hospitalName.toLowerCase().includes(q)) ||
      (r.bloodType && r.bloodType.toLowerCase().includes(q)) ||
      (r.condition && r.condition.toLowerCase().includes(q));

    return matchesSearch;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="text-center py-12 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-8 space-y-2">
        <p class="font-bold text-stone-700 dark:text-stone-300 text-sm">${
          onlyPending
            ? 'No pending blood requests awaiting clinical audit.'
            : `No active blood requests found under your account (${state.user.email}).`
        }</p>
        <p class="text-xs text-stone-500">Click "Post Blood Request" above to submit a new blood appeal under your account.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filtered
    .map((req) => {
      const isCritical = req.urgency === 'Critical';
      const expDate = req.expiresAt ? new Date(req.expiresAt) : null;
      const expFormatted = expDate
        ? expDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : null;
      const isOwner = isRequestOwnedByUser(req, state.user);
      const hasCert = Boolean(req.doctorSlipUrl || req.doctor_slip_url);
      const hidePrivateInAudit = Boolean(req.isAnonymous) && !isOwner;

      return `
      <div
        id="profile-req-card-${req.id}"
        class="bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-6 shadow-md border border-stone-200/90 dark:border-stone-800 space-y-4 transition-all hover:shadow-lg"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#FCECEE] dark:bg-rose-950/80 text-[#D32F2F] dark:text-rose-300 font-black text-sm tracking-tight border border-rose-200/50 shrink-0">
              ${req.bloodType}
            </span>

            <div class="flex items-baseline gap-2">
              <h3 class="font-extrabold text-lg sm:text-xl text-[#900C1C] dark:text-rose-200 leading-tight">
                ${req.patientName}
              </h3>
              ${
                !hidePrivateInAudit && req.age != null
                  ? `<span class="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-semibold">
                      ${req.age} years old
                    </span>`
                  : ''
              }
            </div>

            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full ${
              isCritical ? 'bg-[#D32F2F]' : 'bg-[#E65100]'
            } text-white font-extrabold text-[10px] sm:text-xs tracking-wider uppercase shrink-0">
              ${req.urgency} URGENCY
            </span>

            ${
              req.status === 'Verified'
                ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] border border-emerald-300">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>VERIFIED</span>
              </span>
            `
                : `
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px] border border-amber-300">
                <span>⏳ Pending Audit</span>
              </span>
            `
            }

            ${
              expFormatted
                ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-[#8B1E22] dark:text-rose-300 font-bold text-[10px] border border-rose-200" title="Auto-archives at this timestamp">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                <span>Expires: ${expFormatted}</span>
              </span>
            `
                : ''
            }
          </div>

          <div class="flex items-center gap-2 self-start sm:self-auto">
            ${
              isOwner
                ? `
              <button
                data-remove-req-id="${req.id}"
                class="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-rose-900 dark:text-rose-200 font-bold text-xs transition-all cursor-pointer whitespace-nowrap border border-rose-300 dark:border-rose-800"
                title="Archive your appeal"
              >
                Remove Appeal
              </button>
            `
                : ''
            }

            <button
              data-check-cert-id="${req.id}"
              class="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#C7D8EA] hover:bg-[#B3C9DF] text-[#1E293B] font-extrabold text-xs uppercase tracking-wider transition-all duration-150 shadow-sm cursor-pointer whitespace-nowrap"
            >
              CHECK CERTIFICATE
            </button>
          </div>
        </div>

        <p class="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 -mt-1 font-medium">
          <svg class="w-4 h-4 text-[#D32F2F] shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span class="font-semibold text-stone-700 dark:text-stone-300">${req.hospitalName}</span>
          <span class="mx-1 text-stone-400">|</span>
          <span>Posted ${req.postedTime}</span>
        </p>

        <div class="rounded-2xl p-4 bg-[#FCECEE] dark:bg-[#25080C] border border-rose-200/60 dark:border-rose-950/60 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div class="space-y-0.5">
              <span class="text-[10px] sm:text-[11px] font-black uppercase text-stone-500 dark:text-rose-200/70 tracking-wider block">
                REQUIREMENT:
              </span>
              <span class="font-black text-[#52090E] dark:text-rose-200 text-xs sm:text-sm">
                ${req.bloodType} : ${req.unitsNeeded} unit/s
              </span>
            </div>

            <div class="space-y-0.5">
              <span class="text-[10px] sm:text-[11px] font-black uppercase text-stone-500 dark:text-rose-200/70 tracking-wider block">
                MEDICAL CONDITION:
              </span>
              <span class="font-bold text-stone-800 dark:text-stone-100 text-xs sm:text-sm leading-snug block line-clamp-2">
                ${req.condition || 'N/A'}
              </span>
            </div>

            <div class="space-y-0.5">
              <span class="text-[10px] sm:text-[11px] font-black uppercase text-stone-500 dark:text-rose-200/70 tracking-wider block">
                FAMILY/ATTENDANT CONTACT:
              </span>
              <span class="font-bold text-stone-800 dark:text-stone-100 text-xs sm:text-sm block truncate">
                ${hidePrivateInAudit ? 'Anonymous' : req.emergencyContact || 'Family Representative'}
              </span>
            </div>

            <div class="space-y-0.5">
              <span class="text-[10px] sm:text-[11px] font-black uppercase text-stone-500 dark:text-rose-200/70 tracking-wider block">
                CONTACT NUMBER:
              </span>
              <span class="font-bold font-mono text-stone-900 dark:text-white text-xs sm:text-sm block">
                ${hidePrivateInAudit ? 'Hidden (Anonymous)' : formatContactDisplay(req.contactNumber)}
              </span>
            </div>
          </div>

          <div class="pt-2 border-t border-rose-200/70 dark:border-rose-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-[11px] border border-stone-300 dark:border-stone-700">
                <span>Uploaded Clinical Certificate: ${hasCert ? 'Attached' : 'N/A'}</span>
              </span>
            </div>
            <button
              data-check-cert-id="${req.id}"
              class="text-[11px] font-bold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 underline cursor-pointer"
            >
              Audit Doctor Slip →
            </button>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  // Attach Check Certificate listeners
  listContainer.querySelectorAll('[data-check-cert-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rid = btn.getAttribute('data-check-cert-id');
      const req = state.requests.find((r) => r.id === rid);
      if (req) openCertificateModal(req);
    });
  });

  // Attach Remove Appeal listeners (strictly verified for request owner)
  listContainer.querySelectorAll('[data-remove-req-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const rid = btn.getAttribute('data-remove-req-id');
      const req = state.requests.find((r) => r.id === rid);
      if (!req || !isRequestOwnedByUser(req, state.user)) {
        showToast('Unauthorized: You can only remove blood requests created by your account.', 'error');
        return;
      }

      if (!confirm('Are you sure you want to remove and archive this blood appeal?')) return;

      req.isArchived = true;
      req.status = 'Archived';
      req.archivedReason = 'user_removed';
      req.archivedAt = new Date().toISOString();
      recalculateHospitalBloodNeeded();

      await archiveRequestInDB(rid, 'user_removed').catch((err) => console.warn('[Supabase Archive Error]', err));
      showToast(`Appeal for ${req.patientName} manually removed and archived.`);
      renderProfileView();
      renderRequests();
      renderHospitals();
      renderHomeUrgentRequests();
    });
  });
}
