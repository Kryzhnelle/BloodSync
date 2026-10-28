import { state, elements } from './state.js';
import { navigateTo } from './navigation-tabs.js';
import { updateUserProfileUI, renderProfileView } from './user-profile.js';
import { showToast } from './ToastNotif.js';
import { signInUser, signUpUser } from '../supabase.js';
import { isValidContactNumber } from './contact-utils.js';

export function openAuthModal(mode = 'login') {
  renderAuthModalContent(mode);
  elements.authModal?.classList.remove('hidden-view');
}

export function closeAuthModal() {
  elements.authModal?.classList.add('hidden-view');
}

export function renderAuthModalContent(mode) {
  const container = document.getElementById('auth-modal-content');
  if (!container) return;

  if (mode === 'login') {
    container.innerHTML = `
      <div class="space-y-5">
        <div class="text-center pt-1">
          <h2 class="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white">
            BloodSync
          </h2>
          <p class="text-xs text-rose-200 mt-1">Cavite Safe Blood Network</p>
        </div>

        <div id="auth-error-box" class="hidden p-2.5 rounded-lg bg-rose-950/80 border border-rose-600 text-rose-200 text-xs text-center font-medium"></div>

        <form id="auth-login-form" class="space-y-3.5">
          <div class="space-y-1">
            <label class="block text-xs sm:text-sm font-semibold text-rose-100">Username or Email:</label>
            <div class="rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <input
                type="text"
                id="login-username"
                required
                placeholder="Enter your username or email"
                class="w-full px-3 py-2.5 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm focus:outline-none"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-xs sm:text-sm font-semibold text-rose-100">Password:</label>
            <div class="relative rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <input
                type="password"
                id="login-password"
                required
                placeholder="••••••••"
                class="w-full px-3 py-2.5 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm pr-10 focus:outline-none"
              />
              <button
                type="button"
                id="toggle-login-pwd-btn"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-rose-300 hover:text-white p-1 cursor-pointer"
                aria-label="Toggle password visibility"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
            <div class="text-right pt-0.5">
              <button
                type="button"
                id="forgot-password-btn"
                class="text-[11px] text-rose-200 hover:text-white underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="login-submit-btn"
            class="w-full py-3 rounded-full bg-[#180304] hover:bg-black text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-150 shadow-md hover:shadow-lg border border-stone-800 cursor-pointer"
          >
            LOGIN
          </button>
        </form>

        <!-- Fast Demo Quick Logins for Instant Testing -->
        <div class="pt-2 border-t border-rose-900/60 space-y-2">
          <p class="text-[11px] uppercase tracking-wider text-rose-300 text-center font-bold">Fast Profile Demo Login</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              id="demo-login-doctor-btn"
              class="px-3 py-2 rounded-xl bg-white text-[#52090E] hover:bg-stone-100 font-extrabold text-xs text-left shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <div class="w-6 h-6 rounded-full bg-[#52090E] text-white flex items-center justify-center font-bold text-[10px] shrink-0">DS</div>
              <div class="truncate">
                <span class="block font-bold leading-tight truncate">Dr. Denice Salamanca</span>
                <span class="text-[9px] text-stone-500 font-semibold block">Healthcare Worker</span>
              </div>
            </button>
            <button
              type="button"
              id="demo-login-donor-btn"
              class="px-3 py-2 rounded-xl bg-[#2a0609] text-rose-100 hover:bg-[#38080c] border border-rose-800/60 font-extrabold text-xs text-left shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <div class="w-6 h-6 rounded-full bg-rose-200 text-rose-950 flex items-center justify-center font-bold text-[10px] shrink-0">JD</div>
              <div class="truncate">
                <span class="block font-bold leading-tight truncate">Juan Dela Cruz</span>
                <span class="text-[9px] text-rose-300 font-semibold block">Blood Donor (O+)</span>
              </div>
            </button>
          </div>
        </div>

        <div class="space-y-3 text-center pt-1">
          <div>
            <button
              type="button"
              id="switch-to-register-btn"
              class="text-xs font-bold text-white hover:text-rose-200 underline cursor-pointer tracking-wide"
            >
              Need an account? Register / Sign Up
            </button>
          </div>
        </div>
      </div>
    `;

    const pwdInput = document.getElementById('login-password');
    document.getElementById('toggle-login-pwd-btn')?.addEventListener('click', () => {
      if (pwdInput) {
        pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
      }
    });

    document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
      showToast('Password reset instructions sent to registered contact info.');
    });

    document.getElementById('demo-login-doctor-btn')?.addEventListener('click', () => {
      state.user = {
        username: 'Dr. Denice Salamanca, MD',
        email: 'denicesalamanca@gmail.com',
        contactNumber: '09123345467',
        isLoggedIn: true,
        role: 'Healthcare Worker',
        hospital: 'Cavite Medical Center',
        hospitalId: 'cavite-medical-center',
        bloodType: 'O+',
      };
      updateUserProfileUI();
      closeAuthModal();
      navigateTo('profile');
      showToast('Logged in as Dr. Denice Salamanca, MD (Healthcare Worker)!');
    });

    document.getElementById('demo-login-donor-btn')?.addEventListener('click', () => {
      state.user = {
        username: 'Juan Dela Cruz',
        email: 'juandelacruz@gmail.com',
        contactNumber: '0917-555-1234',
        isLoggedIn: true,
        role: 'Donor',
        bloodType: 'O+',
      };
      updateUserProfileUI();
      closeAuthModal();
      navigateTo('profile');
      showToast('Logged in as Juan Dela Cruz (Blood Donor)!');
    });

    document.getElementById('switch-to-register-btn')?.addEventListener('click', () => {
      renderAuthModalContent('register');
    });

    document.getElementById('auth-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value.trim();
      const errBox = document.getElementById('auth-error-box');

      const isEmail = u.includes('@');
      const email = isEmail ? u : `${u.toLowerCase().replace(/[^a-z0-9]/g, '')}@bloodsync.ph`;

      try {
        const res = await signInUser({ email, password: p });
        if (res?.error) {
          if (errBox) {
            errBox.textContent = res.error.message || 'Invalid login credentials.';
            errBox.classList.remove('hidden');
          }
          showToast(res.error.message || 'Login failed.', 'error');
          return;
        }

        const profile = res?.profile || {};
        state.user = {
          id: profile.id || res?.data?.user?.id || `usr-${Date.now()}`,
          username: profile.username || u,
          email: profile.email || email,
          contactNumber: profile.contactNumber || '09123456789',
          isLoggedIn: true,
          role: profile.role || (u.toLowerCase().includes('dr') || u.toLowerCase().includes('doctor') ? 'Healthcare Worker' : 'Donor'),
          hospital: profile.hospital || '',
          hospitalId: profile.hospitalId || '',
          bloodType: profile.bloodType || 'O+',
        };

        updateUserProfileUI();
        closeAuthModal();
        showToast(`Welcome back, ${state.user.username}!`);
        if (state.activeTab === 'profile') {
          renderProfileView();
        }
      } catch (err) {
        console.warn('[Auth Login]', err);
        if (errBox) {
          errBox.textContent = 'An unexpected error occurred during login.';
          errBox.classList.remove('hidden');
        }
      }
    });
  } else if (mode === 'register') {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="text-center pt-1">
          <h2 class="font-display text-3xl sm:text-4xl font-bold tracking-wider uppercase text-white">
            REGISTER
          </h2>
          <p class="text-xs text-rose-200 mt-0.5">Join the Cavite BloodSync Network</p>
        </div>

        <div id="register-error-box" class="hidden p-2.5 rounded-lg bg-rose-950/80 border border-rose-600 text-rose-200 text-xs text-center font-medium"></div>

        <form id="auth-register-form" class="space-y-3">
          <div class="space-y-1">
            <label class="block text-xs font-semibold text-rose-100">Full Name / Username:</label>
            <div class="rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <input
                type="text"
                id="reg-username"
                required
                placeholder="e.g. Juan Dela Cruz"
                class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm focus:outline-none"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-rose-100">Choose Blood Type:</label>
            <div class="relative rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <select
                id="reg-blood-type"
                required
                class="w-full px-3 py-2 bg-[#40070B] text-white text-xs sm:text-sm focus:outline-none cursor-pointer pr-8"
              >
                <option value="" disabled selected>-- Choose Blood Type --</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="block text-xs font-semibold text-rose-100">Password:</label>
              <div class="relative rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
                <input
                  type="password"
                  id="reg-password"
                  required
                  placeholder="••••••••"
                  class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm focus:outline-none"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="block text-xs font-semibold text-rose-100">Confirm Password:</label>
              <div class="relative rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
                <input
                  type="password"
                  id="reg-confirm-password"
                  required
                  placeholder="••••••••"
                  class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-rose-100">Email Address:</label>
            <div class="rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <input
                type="email"
                id="reg-email"
                required
                placeholder="example@gmail.com"
                class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm focus:outline-none"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-rose-100">Contact Number (11 digits):</label>
            <div class="rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <input
                type="tel"
                id="reg-phone"
                required
                maxlength="14"
                placeholder="09123345467"
                class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm focus:outline-none font-mono"
              />
            </div>
            <p class="text-[10px] text-rose-300/70">Healthcare accounts are provisioned exclusively by authorized hospital administrators.</p>
          </div>

          <button
            type="submit"
            id="register-submit-btn"
            class="w-full mt-2 py-3 rounded-full bg-[#180304] hover:bg-black text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-150 shadow-md hover:shadow-lg border border-stone-800 cursor-pointer"
          >
            Register Donor Account
          </button>
        </form>

        <div class="text-center pt-1">
          <button
            type="button"
            id="switch-to-login-btn"
            class="text-xs text-rose-200 hover:text-white underline cursor-pointer"
          >
            Already registered? Back to Login
          </button>
        </div>
      </div>
    `;

    document.getElementById('switch-to-login-btn')?.addEventListener('click', () => {
      renderAuthModalContent('login');
    });

    document.getElementById('auth-register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('reg-username').value.trim();
      const p = document.getElementById('reg-password').value;
      const cp = document.getElementById('reg-confirm-password').value;
      const em = document.getElementById('reg-email').value.trim();
      const ph = document.getElementById('reg-phone').value.trim();
      const bloodType = document.getElementById('reg-blood-type')?.value;
      const r = 'Donor'; // Public registrations strictly default to Donor role
      const hosp = '';

      const errBox = document.getElementById('register-error-box');

      if (!bloodType) {
        if (errBox) {
          errBox.textContent = 'Please choose your blood type (A+, A-, B+, B-, AB+, AB-, O+, or O-).';
          errBox.classList.remove('hidden');
        }
        showToast('Please select your blood type.', 'error');
        document.getElementById('reg-blood-type')?.focus();
        return;
      }

      if (p !== cp) {
        if (errBox) {
          errBox.textContent = 'Passwords do not match.';
          errBox.classList.remove('hidden');
        }
        return;
      }

      if (p.length < 6) {
        if (errBox) {
          errBox.textContent = 'Password must be at least 6 characters.';
          errBox.classList.remove('hidden');
        }
        return;
      }

      if (!isValidContactNumber(ph)) {
        if (errBox) {
          errBox.textContent = 'Contact number must be a valid 11-digit number (e.g., 09123456789).';
          errBox.classList.remove('hidden');
        }
        showToast('Please enter a valid 11-digit contact number.', 'error');
        document.getElementById('reg-phone')?.focus();
        return;
      }

      try {
        const res = await signUpUser({ email: em, password: p, username: u, contactNumber: ph, bloodType, role: r, hospital: hosp });
        if (res?.error) {
          if (errBox) {
            errBox.textContent = res.error.message || 'Registration failed.';
            errBox.classList.remove('hidden');
          }
          showToast(res.error.message || 'Registration failed.', 'error');
          return;
        }

        const registeredUserId = res?.data?.user?.id || res?.profile?.id || `usr-${Date.now()}`;
        state.user = {
          id: registeredUserId,
          username: u,
          email: em,
          contactNumber: ph,
          isLoggedIn: true,
          role: r,
          hospital: hosp,
          bloodType,
        };

        updateUserProfileUI();
        closeAuthModal();
        navigateTo('profile');
        showToast(`Account registered successfully with blood type ${bloodType}! Welcome, ${u}!`);
      } catch (err) {
        console.warn('[Register Error]', err);
        if (errBox) {
          errBox.textContent = 'An unexpected error occurred during registration.';
          errBox.classList.remove('hidden');
        }
      }
    });
  }
}
