import { state, elements } from './state.js';
import { openAuthModal } from './authModal.js';
import { openAddEventModal } from './add-event-modal.js';
import { openCertificateModal } from './check-certificate-modal.js';
import { openNewRequestModal } from './new-patient-req-modal.js';
import { openAdminProvisionModal } from './admin-provision-modal.js';
import { navigateTo } from './navigation-tabs.js';
import { showToast } from './ToastNotif.js';
import { signOutUser, archiveRequestInDB, updateBloodRequestStatus } from '../supabase.js';
import { formatContactDisplay } from './contact-utils.js';
import { renderEvents } from './events.js';
import { renderRequests } from './requests.js';
import { renderHomeUrgentRequests } from './HUrgntReq.js';

// Profile view subtab state: 'active' | 'pending' | 'archived' | 'staff'
if (!state.profileSubTab) {
  state.profileSubTab = 'active';
}

export function updateUserProfileUI() {
  if (!elements.userProfileContainer) return;

  if (state.user.isLoggedIn) {
    const initials = state.user.username
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'DS';

    const isHealthcare = state.user.role === 'Healthcare Worker' || state.user.role === 'Hospital Admin';
    const isAdmin = state.user.role === 'Hospital Admin';

    elements.userProfileContainer.innerHTML = `
      <div class="relative flex items-center">
        <!-- user-profile-btn opens profile modal first (does not directly redirect) -->
        <button
          id="user-profile-btn"
          type="button"
          class="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-400 cursor-pointer shadow-sm group"
          title="Profile (${state.user.username})"
          aria-label="Open profile modal"
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
              ${state.user.hospital ? `<span class="text-stone-400 font-normal truncate">(${state.user.hospital})</span>` : ''}
            </div>
          </div>

          <div class="py-2 space-y-1.5">
            <!-- 'See Profile' Button as requested: User must click this to navigate to profile -->
            <button
              id="see-profile-btn"
              type="button"
              class="w-full text-center px-4 py-2.5 text-xs font-bold text-white bg-[#52090E] hover:bg-[#3B070B] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow hover:shadow-md"
            >
              <svg class="w-4 h-4 text-rose-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>See Profile</span>
            </button>

            <!-- Role Cycle Switcher: Admin -> Staff -> Donor -->
            <button
              id="toggle-role-demo-btn"
              type="button"
              class="w-full text-left px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
            >
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>Cycle Role: <strong>${
                  isAdmin ? 'Staff Doctor' : isHealthcare ? 'Blood Donor' : 'Hospital Admin'
                }</strong></span>
              </span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono font-bold">Role</span>
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

    const userProfileBtn = document.getElementById('user-profile-btn');
    const dropdownMenu = document.getElementById('profile-dropdown-menu');
    const seeProfileBtn = document.getElementById('see-profile-btn');
    const toggleRoleBtn = document.getElementById('toggle-role-demo-btn');
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
        navigateTo('profile');
      });
    }

    if (toggleRoleBtn) {
      toggleRoleBtn.addEventListener('click', () => {
        dropdownMenu?.classList.add('hidden');
        if (state.user.role === 'Hospital Admin') {
          // Switch to Healthcare Worker
          state.user = {
            username: 'Dr. Marco Cruz, MD',
            email: 'dr.marcocruz@cavitemedical.ph',
            contactNumber: '09185552341',
            isLoggedIn: true,
            role: 'Healthcare Worker',
            hospital: 'Cavite Medical Center',
            hospitalId: 'cavite-medical-center',
            licenseNumber: 'PRC-0194883',
            bloodType: 'B+',
          };
          showToast('Switched to Healthcare Worker view (Dr. Marco Cruz).');
        } else if (state.user.role === 'Healthcare Worker') {
          // Switch to Donor
          state.user = {
            username: 'Juan Dela Cruz',
            email: 'juandelacruz@gmail.com',
            contactNumber: '0917-555-1234',
            isLoggedIn: true,
            role: 'Donor',
            bloodType: 'O+',
          };
          showToast('Switched to Blood Donor view.');
        } else {
          // Switch to Hospital Admin
          state.user = {
            username: 'Dr. Denice Salamanca, MD',
            email: 'denicesalamanca@gmail.com',
            contactNumber: '09123345467',
            isLoggedIn: true,
            role: 'Hospital Admin',
            hospital: 'Cavite Medical Center',
            hospitalId: 'cavite-medical-center',
            licenseNumber: 'PRC-0182442',
            bloodType: 'O+',
          };
          showToast('Switched to Hospital Admin view (Dr. Salamanca).');
        }
        updateUserProfileUI();
        if (state.activeTab === 'profile') {
          renderProfileView();
        }
        renderEvents();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await signOutUser();
        } catch (e) {
          console.warn('[Supabase SignOut]', e);
        }
        state.user = { username: '', email: '', contactNumber: '', isLoggedIn: false, role: 'Donor' };
        updateUserProfileUI();
        navigateTo('home');
      });
    }
  } else {
    // Logged Out UI
    elements.userProfileContainer.innerHTML = `
      <button
        id="login-btn"
        class="px-4 sm:px-5 py-2 rounded-full bg-white hover:bg-stone-100 text-[#52090E] font-bold text-xs sm:text-sm shadow-sm transition-all hover:shadow-md cursor-pointer"
      >
        Sign In / Register
      </button>
    `;

    document.getElementById('login-btn')?.addEventListener('click', () => {
      openAuthModal('login');
    });
  }
}

/**
 * Main Profile View Renderer
 */
export function renderProfileView() {
  const container = document.getElementById('profile-view-content');
  if (!container) return;

  const now = new Date();
  // Auto-archive any expired requests
  state.requests.forEach((r) => {
    if (!r.isArchived && r.expiresAt && new Date(r.expiresAt) <= now) {
      r.isArchived = true;
      r.status = 'Archived';
      r.archivedReason = 'automatically_expired';
      r.archivedAt = r.expiresAt;
      archiveRequestInDB(r.id, 'automatically_expired').catch(() => {});
    }
  });

  const isHealthcare = state.user.role === 'Healthcare Worker' || state.user.role === 'Hospital Admin';
  const isAdmin = state.user.role === 'Hospital Admin';

  const activeRequests = state.requests.filter((r) => !r.isArchived && r.status !== 'Archived');
  const pendingRequests = activeRequests.filter((r) => r.status === 'Pending');
  const archivedRequests = state.requests.filter((r) => r.isArchived || r.status === 'Archived');
  const staffCount = state.staffAccounts?.length || 0;

  const initials = state.user.username
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || (isHealthcare ? 'DS' : 'JD');

  if (isHealthcare) {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Top Profile Banner Card matching _n.jpg -->
        <div class="relative bg-[#52090E] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-rose-950/40 space-y-6">
          <!-- Role Switcher Button on top corner -->
          <button
            id="switch-to-donor-view-btn"
            class="absolute top-4 right-4 sm:top-6 sm:right-6 text-[11px] font-bold px-3 py-1.5 rounded-full bg-black/30 hover:bg-black/50 text-rose-200 border border-rose-800/60 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Cycle user role for testing"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <span>Switch Role (${isAdmin ? 'Admin' : 'Doctor'})</span>
          </button>

          <!-- Avatar & Doctor Details Row -->
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
                    ? `<span class="px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-xs font-black tracking-wide uppercase">Admin Authorized</span>`
                    : `<span class="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wide">Accredited Doctor</span>`
                }
              </div>

              <!-- 2x2 Metadata Grid with vertical divider -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 text-xs sm:text-sm text-stone-200">
                <div class="flex items-center justify-center sm:justify-start gap-2">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">ROLE:</span>
                  <span class="font-semibold text-white">${state.user.role}</span>
                </div>
                <div class="flex items-center justify-center sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-rose-800/80 sm:pl-8">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">CONTACT NUMBER:</span>
                  <span class="font-semibold font-mono text-white">${formatContactDisplay(state.user.contactNumber || '09123345467')}</span>
                </div>
                <div class="flex items-center justify-center sm:justify-start gap-2">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">HOSPITAL:</span>
                  <span class="font-semibold text-white">${state.user.hospital || 'Cavite Medical Center'}</span>
                </div>
                <div class="flex items-center justify-center sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-rose-800/80 sm:pl-8">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">EMAIL:</span>
                  <span class="font-semibold text-white truncate">${state.user.email || 'denicesalamanca@gmail.com'}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Divider line & Navigation Subtabs -->
          <div class="border-t border-rose-900/60 pt-4">
            <div class="flex flex-wrap items-center gap-2.5">
              <!-- Active Appeals Tab -->
              <button
                id="tab-active-appeals-btn"
                class="inline-flex items-center gap-2 px-5 py-2 rounded-full ${
                  state.profileSubTab === 'active'
                    ? 'bg-white text-[#52090E] ring-2 ring-rose-300 font-extrabold'
                    : 'bg-black/30 hover:bg-black/50 text-rose-100 font-bold'
                } text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <span>Active Appeals (${activeRequests.length})</span>
              </button>

              <!-- Request Approval Tab -->
              <button
                id="tab-pending-approval-btn"
                class="inline-flex items-center gap-2 px-5 py-2 rounded-full ${
                  state.profileSubTab === 'pending'
                    ? 'bg-amber-300 text-stone-950 ring-2 ring-white font-extrabold'
                    : 'bg-black/30 hover:bg-black/50 text-rose-100 font-bold'
                } text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                <span>Pending Audit (${pendingRequests.length})</span>
              </button>

              <!-- Archived Appeals & Expiration History Tab -->
              <button
                id="tab-archived-appeals-btn"
                class="inline-flex items-center gap-2 px-5 py-2 rounded-full ${
                  state.profileSubTab === 'archived'
                    ? 'bg-rose-200 text-[#52090E] ring-2 ring-white font-extrabold'
                    : 'bg-black/30 hover:bg-black/50 text-rose-100 font-bold'
                } text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                <span>Archived &amp; Expired (${archivedRequests.length})</span>
              </button>

              <!-- If Admin: Staff Accounts Tab -->
              ${
                isAdmin
                  ? `
                <button
                  id="tab-staff-accounts-btn"
                  class="inline-flex items-center gap-2 px-5 py-2 rounded-full ${
                    state.profileSubTab === 'staff'
                      ? 'bg-amber-400 text-stone-950 ring-2 ring-white font-extrabold'
                      : 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 font-bold border border-amber-600/60'
                  } text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span>Staff Roster (${staffCount})</span>
                </button>
              `
                  : ''
              }

              <!-- Add Event Drive button -->
              <button
                id="add-event-drive-pill-btn"
                class="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#40070B] hover:bg-[#300508] text-white font-extrabold text-xs sm:text-sm border border-rose-800/80 shadow transition-all cursor-pointer ml-auto"
              >
                <svg class="w-3.5 h-3.5 text-rose-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
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

    // Event listeners
    document.getElementById('switch-to-donor-view-btn')?.addEventListener('click', () => {
      // Cycle role
      if (state.user.role === 'Hospital Admin') {
        state.user = {
          username: 'Dr. Marco Cruz, MD',
          email: 'dr.marcocruz@cavitemedical.ph',
          contactNumber: '09185552341',
          isLoggedIn: true,
          role: 'Healthcare Worker',
          hospital: 'Cavite Medical Center',
          hospitalId: 'cavite-medical-center',
          licenseNumber: 'PRC-0194883',
          bloodType: 'B+',
        };
        showToast('Switched to Healthcare Worker view (Dr. Marco Cruz).');
      } else if (state.user.role === 'Healthcare Worker') {
        state.user = {
          username: 'Juan Dela Cruz',
          email: 'juandelacruz@gmail.com',
          contactNumber: '0917-555-1234',
          isLoggedIn: true,
          role: 'Donor',
          bloodType: 'O+',
        };
        showToast('Switched to Blood Donor view.');
      } else {
        state.user = {
          username: 'Dr. Denice Salamanca, MD',
          email: 'denicesalamanca@gmail.com',
          contactNumber: '09123345467',
          isLoggedIn: true,
          role: 'Hospital Admin',
          hospital: 'Cavite Medical Center',
          hospitalId: 'cavite-medical-center',
          licenseNumber: 'PRC-0182442',
          bloodType: 'O+',
        };
        showToast('Switched to Hospital Admin view (Dr. Salamanca).');
      }
      updateUserProfileUI();
      renderProfileView();
      renderEvents();
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

    document.getElementById('tab-staff-accounts-btn')?.addEventListener('click', () => {
      state.profileSubTab = 'staff';
      renderProfileView();
    });

    document.getElementById('add-event-drive-pill-btn')?.addEventListener('click', () => {
      openAddEventModal();
    });
  } else {
    // Normal User Profile UI (Donor / Patient)
    const myBookedDrives = state.events.filter((e) => state.bookedEventIds.has(e.id));
    const myRequests = state.requests.filter(
      (r) => !r.isArchived && (r.email === state.user.email || r.contactNumber === state.user.contactNumber)
    );
    const myArchivedRequests = state.requests.filter(
      (r) => r.isArchived && (r.email === state.user.email || r.contactNumber === state.user.contactNumber)
    );

    // Retrieve ONLY blood requests created by the authenticated user
    const myAppeals = state.requests.filter((r) => {
      if (r.isArchived || r.status === 'Archived') return false;
      return (
        (state.user.id && r.userId === state.user.id) ||
        (state.user.email && r.email && r.email.toLowerCase() === state.user.email.toLowerCase()) ||
        (state.user.contactNumber && r.contactNumber && r.contactNumber.replace(/\D/g, '') === state.user.contactNumber.replace(/\D/g, ''))
      );
    });

    container.innerHTML = `
      <div class="space-y-8">
        <!-- Normal User Profile Banner -->
        <div class="relative bg-[#52090E] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-rose-950/40 space-y-6">
          <button
            id="switch-to-doctor-view-btn"
            class="absolute top-4 right-4 sm:top-6 sm:right-6 text-[11px] font-bold px-3 py-1.5 rounded-full bg-white text-[#52090E] hover:bg-stone-100 transition-all flex items-center gap-1.5 cursor-pointer shadow"
            title="Toggle to Doctor / Admin view"
          >
            <svg class="w-3.5 h-3.5 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Switch to Admin / Doctor View</span>
          </button>

          <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 pt-1">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-rose-200 text-[#52090E] flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg border-2 border-white shrink-0">
              ${initials}
            </div>

            <div class="space-y-3 flex-1 text-center sm:text-left">
              <h1 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight font-sans">
                ${state.user.username || 'Juan Dela Cruz'}
              </h1>

              <!-- Profile Details (ROLE: Donor removed per requirement) -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-xs sm:text-sm text-stone-200">
                <div class="flex items-center justify-center sm:justify-start gap-2">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">BLOOD TYPE:</span>
                  <span class="font-bold text-white px-2.5 py-0.5 rounded-md bg-rose-900 border border-rose-700/60 shadow-sm">${state.user.bloodType || 'O+'}</span>
                </div>
                <div class="flex items-center justify-center sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-rose-800/80 sm:pl-6">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">CONTACT:</span>
                  <span class="font-semibold font-mono text-white">${formatContactDisplay(state.user.contactNumber || '0917-555-1234')}</span>
                </div>
                <div class="flex items-center justify-center sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-rose-800/80 sm:pl-6">
                  <span class="font-bold text-rose-200 uppercase tracking-wide">EMAIL:</span>
                  <span class="font-semibold text-white truncate">${state.user.email || 'juandelacruz@gmail.com'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="border-t border-rose-900/60 pt-4 flex flex-wrap items-center gap-3">
            <button
              id="normal-book-drive-btn"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#52090E] font-extrabold text-xs sm:text-sm shadow hover:bg-stone-100 transition-all cursor-pointer"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Browse Mobile Drives</span>
            </button>
            <button
              id="normal-post-req-btn"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#40070B] hover:bg-[#300508] text-white font-extrabold text-xs sm:text-sm border border-rose-800/80 shadow transition-all cursor-pointer"
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
                Displaying blood requests created and managed by your account.
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
                You do not have any active patient blood requests submitted under your account. Click below to submit an emergency appeal to accredited hospitals and donors.
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
                    <p class="text-xs text-stone-600 dark:text-stone-300 line-clamp-2">${req.condition}</p>

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
                      <button
                        data-remove-req-id="${req.id}"
                        class="px-2.5 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 text-[11px] font-bold transition-all cursor-pointer"
                        title="Archive this appeal"
                      >
                        Remove
                      </button>
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

    document.getElementById('switch-to-doctor-view-btn')?.addEventListener('click', () => {
      state.user = {
        username: 'Dr. Denice Salamanca, MD',
        email: 'denicesalamanca@gmail.com',
        contactNumber: '09123345467',
        isLoggedIn: true,
        role: 'Hospital Admin',
        hospital: 'Cavite Medical Center',
        hospitalId: 'cavite-medical-center',
        licenseNumber: 'PRC-0182442',
        bloodType: 'O+',
      };
      updateUserProfileUI();
      renderProfileView();
      renderEvents();
      showToast('Switched to Hospital Admin view (Dr. Salamanca).');
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
        if (!confirm('Are you sure you want to remove and archive this blood appeal?')) return;
        const target = state.requests.find((r) => r.id === rid);
        if (target) {
          target.isArchived = true;
          target.status = 'Archived';
          target.archivedReason = 'user_removed';
          target.archivedAt = new Date().toISOString();
          await archiveRequestInDB(rid, 'user_removed');
          showToast('Blood appeal removed and archived.');
          renderProfileView();
          renderRequests();
          renderHomeUrgentRequests();
        }
      });
    });

    container.querySelectorAll('[data-check-cert-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rid = btn.getAttribute('data-check-cert-id');
        const req = state.requests.find((r) => r.id === rid);
        if (req) openCertificateModal(req);
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

  const isAdmin = state.user.role === 'Hospital Admin';

  if (state.profileSubTab === 'staff' && isAdmin) {
    renderStaffManagementSection(container);
  } else if (state.profileSubTab === 'archived') {
    renderArchivedAppealsSection(container);
  } else {
    // 'active' or 'pending' appeals view
    renderAppealsListSection(container);
  }
}

