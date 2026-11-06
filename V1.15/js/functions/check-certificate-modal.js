import { state, elements, normalizeRoleName, recalculateHospitalBloodNeeded } from './state.js';
import { renderRequests } from './requests.js';
import { renderHospitals } from './View.js';
import { renderHomeUrgentRequests } from './HUrgntReq.js';
import { renderProfileView, isRequestOwnedByUser } from './user-profile.js';
import { showToast } from './ToastNotif.js';
import { updateBloodRequestStatus } from '../supabase.js';
import { formatContactDisplay } from './contact-utils.js';

export function openCertificateModal(request) {
  state.selectedCertificateRequest = request;
  const modal = elements.certificateModal;
  if (!modal) return;

  const content = document.getElementById('certificate-modal-content');
  if (content) {
    const role = normalizeRoleName(state.user?.role);
    const isHealthcare =
      Boolean(state.user?.isLoggedIn) &&
      (role === 'Healthcare Worker' || role === 'Webpage Admin');
    const isVerified = request.status === 'Verified';
    const isOwner = isRequestOwnedByUser(request, state.user);
    const hidePrivate = Boolean(request.isAnonymous) && !isOwner;

    const rawSlipValue =
      typeof request.doctorSlipUrl === 'string'
        ? request.doctorSlipUrl.trim()
        : typeof request.doctor_slip_url === 'string'
        ? request.doctor_slip_url.trim()
        : '';
    const hasUploadedCertificate = Boolean(rawSlipValue);
    const clinicalIndication =
      request.condition && String(request.condition).trim() ? request.condition : 'N/A';

    content.innerHTML = `
      <div class="relative w-full max-w-2xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-6 max-h-[calc(100vh-7.5rem)] overflow-y-auto font-sans">
        <!-- Close button -->
        <button
          type="button"
          id="close-cert-modal-btn"
          class="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
          aria-label="Close modal"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <!-- Modal Header -->
        <div class="space-y-1">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 text-xs font-bold uppercase tracking-wider">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Medical Requisition Audit</span>
          </div>
          <h3 class="text-xl sm:text-2xl font-bold tracking-tight text-[#52090E] dark:text-rose-300">
            Requisition Certificate &amp; Slip
          </h3>
          <p class="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
            Auditing requestee's uploaded doctor slip and proof for: <span class="font-bold text-stone-800 dark:text-stone-200">${request.patientName}</span>${
              !hidePrivate && request.age != null ? ` (${request.age} y/o)` : ''
            }
          </p>
        </div>

        <div class="space-y-5" id="cert-docs-container">
          <!-- Clinical Requisition Certificate Card -->
          <div id="doc-card-slip" class="rounded-2xl border-2 border-rose-300 dark:border-rose-900/60 p-5 bg-rose-50/30 dark:bg-stone-900 space-y-4 shadow-sm">
            <div class="border-b border-rose-200 dark:border-rose-900/60 pb-3 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-extrabold text-[10px] uppercase tracking-wider border border-rose-300 dark:border-rose-800">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    Clinical Requisition Record
                  </span>
                  <span class="text-[10px] text-stone-500 font-medium">Doctor's Clinical Slip</span>
                </div>
                <h4 class="font-extrabold text-base sm:text-lg text-stone-900 dark:text-white mt-1">
                  ${request.hospitalName}
                </h4>
                <p class="text-xs text-stone-600 dark:text-stone-300">Department of Pathology &amp; Transfusion Medicine</p>
              </div>

              <div class="text-right">
                <span class="inline-block px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                  isVerified
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300'
                }">
                  ${isVerified ? 'VERIFIED ACCREDITED' : 'PENDING AUDIT'}
                </span>
                <p class="text-[10px] font-mono text-stone-500 dark:text-stone-400 mt-1">SLIP #REQ-${String(request.id || '').slice(-6).toUpperCase()}</p>
              </div>
            </div>

            <!-- Uploaded Clinical Certificate Section -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>Uploaded Clinical Certificate:</span>
                </span>
                ${
                  hasUploadedCertificate
                    ? `
                  <button
                    type="button"
                    id="cert-toggle-zoom-btn"
                    class="text-xs font-bold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    <span id="zoom-btn-label">Enlarge Certificate</span>
                  </button>
                `
                    : `<span class="font-mono font-bold text-stone-500 dark:text-stone-400">N/A</span>`
                }
              </div>

              ${
                hasUploadedCertificate
                  ? `
                <div id="cert-img-wrapper" class="relative rounded-2xl overflow-hidden border-2 border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-950 p-2 sm:p-4 flex items-center justify-center transition-all duration-200">
                  <img
                    id="cert-uploaded-image"
                    src="${rawSlipValue}"
                    alt="Clinical Requisition Certificate uploaded by ${request.patientName}"
                    class="w-full max-h-[460px] object-contain rounded-xl shadow-lg border border-stone-200 dark:border-stone-800 bg-white transition-all duration-200 cursor-zoom-in"
                    title="Click to toggle enlarge"
                  />
                </div>
              `
                  : `
                <div class="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-4 text-xs text-stone-500 dark:text-stone-400 font-semibold">
                  N/A
                </div>
              `
              }
            </div>

            <!-- Requisition details -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white/70 dark:bg-stone-900/60 p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/50">
              <div>
                <span class="text-[10px] uppercase font-bold text-stone-400 block">Patient Name</span>
                <span class="font-bold text-stone-900 dark:text-white text-xs sm:text-sm block truncate">${request.patientName}</span>
              </div>
              <div>
                <span class="text-[10px] uppercase font-bold text-stone-400 block">Blood Component</span>
                <span class="font-black text-rose-700 dark:text-rose-400 text-xs sm:text-sm block">
                  ${request.bloodType} (${request.unitsNeeded} units)
                </span>
              </div>
              <div>
                <span class="text-[10px] uppercase font-bold text-stone-400 block">Urgency Status</span>
                <span class="font-bold text-stone-900 dark:text-white text-xs sm:text-sm block">
                  ${request.urgency}
                </span>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-stone-900/90 border border-stone-200 dark:border-stone-700 text-xs space-y-1">
              <span class="text-[10px] uppercase font-bold text-stone-400 block">Clinical Indication &amp; Surgical Notes:</span>
              <p class="font-medium text-stone-800 dark:text-stone-200">${clinicalIndication}</p>
            </div>

            ${
              !hidePrivate
                ? `
              <div class="flex items-center justify-between text-[11px] pt-1 text-stone-500 border-t border-stone-200 dark:border-stone-700">
                <div>
                  <span class="block">Uploaded by: ${request.emergencyContact || 'Family Representative'}${
                    request.relationshipToPatient ? ` (${request.relationshipToPatient})` : ''
                  }</span>
                  <span class="font-mono text-stone-700 dark:text-stone-300 font-bold">${formatContactDisplay(request.contactNumber)}</span>
                </div>
              </div>
            `
                : `
              <div class="flex items-center justify-between text-[11px] pt-1 text-stone-500 border-t border-stone-200 dark:border-stone-700">
                <span>Anonymous Request — Personal contact details hidden</span>
              </div>
            `
            }
          </div>
        </div>

        <!-- Action Footer -->
        <div class="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          ${
            isHealthcare && !isVerified
              ? `
            <button
              type="button"
              id="cert-approve-btn"
              class="w-full sm:w-auto px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Approve &amp; Verify Appeal</span>
            </button>
            <button
              type="button"
              id="cert-reject-btn"
              class="w-full sm:w-auto px-4 py-2.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold text-xs sm:text-sm hover:bg-rose-200 transition-all cursor-pointer"
            >
              Reject / Request Re-upload
            </button>
          `
              : isVerified
              ? `
            <div class="px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              <span>Verified &amp; Officially Broadcast</span>
            </div>
          `
              : ''
          }
          <button
            type="button"
            id="cert-close-footer-btn"
            class="w-full sm:w-auto px-5 py-2.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs sm:text-sm hover:bg-stone-200 dark:hover:bg-stone-700 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    `;

    document.getElementById('close-cert-modal-btn')?.addEventListener('click', closeCertificateModal);
    document.getElementById('cert-close-footer-btn')?.addEventListener('click', closeCertificateModal);

    document.getElementById('cert-approve-btn')?.addEventListener('click', async () => {
      if (!isHealthcare) {
        showToast('Unauthorized: Only Healthcare Workers or Webpage Admins can approve requests.', 'error');
        return;
      }
      request.status = 'Verified';
      request.verifiedByName = state.user.username;
      recalculateHospitalBloodNeeded();
      closeCertificateModal();
      renderRequests();
      renderHospitals();
      renderHomeUrgentRequests();
      renderProfileView();
      showToast(`Request for ${request.patientName} has been approved and broadcast!`);

      try {
        await updateBloodRequestStatus(request.id, 'Verified', state.user.username);
      } catch (e) {
        console.warn('[Supabase Verify Status]', e);
      }
    });

    document.getElementById('cert-reject-btn')?.addEventListener('click', async () => {
      if (!isHealthcare) {
        showToast('Unauthorized: Only Healthcare Workers or Webpage Admins can reject requests.', 'error');
        return;
      }
      request.status = 'Cancelled';
      recalculateHospitalBloodNeeded();
      closeCertificateModal();
      renderRequests();
      renderHospitals();
      renderHomeUrgentRequests();
      renderProfileView();
      showToast(`Request for ${request.patientName} was declined.`);

      try {
        await updateBloodRequestStatus(request.id, 'Cancelled');
      } catch (e) {
        console.warn('[Supabase Reject Status]', e);
      }
    });

    // Image zoom toggle (only when an actual certificate image is uploaded)
    if (hasUploadedCertificate) {
      const toggleZoomBtn = document.getElementById('cert-toggle-zoom-btn');
      const zoomBtnLabel = document.getElementById('zoom-btn-label');
      const certImg = document.getElementById('cert-uploaded-image');
      let isEnlarged = false;

      const toggleZoom = () => {
        isEnlarged = !isEnlarged;
        if (isEnlarged) {
          certImg?.classList.remove('max-h-[460px]');
          certImg?.classList.add('max-h-none', 'w-full');
          if (zoomBtnLabel) zoomBtnLabel.textContent = 'Standard View';
        } else {
          certImg?.classList.add('max-h-[460px]');
          certImg?.classList.remove('max-h-none');
          if (zoomBtnLabel) zoomBtnLabel.textContent = 'Enlarge Certificate';
        }
      };

      toggleZoomBtn?.addEventListener('click', toggleZoom);
      certImg?.addEventListener('click', toggleZoom);
    }
  }

  modal.classList.remove('hidden-view');
}

export function closeCertificateModal() {
  const modal = elements.certificateModal;
  if (modal) modal.classList.add('hidden-view');
  state.selectedCertificateRequest = null;
}
