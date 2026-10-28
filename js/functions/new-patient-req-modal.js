import { state, elements } from './state.js';

export function openNewRequestModal() {
  const hospitalSelect = document.getElementById('new-req-hospital');
  if (hospitalSelect) {
    hospitalSelect.innerHTML = state.hospitals
      .map((h) => `<option value="${h.id}">${h.name} (${h.municipality})</option>`)
      .join('');
  }

  // Configure expiration date restrictions to prevent past selections
  const dateInput = document.getElementById('new-req-expire-date');
  const timeInput = document.getElementById('new-req-expire-time');
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (dateInput) {
    dateInput.min = todayStr;
    // Default to 48 hours in future
    const futureDate = new Date(Date.now() + 48 * 3600 * 1000);
    dateInput.value = futureDate.toISOString().split('T')[0];
  }

  if (timeInput && !timeInput.value) {
    timeInput.value = '17:00';
  }

  elements.newRequestModal?.classList.remove('hidden-view');
}

export function closeNewRequestModal() {
  elements.newRequestModal?.classList.add('hidden-view');
}