/**
 * Render Medical Staff Roster & Provisioning (Hospital Admin only)
 */
function renderStaffManagementSection(container) {
  const staff = state.staffAccounts || [];

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Admin Action Bar -->
      <div class="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full bg-amber-500 text-stone-950 font-black text-[11px] tracking-wide uppercase">
              Admin Exclusive
            </span>
            <h2 class="text-lg sm:text-xl font-extrabold text-stone-900 dark:text-white">
              Authorized Healthcare Worker Accounts
            </h2>
          </div>
          <p class="text-xs text-stone-600 dark:text-stone-300 max-w-2xl leading-relaxed">
            Per Philippine DOH security regulations, public healthcare worker registration is restricted. Only authorized Hospital Administrators can provision and issue authenticated credentials to medical personnel.
          </p>
        </div>

        <button
          id="admin-open-provision-btn"
          class="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#52090E] hover:bg-[#3B070B] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all hover:scale-105 cursor-pointer"
        >
          <svg class="w-4 h-4 text-rose-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          <span>+ Provision Healthcare Worker</span>
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
              const staffInitials = member.username
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'MD';

              const isMemberAdmin = member.role === 'Hospital Admin';

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
                      <p class="text-xs text-stone-500 dark:text-stone-400 font-mono mt-0.5">${member.licenseNumber || 'PRC-0182442'}</p>
                    </div>
                  </div>

                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isMemberAdmin
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }">
                    ${member.role}
                  </span>
                </div>

                <div class="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 space-y-1.5 text-xs">
                  <div class="flex items-center justify-between text-stone-600 dark:text-stone-300">
                    <span class="font-bold">Hospital:</span>
                    <span class="font-semibold text-stone-800 dark:text-stone-100 truncate max-w-[160px]">${member.hospital || 'Cavite Medical Center'}</span>
                  </div>
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
    openAdminProvisionModal();
  });
}

