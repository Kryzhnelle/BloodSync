import { state, elements } from './state.js';
import { renderRequests } from './requests.js';
import { renderHomeUrgentRequests } from './HUrgntReq.js';
import { renderProfileView } from './user-profile.js';
import { showToast } from './ToastNotif.js';
import { updateBloodRequestStatus } from '../supabase.js';
import { formatContactDisplay } from './contact-utils.js';

export function openCertificateModal(request) {
  state.selectedCertificateRequest = request;
  const modal = elements.certificateModal;
  if (!modal) return;

  const content = document.getElementById('certificate-modal-content');
  if (content) {
    const isHealthcare = state.user.role === 'Healthcare Worker' || state.user.role === 'Hospital Admin';
    const isVerified = request.status === 'Verified';

    const receiptNo = request.medicalReceiptNo || `OR-${request.hospitalId?.slice(0, 3)?.toUpperCase() || 'MED'}-2026-${request.id.slice(-6).toUpperCase()}`;
    const receiptDate = request.receiptDate || 'Sep 26, 2026';
    const receiptPayor = request.receiptPayor || request.emergencyContact || 'Elena Red (Family Representative)';
    const units = request.unitsNeeded || 2;
    const bloodCrossmatchFee = 1250;
    const componentFee = units * 1800;
    const adminSetFee = 450;
    const labFee = 350;
    const totalReceiptAmount = request.receiptAmount || (bloodCrossmatchFee + componentFee + adminSetFee + labFee);
    const slipImageUrl = getCertificateImageUrl(request);

    content.innerHTML = `
      <div class="relative w-full max-w-2xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-6 max-h-[92vh] overflow-y-auto font-sans">
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
            Auditing requestee's uploaded doctor slip and proof for: <span class="font-bold text-stone-800 dark:text-stone-200">${request.patientName}</span> (${request.age} y/o)
          </p>
        </div>

        <div class="space-y-5" id="cert-docs-container">
          <!-- Clinical Requisition Certificate Image uploaded by requestee -->
          <div id="doc-card-slip" class="rounded-2xl border-2 border-rose-300 dark:border-rose-900/60 p-5 bg-rose-50/30 dark:bg-stone-900 space-y-4 shadow-sm">
            <div class="border-b border-rose-200 dark:border-rose-900/60 pb-3 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-extrabold text-[10px] uppercase tracking-wider border border-rose-300 dark:border-rose-800">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    Certificate Image Uploaded by Requestee
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
                <p class="text-[10px] font-mono text-stone-500 dark:text-stone-400 mt-1">SLIP #REQ-${request.id.slice(-6).toUpperCase()}</p>
              </div>
            </div>

            <!-- Uploaded Image Container with Inspection & Zoom -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>Uploaded Clinical Certificate:</span>
                </span>
                <button
                  type="button"
                  id="cert-toggle-zoom-btn"
                  class="text-xs font-bold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  <span id="zoom-btn-label">Enlarge Certificate</span>
                </button>
              </div>

              <div id="cert-img-wrapper" class="relative rounded-2xl overflow-hidden border-2 border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-950 p-2 sm:p-4 flex items-center justify-center transition-all duration-200">
                <img
                  id="cert-uploaded-image"
                  src="${slipImageUrl}"
                  alt="Clinical Requisition Certificate uploaded by ${request.patientName}"
                  class="w-full max-h-[460px] object-contain rounded-xl shadow-lg border border-stone-200 dark:border-stone-800 bg-white transition-all duration-200 cursor-zoom-in"
                  title="Click to toggle enlarge"
                />
              </div>
            </div>

            <!-- Sent Info: Requisition details extracted from certificate -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white/70 dark:bg-stone-900/60 p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/50">
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
              <div>
                <span class="text-[10px] uppercase font-bold text-stone-400 block">Attending MD</span>
                <span class="font-bold text-stone-900 dark:text-white text-xs sm:text-sm block">
                  Dr. D. Salamanca, MD
                </span>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-stone-900/90 border border-stone-200 dark:border-stone-700 text-xs space-y-1">
              <span class="text-[10px] uppercase font-bold text-stone-400 block">Clinical Indication &amp; Surgical Notes:</span>
              <p class="font-medium text-stone-800 dark:text-stone-200">${request.condition}</p>
            </div>

            <div class="flex items-center justify-between text-[11px] pt-1 text-stone-500 border-t border-stone-200 dark:border-stone-700">
              <div>
                <span class="block">Uploaded by: ${request.emergencyContact || 'Family Representative'}</span>
                <span class="font-mono text-stone-700 dark:text-stone-300 font-bold">${formatContactDisplay(request.contactNumber)}</span>
              </div>
              <div class="text-right">
                <span class="italic text-emerald-700 dark:text-emerald-400 font-semibold block">✓ Image Scan Verified</span>
                <span class="text-stone-400">Accredited Cavite DOH Facility</span>
              </div>
            </div>
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
      request.status = 'Verified';
      request.verifiedByName = state.user.username;
      closeCertificateModal();
      renderRequests();
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
      request.status = 'Cancelled';
      closeCertificateModal();
      renderRequests();
      renderHomeUrgentRequests();
      renderProfileView();
      showToast(`Request for ${request.patientName} was declined.`);

      try {
        await updateBloodRequestStatus(request.id, 'Cancelled');
      } catch (e) {
        console.warn('[Supabase Reject Status]', e);
      }
    });

    // Image zoom toggle
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

  modal.classList.remove('hidden-view');
}

export function closeCertificateModal() {
  const modal = elements.certificateModal;
  if (modal) modal.classList.add('hidden-view');
  state.selectedCertificateRequest = null;
}

/**
 * Returns the requestee-uploaded doctor's slip image Data URI,
 * or generates an authentic scanned clinical blood requisition document SVG.
 */
export function getCertificateImageUrl(request) {
  if (request.doctorSlipUrl) {
    return request.doctorSlipUrl;
  }

  const slipId = `REQ-${(request.id || 'MED-01').toUpperCase()}-2026`;
  const urgencyLabel = (request.urgency || 'URGENT').toUpperCase();
  const hospital = request.hospitalName || 'Cavite Medical Center';
  const patient = request.patientName || 'Emergency Patient';
  const age = request.age || 35;
  const blood = request.bloodType || 'O+';
  const units = request.unitsNeeded || 2;
  const condition = request.condition || 'Emergency surgical requirement';
  const dateStr = request.receiptDate || request.postedTime || 'Sep 26, 2026';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 1100" width="850" height="1100">
    <rect width="850" height="1100" fill="#FBFBFA"/>
    <rect x="25" y="25" width="800" height="1050" rx="8" fill="#FFFFFF" stroke="#D1D5DB" stroke-width="2"/>
    <rect x="35" y="35" width="780" height="1030" rx="4" fill="none" stroke="#E5E7EB" stroke-width="1.5" stroke-dasharray="6,3"/>

    <!-- Hospital Header -->
    <g transform="translate(60, 60)">
      <circle cx="45" cy="45" r="40" fill="#52090E" />
      <path d="M45 22 v46 M22 45 h46" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>
      <circle cx="45" cy="45" r="42" fill="none" stroke="#B91C1C" stroke-width="1.5" stroke-dasharray="4,2"/>
      
      <text x="105" y="28" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="#6B7280" letter-spacing="2">REPUBLIC OF THE PHILIPPINES • DEPARTMENT OF HEALTH</text>
      <text x="105" y="52" font-family="'Times New Roman', Times, serif" font-size="24" font-weight="bold" fill="#52090E">${hospital}</text>
      <text x="105" y="72" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600" fill="#374151">DIVISION OF TRANSFUSION MEDICINE &amp; CLINICAL HEMATOLOGY</text>
      <text x="105" y="88" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#9CA3AF">Accredited Blood Services Network • Cavite District 1 • Form No. BSF-04-2026</text>
    </g>

    <!-- Certificate Title Header -->
    <rect x="50" y="180" width="750" height="40" fill="#52090E" rx="4"/>
    <text x="425" y="206" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">OFFICIAL CLINICAL BLOOD REQUISITION SLIP</text>

    <!-- Slip ID & Date -->
    <text x="60" y="248" font-family="Courier, monospace" font-size="13" font-weight="bold" fill="#1F2937">SLIP CONTROL NO: ${slipId}</text>
    <text x="560" y="248" font-family="Courier, monospace" font-size="13" font-weight="bold" fill="#1F2937">DATE ISSUED: ${dateStr}</text>

    <!-- Red Urgency Stamp -->
    <g transform="translate(580, 275) rotate(-10)">
      <rect x="0" y="0" width="180" height="52" rx="8" fill="#FEE2E2" stroke="#DC2626" stroke-width="3" stroke-dasharray="8,2" fill-opacity="0.9"/>
      <text x="90" y="32" font-family="Arial Black, Impact, sans-serif" font-size="18" font-weight="900" fill="#DC2626" text-anchor="middle" letter-spacing="3">${urgencyLabel}</text>
      <text x="90" y="46" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#991B1B" text-anchor="middle">PRIORITY PROCESSING</text>
    </g>

    <!-- Section 1: Patient Information -->
    <rect x="50" y="280" width="510" height="170" fill="#F9FAFB" stroke="#E5E7EB" rx="6"/>
    <text x="65" y="306" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="#4B5563" letter-spacing="1">PATIENT DEMOGRAPHICS &amp; ADMISSION RECORD</text>

    <text x="65" y="338" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">Full Name of Patient:</text>
    <text x="210" y="338" font-family="'Courier New', Courier, monospace" font-size="15" font-weight="bold" fill="#111827">${patient}</text>
    <line x1="205" y1="343" x2="540" y2="343" stroke="#D1D5DB" stroke-width="1"/>

    <text x="65" y="375" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">Age / Sex / Inpatient Bed:</text>
    <text x="210" y="375" font-family="'Courier New', Courier, monospace" font-size="13" font-weight="bold" fill="#111827">${age} Years Old • Ward Inpatient Bed 07</text>
    <line x1="205" y1="380" x2="540" y2="380" stroke="#D1D5DB" stroke-width="1"/>

    <text x="65" y="412" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">Hospital Case Registry:</text>
    <text x="210" y="412" font-family="'Courier New', Courier, monospace" font-size="13" font-weight="bold" fill="#B91C1C">HOS-PX-${(request.id || '01').slice(-6).toUpperCase()}</text>
    <line x1="205" y1="417" x2="540" y2="417" stroke="#D1D5DB" stroke-width="1"/>

    <!-- Section 2: Blood Requisition Details -->
    <rect x="50" y="470" width="750" height="200" fill="#FFFFFF" stroke="#E5E7EB" rx="6"/>
    <text x="65" y="496" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="#4B5563" letter-spacing="1">TRANSFUSION ORDER &amp; COMPATIBILITY TESTING SPECIFICATION</text>

    <text x="65" y="534" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">Required Blood Group:</text>
    <rect x="230" y="512" width="75" height="34" rx="6" fill="#52090E"/>
    <text x="267" y="536" font-family="Arial Black, Impact, sans-serif" font-size="18" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${blood}</text>

    <text x="330" y="534" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">Quantity Ordered:</text>
    <text x="450" y="534" font-family="'Courier New', Courier, monospace" font-size="15" font-weight="bold" fill="#111827">${units} Bag(s) [Whole Blood / Packed RBC]</text>

    <text x="65" y="580" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">Clinical Indication &amp; Diagnosis:</text>
    <text x="230" y="580" font-family="'Courier New', Courier, monospace" font-size="13" font-weight="bold" fill="#B91C1C">${condition}</text>
    <line x1="225" y1="586" x2="770" y2="586" stroke="#D1D5DB" stroke-width="1"/>

    <text x="65" y="620" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">Crossmatching Protocol:</text>
    <text x="230" y="620" font-family="Arial, sans-serif" font-size="12" fill="#374151">Major &amp; Minor Compatibility Titration with Anti-Human Globulin (Coombs) Phase</text>

    <text x="65" y="650" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">Emergency Contact (Payor):</text>
    <text x="230" y="650" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#111827">${request.emergencyContact || 'Family Representative'} (${request.contactNumber || '09123456789'})</text>

    <!-- Section 3: Attending Physician & Hospital Certification -->
    <rect x="50" y="690" width="750" height="240" fill="#F9FAFB" stroke="#E5E7EB" rx="6"/>
    <text x="65" y="716" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="#4B5563" letter-spacing="1">AUTHORIZED SIGNATURE &amp; CLINICAL ACCREDITATION</text>

    <!-- Physician Signature simulation -->
    <g transform="translate(90, 760)">
      <path d="M10 32 Q40 5 80 25 T150 15 T210 35" fill="none" stroke="#1E3A8A" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M40 38 Q70 18 120 22" fill="none" stroke="#1E3A8A" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="0" y1="42" x2="250" y2="42" stroke="#374151" stroke-width="1.5"/>
      <text x="125" y="62" font-family="'Times New Roman', serif" font-size="14" font-weight="bold" fill="#111827" text-anchor="middle">Dr. Denice Salamanca, MD</text>
      <text x="125" y="78" font-family="Arial, sans-serif" font-size="11" fill="#4B5563" text-anchor="middle">PRC Physician License #0182442</text>
      <text x="125" y="94" font-family="Arial, sans-serif" font-size="10" fill="#6B7280" text-anchor="middle">Specialist in Transfusion Medicine &amp; Surgery</text>
    </g>

    <!-- Official Hospital Embossed Stamp Simulation -->
    <g transform="translate(470, 750)">
      <circle cx="120" cy="50" r="48" fill="none" stroke="#52090E" stroke-width="3" stroke-dasharray="6,2"/>
      <circle cx="120" cy="50" r="42" fill="none" stroke="#52090E" stroke-width="1.2"/>
      <text x="120" y="38" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#52090E" text-anchor="middle">CAVITE HEALTH NETWORK</text>
      <text x="120" y="52" font-family="Arial Black, Impact, sans-serif" font-size="11" font-weight="bold" fill="#52090E" text-anchor="middle">ACCREDITED</text>
      <text x="120" y="66" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#52090E" text-anchor="middle">BLOOD BANK DIVISION</text>
      <line x1="10" y1="115" x2="230" y2="115" stroke="#374151" stroke-width="1.5"/>
      <text x="120" y="132" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#111827" text-anchor="middle">Hospital Blood Bank Registrar</text>
    </g>

    <!-- Barcode simulation at bottom -->
    <g transform="translate(60, 950)">
      <rect x="0" y="0" width="730" height="90" fill="#FFFFFF" stroke="#D1D5DB" rx="4"/>
      <g transform="translate(20, 15)">
        <rect x="0" y="0" width="3" height="40" fill="#111827"/>
        <rect x="5" y="0" width="1" height="40" fill="#111827"/>
        <rect x="9" y="0" width="4" height="40" fill="#111827"/>
        <rect x="16" y="0" width="2" height="40" fill="#111827"/>
        <rect x="22" y="0" width="5" height="40" fill="#111827"/>
        <rect x="30" y="0" width="2" height="40" fill="#111827"/>
        <rect x="35" y="0" width="4" height="40" fill="#111827"/>
        <rect x="42" y="0" width="1" height="40" fill="#111827"/>
        <rect x="46" y="0" width="3" height="40" fill="#111827"/>
        <rect x="52" y="0" width="6" height="40" fill="#111827"/>
        <rect x="62" y="0" width="2" height="40" fill="#111827"/>
        <rect x="67" y="0" width="4" height="40" fill="#111827"/>
        <rect x="74" y="0" width="1" height="40" fill="#111827"/>
        <rect x="78" y="0" width="5" height="40" fill="#111827"/>
        <rect x="86" y="0" width="3" height="40" fill="#111827"/>
        <rect x="92" y="0" width="2" height="40" fill="#111827"/>
        <rect x="97" y="0" width="4" height="40" fill="#111827"/>
        <rect x="104" y="0" width="2" height="40" fill="#111827"/>
        <rect x="109" y="0" width="6" height="40" fill="#111827"/>
        <rect x="118" y="0" width="1" height="40" fill="#111827"/>
        <rect x="122" y="0" width="3" height="40" fill="#111827"/>
        <rect x="128" y="0" width="4" height="40" fill="#111827"/>
        <text x="80" y="55" font-family="Courier, monospace" font-size="10" fill="#374151" text-anchor="middle">*REQ-${(request.id || '01').toUpperCase()}-2026*</text>
      </g>
      <text x="240" y="32" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#1F2937">DIGITALLY VERIFIED REQUISITION SLIP UPLOADED BY REQUESTEE</text>
      <text x="240" y="50" font-family="Arial, sans-serif" font-size="10" fill="#4B5563">Document scanned &amp; submitted with official hospital cashier receipt. Audited under Cavite DOH Blood Network guidelines.</text>
      <text x="240" y="68" font-family="Courier, monospace" font-size="9" fill="#9CA3AF">CHECKSUM: SHA256-DOH-${request.id || '01'}-CLINICAL-REQ-CAVITE-VERIFIED</text>
    </g>
  </svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
