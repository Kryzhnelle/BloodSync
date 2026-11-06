import { state, elements } from './state.js';
import { showToast } from './ToastNotif.js';
import { formatContactDisplay, maskName } from './contact-utils.js';
import { fetchRequestContactFromDB, isSupabaseConfigured, isAuthorizedStaffRole } from '../supabase.js';

export async function openContactModal(request) {
  if (!request) return;
  state.selectedRequest = request;
  const container = document.getElementById('view-contact-modal-content');
  if (!container) return;

  // Determine user authorization
  const activeUser = state.user || {};
  const userRole = (activeUser.role || '').trim();
  const isAuthorizedRole = isAuthorizedStaffRole(userRole);
  const userEmail = (activeUser.email || '').trim().toLowerCase();

  // Enforce backend/database privacy check
  let resolvedRequest = { ...request };
  if (request.id) {
    try {
      const dbContact = await fetchRequestContactFromDB(request.id);
      if (dbContact) {
        resolvedRequest = {
          ...resolvedRequest,
          patientName: dbContact.patientName || dbContact.patient_name || resolvedRequest.patientName,
          hospitalName: dbContact.hospitalName || dbContact.hospital_name || resolvedRequest.hospitalName,
          isAnonymous: Boolean(dbContact.isAnonymous ?? dbContact.is_anonymous ?? resolvedRequest.isAnonymous),
          contactNumber: dbContact.contactNumber || dbContact.contact_number || null,
          email: dbContact.email || null,
          age: dbContact.age ?? null,
          emergencyContact: dbContact.emergencyContact || dbContact.emergency_contact || null,
          relationshipToPatient:
            dbContact.relationshipToPatient || dbContact.relationship_to_patient || null,
          authorizedStaffView: Boolean(dbContact.authorizedStaffView || dbContact.isAuthorizedStaff),
        };
      }
    } catch (err) {
      console.warn('[Contact Modal DB Verification]', err);
    }
  }

  const isOwner = Boolean(
    activeUser.isLoggedIn &&
    userEmail &&
    (
      (resolvedRequest.email && userEmail === resolvedRequest.email.trim().toLowerCase()) ||
      (resolvedRequest.userId && activeUser.id === resolvedRequest.userId)
    )
  );

  const isStaffOrOwner = (activeUser.isLoggedIn && (isAuthorizedRole || isOwner)) || Boolean(resolvedRequest.authorizedStaffView);

  // Ensure contact details are resolved for anonymous requests so donors can reach out
  if (!resolvedRequest.contactNumber || !resolvedRequest.email) {
    const rawMatch =
      INITIAL_PATIENT_REQUESTS.find((r) => r && r.id === request.id) ||
      (Array.isArray(state.requests) ? state.requests.find((r) => r && r.id === request.id) : null);
    if (rawMatch) {
      if (!resolvedRequest.contactNumber) {
        resolvedRequest.contactNumber = rawMatch.contactNumber || rawMatch.contact_number || null;
      }
      if (!resolvedRequest.email) {
        resolvedRequest.email = rawMatch.email || null;
      }
    }
  }

  const isAnon = Boolean(resolvedRequest.isAnonymous);

  if (isAnon) {
    if (isStaffOrOwner) {
      // A. Webpage Admin and Healthcare Workers (and Request Owner):
      // View complete, original unmasked information including patient full name,
      // age, emergency contact, relationship to patient, contact number, and email.
      const relationshipDisplay =
        resolvedRequest.relationshipToPatient && String(resolvedRequest.relationshipToPatient).trim()
          ? resolvedRequest.relationshipToPatient
          : 'N/A';

      container.innerHTML = `
        <div
          class="relative w-full max-w-lg bg-[#55080E] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-900/60 overflow-hidden"
        >
          <button
            id="close-contact-modal-btn"
            class="absolute top-5 right-5 p-2 rounded-full text-rose-200 hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
            aria-label="Close Contact Info"
          >
            <svg class="w-6 h-6 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>

          <div class="flex items-center gap-4 pr-8 mb-6">
            <div class="w-16 h-16 rounded-full bg-white text-[#55080E] flex items-center justify-center font-black text-xl shadow-lg shrink-0">
              ${resolvedRequest.initials || (resolvedRequest.patientName ? resolvedRequest.patientName.slice(0, 2).toUpperCase() : 'PT')}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-xl sm:text-2xl font-bold text-white leading-tight">
                  ${resolvedRequest.patientName}
                </h3>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-200 border border-emerald-600/70 text-[10px] font-bold uppercase tracking-wider">
                  Staff Verified • Full Access
                </span>
              </div>
              <p class="text-xs text-rose-200/90 mt-0.5">
                ${resolvedRequest.age != null ? `Age ${resolvedRequest.age} • ` : ''}Anonymous Request (Staff View)
              </p>
            </div>
          </div>

          <div class="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[#F8B4B9] text-[#55080E] mb-6 shadow-sm">
            <span class="font-black text-lg">${resolvedRequest.bloodType || 'Blood Appeal'}</span>
            <span class="text-xs sm:text-sm font-bold text-stone-800">
              ${resolvedRequest.unitsNeeded ? `${resolvedRequest.unitsNeeded} unit/s needed` : 'Donation Needed'}
            </span>
          </div>

          <!-- Complete Unmasked Details for Authorized Staff / Healthcare Workers -->
          <div class="space-y-4 text-sm sm:text-base border-t border-rose-900/50 pt-5 mb-6 text-stone-100">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span class="font-semibold text-rose-200">Relationship to Patient:</span>
              <span class="font-medium text-white">${relationshipDisplay}</span>
            </div>

            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
              <span class="font-semibold text-rose-200">Emergency Contact:</span>
              <span class="font-medium">${resolvedRequest.emergencyContact || 'N/A'}</span>
            </div>

            <div class="flex items-center justify-between group p-3 rounded-2xl bg-black/25 border border-rose-900/50">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-rose-900/50 flex items-center justify-center shrink-0 text-rose-300">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div class="min-w-0">
                  <span class="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block">Contact Number</span>
                  <a
                    href="tel:${resolvedRequest.contactNumber || ''}"
                    class="font-bold text-white font-mono hover:text-rose-200 transition-colors text-base"
                  >
                    ${formatContactDisplay(resolvedRequest.contactNumber || 'N/A')}
                  </a>
                </div>
              </div>
              ${
                resolvedRequest.contactNumber
                  ? `<button
                      id="copy-phone-btn"
                      class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Copy phone number"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </button>`
                  : ''
              }
            </div>

            <div class="flex items-center justify-between group p-3 rounded-2xl bg-black/25 border border-rose-900/50">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-rose-900/50 flex items-center justify-center shrink-0 text-rose-300">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <div class="min-w-0">
                  <span class="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block">Email Address</span>
                  <a
                    href="mailto:${resolvedRequest.email || ''}"
                    class="font-bold text-white hover:underline break-all text-sm sm:text-base leading-tight"
                  >
                    ${resolvedRequest.email || 'N/A'}
                  </a>
                </div>
              </div>
              ${
                resolvedRequest.email
                  ? `<button
                      id="copy-email-btn"
                      class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Copy email address"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </button>`
                  : ''
              }
            </div>

            <div class="pt-2 flex items-start gap-3 text-stone-200">
              <svg class="w-5 h-5 text-rose-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <div>
                <span class="text-xs font-semibold text-rose-300 block uppercase tracking-wider">Hospital / Medical Center</span>
                <span class="text-sm sm:text-base font-semibold text-white">
                  ${resolvedRequest.hospitalName}
                </span>
              </div>
            </div>

            <div class="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-600/50 text-xs text-emerald-200 leading-relaxed space-y-1">
              <p class="font-bold text-white flex items-center gap-1.5">
                <span>✓ Authorized Staff View</span>
              </p>
              <p>
                As an authenticated Webpage Admin or Healthcare Worker, you are granted complete, unmasked access to all requester details and emergency contacts for clinical verification and patient coordination.
              </p>
            </div>
          </div>

          <div class="mt-6 pt-4 flex justify-end border-t border-rose-900/40">
            <button
              id="done-contact-modal-btn"
              class="w-full sm:w-auto py-3 px-6 rounded-xl bg-black/30 hover:bg-black/40 text-stone-200 font-bold text-sm cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      `;
    } else {
      // B. Normal Users (Donors and Patients):
      // Mask the requester's name using the format D****e.
      // Display the requester's contact number and email address.
      // Continue hiding other personal information (emergency contact, relationship, age, etc.).
      const maskedName = maskName(resolvedRequest.patientName);

      container.innerHTML = `
        <div
          class="relative w-full max-w-lg bg-[#55080E] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-900/60 overflow-hidden"
        >
          <button
            id="close-contact-modal-btn"
            class="absolute top-5 right-5 p-2 rounded-full text-rose-200 hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
            aria-label="Close Contact Info"
          >
            <svg class="w-6 h-6 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>

          <div class="flex items-center gap-4 pr-8 mb-6">
            <div class="w-14 h-14 rounded-full bg-rose-950 border border-rose-700/60 text-rose-200 flex items-center justify-center font-black text-xl shadow-lg shrink-0">
              🔒
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-xl sm:text-2xl font-bold text-white leading-tight">
                  ${maskedName}
                </h3>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-200 border border-rose-700/70 text-[10px] font-bold uppercase tracking-wider">
                  Anonymous Request
                </span>
              </div>
              <p class="text-xs text-rose-200/80 mt-0.5">
                Requester name masked (${maskedName}) • Verified direct contact details available
              </p>
            </div>
          </div>

          <div class="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[#F8B4B9] text-[#55080E] mb-6 shadow-sm">
            <span class="font-black text-lg">${resolvedRequest.bloodType || 'Blood Appeal'}</span>
            <span class="text-xs sm:text-sm font-bold text-stone-800">
              ${resolvedRequest.unitsNeeded ? `${resolvedRequest.unitsNeeded} unit/s needed` : 'Donation Needed'}
            </span>
          </div>

          <!-- Contact Details Displayed For Normal Users -->
          <div class="space-y-4 text-sm sm:text-base border-t border-rose-900/50 pt-5 mb-6 text-stone-100">
            <div class="space-y-1">
              <span class="text-xs font-bold uppercase tracking-wider text-rose-300 block">
                Direct Contact Coordinates
              </span>
              <p class="text-xs text-rose-200/80">
                You may contact the requester directly via phone or email to coordinate blood donation:
              </p>
            </div>

            <div class="pt-2 space-y-3.5">
              <!-- Contact Number in XXXX-XXX-XXXX format -->
              <div class="flex items-center justify-between group p-3 rounded-2xl bg-black/25 border border-rose-900/50">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-8 h-8 rounded-lg bg-rose-900/50 flex items-center justify-center shrink-0 text-rose-300">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div class="min-w-0">
                    <span class="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block">Contact Number</span>
                    <a
                      href="tel:${resolvedRequest.contactNumber || ''}"
                      class="font-bold text-white font-mono hover:text-rose-200 transition-colors text-base"
                    >
                      ${formatContactDisplay(resolvedRequest.contactNumber || 'N/A')}
                    </a>
                  </div>
                </div>
                ${
                  resolvedRequest.contactNumber
                    ? `<button
                        id="copy-phone-btn"
                        class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Copy phone number"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      </button>`
                    : ''
                }
              </div>

              <!-- Email Address -->
              <div class="flex items-center justify-between group p-3 rounded-2xl bg-black/25 border border-rose-900/50">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-8 h-8 rounded-lg bg-rose-900/50 flex items-center justify-center shrink-0 text-rose-300">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </div>
                  <div class="min-w-0">
                    <span class="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block">Email Address</span>
                    <a
                      href="mailto:${resolvedRequest.email || ''}"
                      class="font-bold text-white hover:underline break-all text-sm sm:text-base leading-tight"
                    >
                      ${resolvedRequest.email || 'N/A'}
                    </a>
                  </div>
                </div>
                ${
                  resolvedRequest.email
                    ? `<button
                        id="copy-email-btn"
                        class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Copy email address"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      </button>`
                    : ''
                }
              </div>
            </div>

            <div class="pt-2 flex items-start gap-3 text-stone-200">
              <svg class="w-5 h-5 text-rose-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <div>
                <span class="text-xs font-semibold text-rose-300 block uppercase tracking-wider">Hospital / Medical Center</span>
                <span class="text-sm sm:text-base font-semibold text-white">
                  ${resolvedRequest.hospitalName || 'Cavite Healthcare Facility'}
                </span>
              </div>
            </div>

            <div class="p-3.5 rounded-2xl bg-black/30 border border-rose-800/40 text-xs text-rose-200/90 leading-relaxed space-y-1">
              <p class="font-bold text-white flex items-center gap-1.5">
                <span>🔒 Privacy Protected Appeal</span>
              </p>
              <p>
                This request was submitted anonymously. The requester's full name is masked (${maskedName}), and emergency contact information, relationship to patient, and other private personal details are protected. Verified contact number and email are displayed above so you can reach out directly.
              </p>
            </div>
          </div>

          <div class="mt-6 pt-4 flex justify-end border-t border-rose-900/40">
            <button
              id="done-contact-modal-btn"
              class="w-full sm:w-auto py-3 px-6 rounded-xl bg-black/30 hover:bg-black/40 text-stone-200 font-bold text-sm cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      `;
    }
  } else {
    // Non-anonymous blood request: display full authorized contact & relationship details (without Call Family Directly)
    const relationshipDisplay =
      resolvedRequest.relationshipToPatient && String(resolvedRequest.relationshipToPatient).trim()
        ? resolvedRequest.relationshipToPatient
        : 'N/A';

    container.innerHTML = `
      <div
        class="relative w-full max-w-lg bg-[#55080E] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-900/60 overflow-hidden"
      >
        <button
          id="close-contact-modal-btn"
          class="absolute top-5 right-5 p-2 rounded-full text-rose-200 hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
          aria-label="Close Contact Info"
        >
          <svg class="w-6 h-6 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <div class="flex items-center gap-4 pr-8 mb-6">
          <div class="w-16 h-16 rounded-full bg-white text-[#55080E] flex items-center justify-center font-black text-xl shadow-lg shrink-0">
            ${resolvedRequest.initials || 'NP'}
          </div>
          <div>
            <h3 class="text-xl sm:text-2xl font-bold text-white leading-tight">
              ${resolvedRequest.patientName}
            </h3>
            ${
              resolvedRequest.age != null
                ? `<p class="text-sm text-rose-200">Age ${resolvedRequest.age}</p>`
                : ''
            }
          </div>
        </div>

        <div class="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[#F8B4B9] text-[#55080E] mb-6 shadow-sm">
          <span class="font-black text-lg">${resolvedRequest.bloodType}</span>
          <span class="text-xs sm:text-sm font-bold text-stone-800">
            ${resolvedRequest.unitsNeeded} unit/s needed
          </span>
        </div>

        <div class="space-y-4 text-sm sm:text-base border-t border-rose-900/50 pt-5 mb-6 text-stone-100">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span class="font-semibold text-rose-200">Relationship to Patient:</span>
            <span class="font-medium text-white">${relationshipDisplay}</span>
          </div>

          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
            <span class="font-semibold text-rose-200">Emergency Contact:</span>
            <span class="font-medium">${resolvedRequest.emergencyContact || 'N/A'}</span>
          </div>

          <div class="flex items-center justify-between group">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span class="font-semibold text-rose-200">Contact Number:</span>
              <span class="font-medium font-mono">${formatContactDisplay(resolvedRequest.contactNumber || 'N/A')}</span>
            </div>
            ${
              resolvedRequest.contactNumber
                ? `<button
                    id="copy-phone-btn"
                    class="p-1.5 rounded-lg hover:bg-white/10 text-rose-300 hover:text-white transition-colors cursor-pointer"
                    title="Copy number"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </button>`
                : ''
            }
          </div>

          <div class="flex items-center justify-between group">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-rose-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <span class="font-semibold text-rose-200">Email Address:</span>
              <a href="mailto:${resolvedRequest.email || ''}" class="font-medium hover:underline break-all">${resolvedRequest.email || 'N/A'}</a>
            </div>
            ${
              resolvedRequest.email
                ? `<button
                    id="copy-email-btn"
                    class="p-1.5 rounded-lg hover:bg-white/10 text-rose-300 hover:text-white transition-colors cursor-pointer"
                    title="Copy email"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </button>`
                : ''
            }
          </div>
        </div>

        <div class="pt-4 border-t border-rose-900/50 flex items-start gap-3 text-stone-200">
          <svg class="w-5 h-5 text-rose-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span class="text-sm sm:text-base font-semibold text-white">
            ${resolvedRequest.hospitalName}
          </span>
        </div>

        <div class="mt-6 pt-4 flex justify-end">
          <button
            id="done-contact-modal-btn"
            class="w-full sm:w-auto py-3 px-6 rounded-xl bg-black/30 hover:bg-black/40 text-stone-200 font-bold text-sm cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    `;
  }

  document.getElementById('close-contact-modal-btn')?.addEventListener('click', closeContactModal);
  document.getElementById('done-contact-modal-btn')?.addEventListener('click', closeContactModal);

  document.getElementById('copy-phone-btn')?.addEventListener('click', () => {
    if (navigator.clipboard && resolvedRequest.contactNumber) {
      navigator.clipboard.writeText(resolvedRequest.contactNumber);
      showToast('Phone number copied to clipboard!');
    }
  });

  document.getElementById('copy-email-btn')?.addEventListener('click', () => {
    if (navigator.clipboard && resolvedRequest.email) {
      navigator.clipboard.writeText(resolvedRequest.email);
      showToast('Email address copied to clipboard!');
    }
  });

  elements.viewContactModal?.classList.remove('hidden-view');
}

export function closeContactModal() {
  elements.viewContactModal?.classList.add('hidden-view');
  state.selectedRequest = null;
}
