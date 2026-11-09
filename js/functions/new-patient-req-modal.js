import { state, elements } from './state.js';
import { formatContactDisplay } from './contact-utils.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function openNewRequestModal(preserveExistingValues = false) {
  const hospitalSelect = document.getElementById('new-req-hospital');
  if (hospitalSelect) {
    const previousValue = hospitalSelect.value;
    hospitalSelect.innerHTML = state.hospitals
      .map((h) => `<option value="${h.id}">${h.name} (${h.municipality})</option>`)
      .join('');
    if (preserveExistingValues && previousValue && state.hospitals.some((h) => h.id === previousValue)) {
      hospitalSelect.value = previousValue;
    }
  }

  // Configure expiration date restrictions to prevent past selections
  const dateInput = document.getElementById('new-req-expire-date');
  const timeInput = document.getElementById('new-req-expire-time');
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (dateInput) {
    dateInput.min = todayStr;
    if (!preserveExistingValues || !dateInput.value) {
      // Default to 48 hours in future
      const futureDate = new Date(Date.now() + 48 * 3600 * 1000);
      dateInput.value = futureDate.toISOString().split('T')[0];
    }
  }

  if (timeInput && (!preserveExistingValues || !timeInput.value)) {
    timeInput.value = '17:00';
  }

  elements.newRequestModal?.classList.remove('hidden-view');
}

export function closeNewRequestModal() {
  elements.newRequestModal?.classList.add('hidden-view');
}

export function openConfirmRequestModal(draftRequest) {
  const modal = document.getElementById('confirm-request-modal');
  const summaryBox = document.getElementById('confirm-request-summary-box');
  const errBox = document.getElementById('confirm-request-error-msg');
  if (!modal || !summaryBox) return;

  if (errBox) {
    errBox.textContent = '';
    errBox.classList.add('hidden');
  }

  const formattedPhone = formatContactDisplay(draftRequest.contactNumber || '');
  const expDateObj = draftRequest.expiresAt ? new Date(draftRequest.expiresAt) : null;
  const formattedExpires =
    expDateObj && !isNaN(expDateObj.getTime())
      ? expDateObj.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'Not specified';

  const slipBadgeHtml = draftRequest.doctorSlipUrl
    ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">✓ Doctor's Slip Attached (Pending Verification)</span>`
    : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[11px]">No Slip Uploaded (Pending Hospital Audit)</span>`;

  const anonBadgeHtml = draftRequest.isAnonymous
    ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 font-bold text-[11px]">Anonymous Request (Name masked as D****e for normal users)</span>`
    : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-[11px]">Standard Public Request</span>`;

  summaryBox.innerHTML = `
    <div class="flex items-center justify-between border-b border-stone-200 dark:border-stone-700 pb-2.5">
      <div>
        <span class="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">Patient / Requester Name</span>
        <span class="text-sm font-extrabold text-stone-900 dark:text-white">${escapeHtml(draftRequest.patientName)}</span>
        <span class="text-xs text-stone-500 dark:text-stone-400 ml-1">(${escapeHtml(draftRequest.age)} yrs old)</span>
      </div>
      <div class="text-right">
        <span class="inline-flex items-center px-3 py-1 rounded-xl bg-[#52090E] text-white font-black text-sm shadow-sm">
          ${escapeHtml(draftRequest.bloodType)} • ${escapeHtml(draftRequest.unitsNeeded)} Unit${Number(draftRequest.unitsNeeded) > 1 ? 's' : ''}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
      <div>
        <span class="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">Hospital / Place of Confinement</span>
        <span class="font-bold text-stone-800 dark:text-stone-100">${escapeHtml(draftRequest.hospitalName)}</span>
      </div>
      <div>
        <span class="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">Urgency Level</span>
        <span class="font-extrabold text-rose-700 dark:text-rose-400">${escapeHtml(draftRequest.urgency)}</span>
      </div>
      <div>
        <span class="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">Medical Reason / Diagnosis</span>
        <span class="font-medium text-stone-700 dark:text-stone-300">${escapeHtml(draftRequest.condition || 'Not specified')}</span>
      </div>
      <div>
        <span class="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">Appeal Expiration Cutoff</span>
        <span class="font-medium text-stone-700 dark:text-stone-300">${escapeHtml(formattedExpires)}</span>
      </div>
      <div>
        <span class="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">Emergency Contact &amp; Relationship</span>
        <span class="font-semibold text-stone-800 dark:text-stone-200">${escapeHtml(draftRequest.emergencyContact)} (${escapeHtml(draftRequest.relationshipToPatient)})</span>
      </div>
      <div>
        <span class="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">Contact Number &amp; Email</span>
        <span class="font-mono font-bold text-stone-800 dark:text-stone-200">${escapeHtml(formattedPhone)}</span>
        <span class="block text-[11px] text-stone-500 dark:text-stone-400 truncate">${escapeHtml(draftRequest.email)}</span>
      </div>
    </div>

    <div class="pt-2 border-t border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
      <div>
        <span class="text-[10px] uppercase tracking-wider font-bold text-stone-400 block mb-0.5">Verification Slip Status</span>
        ${slipBadgeHtml}
      </div>
      <div>
        <span class="text-[10px] uppercase tracking-wider font-bold text-stone-400 block mb-0.5">Privacy Preference</span>
        ${anonBadgeHtml}
      </div>
    </div>
  `;

  elements.newRequestModal?.classList.add('hidden-view');
  modal.classList.remove('hidden-view');
}

export function closeConfirmRequestModal() {
  const modal = document.getElementById('confirm-request-modal');
  modal?.classList.add('hidden-view');
}

