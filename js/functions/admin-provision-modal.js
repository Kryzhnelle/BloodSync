import { state } from './state.js';
import { adminCreateHealthcareWorkerAccount } from '../supabase.js';
import { isValidContactNumber } from './contact-utils.js';
import { showToast } from './ToastNotif.js';

export function openAdminProvisionModal() {
  const modal = document.getElementById('admin-provision-staff-modal');
  const hospSelect = document.getElementById('prov-staff-hospital');
  if (hospSelect) {
    hospSelect.innerHTML = state.hospitals
      .map((h) => `<option value="${h.id}">${h.name} (${h.municipality})</option>`)
      .join('');
  }

  const msgBox = document.getElementById('admin-provision-msg');
  if (msgBox) {
    msgBox.className = 'hidden text-xs p-3 rounded-xl';
    msgBox.textContent = '';
  }

  // Pre-fill hospital with current admin's hospital if available
  if (hospSelect && state.user.hospitalId) {
    hospSelect.value = state.user.hospitalId;
  }

  modal?.classList.remove('hidden-view');
}

export function closeAdminProvisionModal() {
  const modal = document.getElementById('admin-provision-staff-modal');
  modal?.classList.add('hidden-view');
}

export function setupAdminProvisionListeners(onStaffAdded) {
  document.getElementById('admin-provision-backdrop')?.addEventListener('click', closeAdminProvisionModal);
  document.getElementById('admin-provision-close-btn')?.addEventListener('click', closeAdminProvisionModal);
  document.getElementById('prov-staff-cancel-btn')?.addEventListener('click', closeAdminProvisionModal);

  document.getElementById('admin-provision-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Verify authorized admin role
    if (state.user.role !== 'Hospital Admin') {
      showToast('Unauthorized: Only an authenticated Hospital Admin can provision staff accounts.', 'error');
      closeAdminProvisionModal();
      return;
    }

    const name = document.getElementById('prov-staff-name').value.trim();
    const license = document.getElementById('prov-staff-license').value.trim();
    const email = document.getElementById('prov-staff-email').value.trim();
    const password = document.getElementById('prov-staff-password').value;
    const phone = document.getElementById('prov-staff-phone').value.trim();
    const role = document.getElementById('prov-staff-role').value;
    const hospitalId = document.getElementById('prov-staff-hospital').value;
    const hospitalObj = state.hospitals.find((h) => h.id === hospitalId) || state.hospitals[0];

    const msgBox = document.getElementById('admin-provision-msg');

    if (!isValidContactNumber(phone)) {
      if (msgBox) {
        msgBox.className = 'block text-xs p-3 rounded-xl bg-red-100 text-red-800 border border-red-300';
        msgBox.textContent = 'Invalid contact number. Must be an 11-digit mobile number (e.g. 09185551234).';
      }
      return;
    }

    if (password.length < 6) {
      if (msgBox) {
        msgBox.className = 'block text-xs p-3 rounded-xl bg-red-100 text-red-800 border border-red-300';
        msgBox.textContent = 'Temporary password must be at least 6 characters.';
      }
      return;
    }

    const submitBtn = document.getElementById('prov-staff-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Provisioning...';
    }

    try {
      const res = await adminCreateHealthcareWorkerAccount({
        username: name,
        email,
        password,
        contactNumber: phone,
        role,
        hospital: hospitalObj.name,
        hospitalId: hospitalObj.id,
        licenseNumber: license,
      });

      if (res?.error) {
        if (msgBox) {
          msgBox.className = 'block text-xs p-3 rounded-xl bg-red-100 text-red-800 border border-red-300';
          msgBox.textContent = res.error.message || 'Failed to provision staff account.';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Provision Account';
        }
        return;
      }

      // Add to local state staff roster
      const newStaff = {
        id: `staff-${Date.now()}`,
        username: name,
        email,
        contactNumber: phone,
        role,
        hospital: hospitalObj.name,
        hospitalId: hospitalObj.id,
        licenseNumber: license,
        createdAt: new Date().toISOString(),
        status: 'Active',
      };

      if (!state.staffAccounts) state.staffAccounts = [];
      state.staffAccounts.unshift(newStaff);

      closeAdminProvisionModal();
      document.getElementById('admin-provision-form')?.reset();
      showToast(`Successfully provisioned account for ${name} (${role})!`);

      if (typeof onStaffAdded === 'function') {
        onStaffAdded(newStaff);
      }
    } catch (err) {
      console.error('[Admin Provisioning Error]', err);
      if (msgBox) {
        msgBox.className = 'block text-xs p-3 rounded-xl bg-red-100 text-red-800 border border-red-300';
        msgBox.textContent = 'An unexpected error occurred during account provisioning.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Provision Account';
      }
    }
  });
}
