import { state, elements, normalizeRoleName, recalculateHospitalBloodNeeded } from './state.js';
import { openContactModal } from './view-contact-modal.js';
import { openCertificateModal } from './check-certificate-modal.js';
import { openAuthModal } from './authModal.js';
import { archiveRequestInDB } from '../supabase.js';
import { maskName } from './contact-utils.js';

export function renderRequests() {
  const { bloodType, urgency, search } = state.requestsFilter;
  const now = new Date();
  let anyArchived = false;

  // Automatically archive expired requests
  state.requests.forEach((r) => {
    if (!r.isArchived && r.expiresAt && new Date(r.expiresAt) <= now) {
      r.isArchived = true;
      r.status = 'Archived';
      r.archivedReason = 'automatically_expired';
      r.archivedAt = r.expiresAt;
      anyArchived = true;
      archiveRequestInDB(r.id, 'automatically_expired').catch(() => {});
    }
  });

  // Always keep hospital bloodNeeded synchronized with active blood requests
  recalculateHospitalBloodNeeded();

  // Only show active, non-archived, non-cancelled requests
  const activeList = state.requests.filter(
    (r) => !r.isArchived && r.status !== 'Archived' && r.status !== 'Cancelled' && r.status !== 'Rejected'
  );

  const isUserLoggedIn = Boolean(state.user?.isLoggedIn);
  const role = normalizeRoleName(state.user?.role);
  const isHealthcareOrAdmin = role === 'Healthcare Worker' || role === 'Webpage Admin';

  const filtered = activeList.filter((r) => {
    const matchesBlood = bloodType === 'All' || r.bloodType === bloodType;
    const matchesUrgency = urgency === 'All' || r.urgency === urgency;
    const matchesSearch =
      (r.patientName && r.patientName.toLowerCase().includes(search.toLowerCase())) ||
      (r.hospitalName && r.hospitalName.toLowerCase().includes(search.toLowerCase())) ||
      (r.condition && r.condition.toLowerCase().includes(search.toLowerCase()));
    return matchesBlood && matchesUrgency && matchesSearch;
  });

  if (filtered.length === 0) {
    if (elements.requestsGrid) elements.requestsGrid.classList.add('hidden-view');
    if (elements.requestsEmpty) elements.requestsEmpty.classList.remove('hidden-view');
  } else {
    if (elements.requestsEmpty) elements.requestsEmpty.classList.add('hidden-view');
    if (elements.requestsGrid) {
      elements.requestsGrid.classList.remove('hidden-view');
      elements.requestsGrid.innerHTML = filtered
        .map((req) => {
          const isCritical = req.urgency === 'Critical';
          const isUrgent = req.urgency === 'Urgent';
          const isVerified = req.status === 'Verified';

          const expDate = req.expiresAt ? new Date(req.expiresAt) : null;
          const expFormatted = expDate
            ? expDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : null;

          // Privacy & Anonymity rules
          const isOwner =
            isUserLoggedIn &&
            ((req.email && state.user.email && req.email.toLowerCase() === state.user.email.toLowerCase()) ||
              (req.userId && state.user.id && req.userId === state.user.id));

          let displayName = req.patientName;
          let anonymousBadge = '';

          if (req.isAnonymous) {
            if (isHealthcareOrAdmin || isOwner) {
              displayName = req.patientName;
              anonymousBadge = `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-200 border border-emerald-600/70" title="Staff View: Requester submitted anonymously">🔒 Anonymous (Staff View)</span>`;
            } else {
              displayName = maskName(req.patientName);
              anonymousBadge = `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-950 text-rose-200 border border-rose-800/60" title="Requester submitted anonymously — Name masked, contact details available">🔒 Anonymous</span>`;
            }
          } else if (!isUserLoggedIn) {
            displayName = maskName(req.patientName);
            anonymousBadge = `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/40 text-rose-200 border border-rose-800/50">Private</span>`;
          }

          return `
          <div
            id="patient-card-${req.id}"
            class="bg-[#52090E] text-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between space-y-5 border border-rose-900/40"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-full bg-white text-[#52090E] flex items-center justify-center font-black text-sm shadow shrink-0">
                  ${req.bloodType}
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-lg font-bold text-white leading-tight">
                      ${displayName}
                    </h3>
                    ${anonymousBadge}
                  </div>
                  ${
                    req.isAnonymous
                      ? `<p class="text-xs text-rose-200/80">${req.hospitalName || 'Hospital Confidential'} • Direct Contact Available</p>`
                      : req.age != null
                      ? `<p class="text-xs text-rose-200">Age ${req.age}</p>`
                      : `<p class="text-xs text-rose-200/80">${req.hospitalName}</p>`
                  }
                </div>
              </div>

              <div class="flex flex-col items-end gap-1 shrink-0">
                <span
                  class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                    isCritical
                      ? 'bg-rose-600 text-white'
                      : isUrgent
                      ? 'bg-orange-600 text-white'
                      : 'bg-amber-600 text-white'
                  }"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  <span>${req.urgency}</span>
                </span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isVerified
                    ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600'
                    : 'bg-amber-900/80 text-amber-300 border border-amber-600'
                }">
                  ${isVerified ? '✓ Verified' : '⏳ Pending Audit'}
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#FCD5D8] text-[#52090E] shadow-sm">
                <span class="font-black text-sm">${req.bloodType}</span>
                <span class="text-xs font-semibold text-stone-700">
                  ${req.unitsNeeded} unit/s needed
                </span>
              </div>

              ${
                expFormatted
                  ? `
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/30 border border-rose-800/60 text-rose-200 text-xs font-medium" title="Appeal Expiration">
                  <svg class="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Expires: <strong class="text-white">${expFormatted}</strong></span>
                </div>
              `
                  : ''
              }
            </div>

            <div class="space-y-2 text-xs">
              ${
                req.condition
                  ? `<p class="text-rose-100 font-medium line-clamp-2">${req.condition}</p>`
                  : ''
              }
              <p class="text-stone-300 flex items-start gap-1.5">
                <svg class="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <span class="line-clamp-1">${req.isAnonymous ? 'Hospital / Place Withheld for Privacy' : req.hospitalName}</span>
              </p>
              ${
                req.isAnonymous
                  ? `<div class="p-2 rounded-xl bg-black/25 border border-rose-900/40 text-[11px] text-rose-200 flex items-center justify-between gap-1">
                      <span class="font-medium text-stone-300">Privacy Active</span>
                      <span class="font-bold text-white flex items-center gap-1">
                        <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        Contact Details Available
                      </span>
                    </div>`
                  : ''
              }
            </div>

            <div class="pt-3 border-t border-rose-900/50 flex items-center justify-between gap-2 flex-wrap">
              <span class="text-[11px] text-rose-300 font-light truncate">${req.postedTime}</span>

              <div class="flex items-center gap-2">
                <button
                  data-check-cert-req-id="${req.id}"
                  class="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700/60 font-semibold text-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  Doctor Slip
                </button>
                <button
                  data-contact-req-id="${req.id}"
                  class="px-3.5 py-1.5 rounded-xl bg-white text-[#52090E] hover:bg-rose-50 font-bold text-xs transition-all shadow hover:shadow-md cursor-pointer whitespace-nowrap"
                >
                  View Contact
                </button>
              </div>
            </div>
          </div>
        `;
        })
        .join('');

      // Wire contact buttons with authentication guard
      elements.requestsGrid.querySelectorAll('[data-contact-req-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!state.user?.isLoggedIn) {
            openAuthModal(
              'login',
              'Please sign in or register to access confidential patient contact information and donor coordination channels.'
            );
            return;
          }
          const reqId = btn.getAttribute('data-contact-req-id');
          const matched = state.requests.find((r) => r.id === reqId);
          if (matched) openContactModal(matched);
        });
      });

      // Wire doctor slip buttons with authentication guard
      elements.requestsGrid.querySelectorAll('[data-check-cert-req-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!state.user?.isLoggedIn) {
            openAuthModal(
              'login',
              'Please sign in or register to inspect clinical requisition certificates and audit medical verification.'
            );
            return;
          }
          const reqId = btn.getAttribute('data-check-cert-req-id');
          const matched = state.requests.find((r) => r.id === reqId);
          if (matched) openCertificateModal(matched);
        });
      });
    }
  }
}