/**
 * Render Archived & Expired Appeals Audit Section
 */
function renderArchivedAppealsSection(container) {
  const q = state.profileSearchQuery.toLowerCase();
  let archivedList = state.requests.filter((r) => r.isArchived || r.status === 'Archived');

  if (q) {
    archivedList = archivedList.filter(
      (r) =>
        r.patientName.toLowerCase().includes(q) ||
        r.hospitalName.toLowerCase().includes(q) ||
        r.bloodType.toLowerCase().includes(q) ||
        r.condition.toLowerCase().includes(q)
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
            placeholder="Search archived patient name, hospital, blood type..."
            class="w-full pl-11 pr-4 py-3 rounded-full bg-[#8A3F47] dark:bg-[#4E1318] text-white placeholder-rose-200/80 border border-rose-700/50 focus:outline-none focus:ring-2 focus:ring-rose-400 text-xs sm:text-sm font-medium shadow-inner"
          />
        </div>

        <div class="text-xs text-stone-500 font-bold">
          Showing ${archivedList.length} archived records
        </div>
      </div>

      <!-- Archived Cards List -->
      ${
        archivedList.length === 0
          ? `
        <div class="text-center py-12 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-8 space-y-2">
          <p class="font-bold text-stone-700 dark:text-stone-300 text-sm">No archived appeals found.</p>
          <p class="text-xs text-stone-500">Expired appeals and cancelled requests are permanently preserved here for auditing.</p>
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
                    Audit Receipt &amp; Slip
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
                      <p class="font-medium text-stone-800 dark:text-stone-200">${req.condition}</p>
                    </div>
                    <div class="text-right">
                      <span class="text-[10px] font-bold uppercase text-stone-500 tracking-wider">Units:</span>
                      <p class="font-bold text-stone-900 dark:text-white">${req.unitsNeeded} unit(s) (${req.bloodType})</p>
                    </div>
                  </div>

                  <div class="pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-300 flex-wrap gap-2">
                    <span class="font-semibold">Receipt: ${req.medicalReceiptNo || 'OR-HISTORIC-ARCHIVE'} • ₱${(req.receiptAmount || 4500).toLocaleString()}</span>
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
      if (req) openCertificateModal(req);
    });
  });
}

/**
 * Render Active or Pending Appeals List matching _n.jpg
 */
function renderAppealsListSection(container) {
  const onlyPending = state.profileSubTab === 'pending';

  container.innerHTML = `
    <!-- Search & Post Blood Request Row matching _n.jpg -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
      <!-- Search input pill with dark red / maroon background -->
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

      <!-- + Post Blood Request button -->
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

    <!-- Patient Request Cards List matching _n.jpg layout -->
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
 * Helper to render the list of patient cards in Healthcare Worker Profile (_n.jpg)
 */
function renderHealthcareRequestsList() {
  const listContainer = document.getElementById('profile-requests-list');
  if (!listContainer) return;

  const q = state.profileSearchQuery.toLowerCase();
  const onlyPending = state.profileSubTab === 'pending';

  let filtered = state.requests.filter((r) => {
    if (r.isArchived || r.status === 'Archived') return false;

    const matchesSearch =
      !q ||
      r.patientName.toLowerCase().includes(q) ||
      r.hospitalName.toLowerCase().includes(q) ||
      r.bloodType.toLowerCase().includes(q) ||
      r.condition.toLowerCase().includes(q);

    const matchesApprovalFilter = !onlyPending || r.status === 'Pending';
    return matchesSearch && matchesApprovalFilter;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="text-center py-12 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-8 space-y-2">
        <p class="font-bold text-stone-700 dark:text-stone-300 text-sm">No active blood requests match your filter.</p>
        <p class="text-xs text-stone-500">Try searching a different patient name, blood type, or view archived requests.</p>
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

      return `
      <!-- Request Card matching _n.jpg -->
      <div
        id="profile-req-card-${req.id}"
        class="bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-6 shadow-md border border-stone-200/90 dark:border-stone-800 space-y-4 transition-all hover:shadow-lg"
      >
        <!-- Top Row: Blood Type pill, Patient Name, Urgency, Hospital, and CHECK CERTIFICATE button -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 flex-wrap">
            <!-- Blood Type Pill Badge (Pink pill with bold red text) -->
            <span class="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#FCECEE] dark:bg-rose-950/80 text-[#D32F2F] dark:text-rose-300 font-black text-sm tracking-tight border border-rose-200/50 shrink-0">
              ${req.bloodType}
            </span>

            <!-- Patient Name & Age -->
            <div class="flex items-baseline gap-2">
              <h3 class="font-extrabold text-lg sm:text-xl text-[#900C1C] dark:text-rose-200 leading-tight">
                ${req.patientName}
              </h3>
              <span class="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-semibold">
                ${req.age} years old
              </span>
            </div>

            <!-- Urgency Badge (Bright red pill) -->
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
            <!-- Manual Remove Appeal Button -->
            <button
              data-remove-req-id="${req.id}"
              class="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-rose-900 dark:text-rose-200 font-bold text-xs transition-all cursor-pointer whitespace-nowrap border border-rose-300 dark:border-rose-800"
              title="Archive request with reason 'user_removed'"
            >
              Remove Appeal
            </button>

            <!-- CHECK CERTIFICATE button -->
            <button
              data-check-cert-id="${req.id}"
              class="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#C7D8EA] hover:bg-[#B3C9DF] text-[#1E293B] font-extrabold text-xs uppercase tracking-wider transition-all duration-150 shadow-sm cursor-pointer whitespace-nowrap"
            >
              CHECK CERTIFICATE
            </button>
          </div>
        </div>

        <!-- Hospital Location & Posted Time Sub-row with location pin -->
        <p class="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 -mt-1 font-medium">
          <svg class="w-4 h-4 text-[#D32F2F] shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span class="font-semibold text-stone-700 dark:text-stone-300">${req.hospitalName}</span>
          <span class="mx-1 text-stone-400">|</span>
          <span>Posted ${req.postedTime}</span>
        </p>

        <!-- Bottom Detail Section matching _n.jpg -->
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
                ${req.condition}
              </span>
            </div>

            <div class="space-y-0.5">
              <span class="text-[10px] sm:text-[11px] font-black uppercase text-stone-500 dark:text-rose-200/70 tracking-wider block">
                FAMILY/ATTENDANT CONTACT:
              </span>
              <span class="font-bold text-stone-800 dark:text-stone-100 text-xs sm:text-sm block truncate">
                ${req.emergencyContact || 'Elena Red (Spouse)'}
              </span>
            </div>

            <div class="space-y-0.5">
              <span class="text-[10px] sm:text-[11px] font-black uppercase text-stone-500 dark:text-rose-200/70 tracking-wider block">
                CONTACT NUMBER:
              </span>
              <span class="font-bold font-mono text-stone-900 dark:text-white text-xs sm:text-sm block">
                ${formatContactDisplay(req.contactNumber)}
              </span>
            </div>
          </div>

          <!-- Medical Receipts in Requestee Sent Info -->
          <div class="pt-2 border-t border-rose-200/70 dark:border-rose-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] border border-emerald-300">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <span>Medical Receipt: ${req.medicalReceiptNo || 'OR-MED-2026-004812'}</span>
              </span>
              <span class="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                ₱${(req.receiptAmount || (2050 + req.unitsNeeded * 1800)).toLocaleString()} • ${req.receiptStatus || 'Paid (Hospital Cashier)'}
              </span>
            </div>
            <button
              data-check-cert-id="${req.id}"
              class="text-[11px] font-bold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 underline cursor-pointer"
            >
              Audit Receipt &amp; Slip →
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

  // Attach Remove Appeal listeners (user_removed archive)
  listContainer.querySelectorAll('[data-remove-req-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rid = btn.getAttribute('data-remove-req-id');
      const req = state.requests.find((r) => r.id === rid);
      if (!req) return;

      req.isArchived = true;
      req.status = 'Archived';
      req.archivedReason = 'user_removed';
      req.archivedAt = new Date().toISOString();

      archiveRequestInDB(rid, 'user_removed').catch((err) => console.warn('[Supabase Archive Error]', err));
      showToast(`Appeal for ${req.patientName} manually removed and archived.`);
      renderProfileView();
      renderRequests();
      renderHomeUrgentRequests();
    });
  });
}
