import { state, elements } from './state.js';
import { navigateTo } from './navigation-tabs.js';

export function openScreeningModal() {
  renderScreeningModalContent('form');
  elements.screeningModal?.classList.remove('hidden-view');
}

export function closeScreeningModal() {
  elements.screeningModal?.classList.add('hidden-view');
}

export function renderScreeningModalContent(step, resultData = null) {
  const container = document.getElementById('donor-screening-content');
  if (!container) return;

  if (step === 'form') {
    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 flex items-center justify-center">
            <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </div>
          <div>
            <h3 class="text-xl sm:text-2xl font-bold tracking-tight">
              Automated Donor Screening
            </h3>
            <p class="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
              Philippine DOH Standards (Age, Weight, and 8-Week Interval)
            </p>
          </div>
        </div>

        <form id="screening-form" class="space-y-4 text-xs sm:text-sm">
          <div>
            <label class="block font-semibold mb-1">Full Legal Name</label>
            <input
              type="text"
              id="sc-name"
              required
              placeholder="Juan Dela Cruz"
              class="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block font-semibold mb-1">Age (Years)</label>
              <input
                type="number"
                id="sc-age"
                min="15"
                max="80"
                value="24"
                required
                class="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
              />
              <span class="text-[10px] text-stone-500">Min 16 (16-17 w/ consent)</span>
            </div>

            <div>
              <label class="block font-semibold mb-1">Weight (kg)</label>
              <input
                type="number"
                id="sc-weight"
                min="30"
                max="200"
                value="55"
                required
                class="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
              />
              <span class="text-[10px] text-stone-500">Min 50 kg (110 lbs)</span>
            </div>

            <div>
              <label class="block font-semibold mb-1">Known Blood Type</label>
              <select
                id="sc-blood-type"
                class="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-bold text-rose-700 dark:text-rose-400"
              >
                <option value="O+" selected>O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
              <span class="text-[10px] text-stone-500">Or will be tested on-site</span>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block font-semibold mb-1">
                Have you donated blood before?
              </label>

              <select
                id="sc-first-time"
                required
                class="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
              >
                <option value="yes" selected>No, this is my first time</option>
                <option value="no">Yes, I have donated before</option>
              </select>
            </div>

            <div id="sc-last-donation-group" class="hidden">
              <label class="block font-semibold mb-1">
                Weeks Since Last Blood Donation
              </label>

              <input
                type="number"
                id="sc-weeks"
                min="0"
                max="52"
                value="12"
                required
                class="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
              />

              <span class="text-[10px] text-stone-500">
                At least 8 weeks (56 days) between whole blood donations,
                subject to applicable donation guidelines.
              </span>
            </div>
          </div>

          <div class="p-3.5 rounded-xl bg-stone-100 dark:bg-stone-800/60 space-y-2.5 border border-stone-200 dark:border-stone-700/60">
            <p class="font-bold text-xs uppercase text-stone-500 dark:text-stone-400 tracking-wider">
              Health & Lifestyle Checklist
            </p>

            <label class="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                id="sc-healthy"
                checked
                class="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
              />
              <span>I feel healthy and well today with at least 6 hours of sleep.</span>
            </label>

            <label class="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                id="sc-tattoo"
                class="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
              />
              <span>I have gotten a tattoo or body piercing within the past 12 months.</span>
            </label>

            <label class="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                id="sc-alcohol"
                class="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
              />
              <span>I have consumed alcohol within the last 24 hours.</span>
            </label>
          </div>

          <button
            type="submit"
            id="submit-screening-btn"
            class="w-full py-3.5 rounded-xl bg-[#52090E] hover:bg-[#3B070B] text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Calculate Eligibility</span>
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        </form>
      </div>
    `;

    const firstTimeSelect = document.getElementById('sc-first-time');
    const lastDonationGroup = document.getElementById('sc-last-donation-group');
    const weeksInput = document.getElementById('sc-weeks');

    function updateDonationHistoryField() {
      const isFirstTime = firstTimeSelect.value === 'yes';
      lastDonationGroup.classList.toggle('hidden', isFirstTime);
      weeksInput.required = !isFirstTime;
      weeksInput.disabled = isFirstTime;
    }

    firstTimeSelect.addEventListener('change', updateDonationHistoryField);
    updateDonationHistoryField();

    document.getElementById('screening-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('sc-name').value;
      const age = Number(document.getElementById('sc-age').value);
      const weight = Number(document.getElementById('sc-weight').value);
      const bloodType = document.getElementById('sc-blood-type').value;
      const firstTime = document.getElementById('sc-first-time').value === 'yes';
      const weeks = firstTime
        ? null
        : Number(document.getElementById('sc-weeks').value);
      const healthy = document.getElementById('sc-healthy').checked;
      const tattoo = document.getElementById('sc-tattoo').checked;
      const alcohol = document.getElementById('sc-alcohol').checked;

      const isAgeValid = age >= 16 && age <= 65;
      const isWeightValid = weight >= 50;
      const isIntervalValid = firstTime || weeks >= 8;
      const isHealthValid = healthy && !tattoo && !alcohol;
      const isEligible = isAgeValid && isWeightValid && isIntervalValid && isHealthValid;

      renderScreeningModalContent('result', {
        name,
        age,
        weight,
        bloodType,
        weeks,
        firstTime,
        isAgeValid,
        isWeightValid,
        isIntervalValid,
        tattoo,
        alcohol,
        healthy,
        isEligible,
      });
    });
  } else if (step === 'result' && resultData) {
    if (resultData.isEligible) {
      container.innerHTML = `
        <div class="space-y-6 text-center py-2">
          <div class="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow">
            <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          </div>
          <h3 class="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300">
            Congratulations, You Are Eligible!
          </h3>
          <p class="text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto">
            Based on Philippine DOH criteria, ${resultData.name || 'Donor'}, you satisfy all physical and donation interval requirements for blood donation.
          </p>

          <div class="p-4 rounded-2xl bg-stone-100 dark:bg-stone-800 text-left text-xs space-y-1.5 border border-stone-200 dark:border-stone-700">
            <div class="flex justify-between">
              <span class="text-stone-500">Age:</span>
              <span class="font-bold text-emerald-600">${resultData.age} yrs (Qualified)</span>
            </div>
            <div class="flex justify-between">
              <span class="text-stone-500">Weight:</span>
              <span class="font-bold text-emerald-600">${resultData.weight} kg (Qualified)</span>
            </div>
            <div class="flex justify-between">
              <span class="text-stone-500">Donation History:</span>
              <span class="font-bold text-emerald-600">
                ${resultData.firstTime
                  ? 'First-time donor'
                  : `${resultData.weeks} weeks (Interval met)`}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-stone-500">Blood Type:</span>
              <span class="font-bold text-rose-600">${resultData.bloodType}</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-stone-200 dark:border-stone-700">
              <span class="text-stone-500">Fast-Track Pass ID:</span>
              <span class="font-mono font-bold">BS-D1-${Math.floor(Math.random() * 90000 + 10000)}</span>
            </div>
          </div>

          <div class="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              id="screening-proceed-hospitals-btn"
              class="flex-1 py-3 px-6 rounded-xl bg-[#52090E] hover:bg-[#38060A] text-white font-extrabold text-sm shadow-md transition-all cursor-pointer"
            >
              Select Hospital to Donate
            </button>
            <button
              id="screening-recalculate-btn"
              class="py-3 px-4 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold cursor-pointer"
            >
              Recalculate
            </button>
          </div>
        </div>
      `;

      document.getElementById('screening-proceed-hospitals-btn')?.addEventListener('click', () => {
        closeScreeningModal();
        navigateTo('hospitals');
      });

      document.getElementById('screening-recalculate-btn')?.addEventListener('click', () => {
        renderScreeningModalContent('form');
      });
    } else {
      // Ineligible
      container.innerHTML = `
        <div class="space-y-6 text-center py-2">
          <div class="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow">
            <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3 class="text-2xl font-extrabold text-amber-800 dark:text-amber-300">
            Temporary Deferral Notice
          </h3>
          <p class="text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto">
            Thank you for your generous heart, ${resultData.name || 'Donor'}. However, one or more Philippine DOH health safety requirements are not met today:
          </p>

          <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-left text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
            ${!resultData.isAgeValid ? '<div>• Age must be between 16 and 65 years.</div>' : ''}
            ${!resultData.isWeightValid ? '<div>• Minimum weight must be at least 50 kg (110 lbs).</div>' : ''}
            ${!resultData.firstTime && !resultData.isIntervalValid
              ? `<div>• At least 8 weeks (56 days) required since your last donation (${resultData.weeks} weeks recorded).</div>`
              : ''}
            ${resultData.tattoo ? '<div>• Tattoos or piercings require a 12-month deferral interval.</div>' : ''}
            ${resultData.alcohol ? '<div>• Please wait 24 hours after alcohol consumption before giving blood.</div>' : ''}
            ${!resultData.healthy ? '<div>• Donors must feel well and symptom-free on donation day.</div>' : ''}
          </div>

          <div class="pt-2">
            <button
              id="screening-adjust-btn"
              class="py-3 px-6 rounded-xl bg-[#52090E] hover:bg-[#38060A] text-white font-bold text-sm shadow cursor-pointer"
            >
              Adjust Information
            </button>
          </div>
        </div>
      `;

      document.getElementById('screening-adjust-btn')?.addEventListener('click', () => {
        renderScreeningModalContent('form');
      });
    }
  }
}
