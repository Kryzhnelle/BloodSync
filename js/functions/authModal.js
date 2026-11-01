import { state, elements, normalizeRoleName } from './state.js';
import { navigateTo } from './navigation-tabs.js';
import { updateUserProfileUI } from './user-profile.js';
import { showToast } from './ToastNotif.js';
import { signInUser, signUpUser } from '../supabase.js';
import { isValidContactNumber } from './contact-utils.js';

let currentReasonMessage = null;
let pendingAuthCallback = null;

export function openAuthModal(mode = 'login', reasonMessage = null, onLoginSuccess = null) {
  // Requirement 7: Automatically close the mobile hamburger drawer before opening the Login/Register modal
  const mobileDrawer = document.getElementById('mobile-drawer');
  mobileDrawer?.classList.add('hidden');

  currentReasonMessage = reasonMessage;
  if (typeof onLoginSuccess === 'function') {
    pendingAuthCallback = onLoginSuccess;
  }
  renderAuthModalContent(mode);
  elements.authModal?.classList.remove('hidden-view');
}

export function closeAuthModal() {
  currentReasonMessage = null;
  pendingAuthCallback = null;
  elements.authModal?.classList.add('hidden-view');
}

export function renderAuthModalContent(mode) {
  const container = document.getElementById('auth-modal-content');
  if (!container) return;

  const eyeIconOpen = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeIconSlash = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 2 20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/></svg>`;

  if (mode === 'login') {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="text-center pt-1">
          <h2 class="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white">
            BloodSync
          </h2>
          <p class="text-xs text-rose-200 mt-1">Cavite Safe Blood Network</p>
        </div>

        ${
          currentReasonMessage
            ? `
          <div class="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-400/60 text-amber-100 text-xs flex items-start gap-2.5 shadow-inner">
            <svg class="w-5 h-5 text-amber-300 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div class="flex-1 space-y-0.5">
              <strong class="font-bold block text-white text-xs sm:text-sm">Authentication Required</strong>
              <p class="text-amber-200 text-xs leading-relaxed">${currentReasonMessage}</p>
            </div>
          </div>
        `
            : ''
        }

        <div id="auth-error-box" class="hidden p-2.5 rounded-lg bg-rose-950/80 border border-rose-600 text-rose-200 text-xs text-center font-medium"></div>

        <form id="auth-login-form" class="space-y-3.5">
          <div class="space-y-1">
            <label class="block text-xs sm:text-sm font-semibold text-rose-100">Email:</label>
            <div class="rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <input
                type="email"
                id="login-username"
                required
                placeholder="Enter your email"
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
                ${eyeIconOpen}
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

        <div class="text-center pt-1 space-y-1.5">
          <button
            type="button"
            id="switch-to-register-btn"
            class="text-xs text-rose-200 hover:text-white underline cursor-pointer block mx-auto"
          >
            Don't have an account? Sign up
          </button>
          <button
            type="button"
            id="auth-cancel-btn"
            class="text-xs text-rose-300/70 hover:text-white cursor-pointer block mx-auto pt-1"
          >
            Cancel &amp; Return to Browsing
          </button>
        </div>
      </div>
    `;

    // Toggle Login Password Visibility
    const pwdInput = document.getElementById('login-password');
    const toggleBtn = document.getElementById('toggle-login-pwd-btn');
    toggleBtn?.addEventListener('click', () => {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleBtn.innerHTML = eyeIconSlash;
      } else {
        pwdInput.type = 'password';
        toggleBtn.innerHTML = eyeIconOpen;
      }
    });

    document.getElementById('switch-to-register-btn')?.addEventListener('click', () => {
      renderAuthModalContent('register');
    });

    document.getElementById('auth-cancel-btn')?.addEventListener('click', closeAuthModal);

    document.getElementById('auth-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value;
      const errBox = document.getElementById('auth-error-box');

      if (!email || !email.includes('@')) {
        if (errBox) {
          errBox.textContent = 'Please enter a valid email address.';
          errBox.classList.remove('hidden');
        }
        showToast('Please enter a valid email address.', 'error');
        return;
      }

      try {
        const res = await signInUser({ email, password: p });

        if (res?.error) {
          if (errBox) {
            errBox.textContent = res.error.message || 'Invalid login credentials.';
            errBox.classList.remove('hidden');
          }
          showToast(res.error.message || 'Login failed', 'error');
          return;
        }

        const profile = res?.profile || {};
        const normalizedRole = normalizeRoleName(profile.role || 'Donor');
        const isWebpageAdmin = normalizedRole === 'Webpage Admin';

        state.user = {
          id: res?.data?.user?.id || profile.id || `usr-${Date.now()}`,
          username: profile.username || email.split('@')[0],
          email: res?.data?.user?.email || profile.email || email,
          contactNumber: profile.contactNumber || '',
          isLoggedIn: true,
          role: normalizedRole,
          hospital: isWebpageAdmin ? '' : profile.hospital || '',
          hospitalId: isWebpageAdmin ? '' : profile.hospitalId || '',
          licenseNumber: profile.licenseNumber || '',
          bloodType: profile.bloodType || 'O+',
        };

        try {
          localStorage.setItem('bloodsync_active_session_user', JSON.stringify(state.user));
        } catch (storageErr) {
          console.warn('[Auth Session Storage]', storageErr);
        }

        updateUserProfileUI();
        closeAuthModal();
        showToast(`Welcome back, ${state.user.username}!`);

        // Refresh the page after successful login so authenticated session, profile, navigation, permissions, and user-specific data are cleanly loaded
        window.location.reload();
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

        ${
          currentReasonMessage
            ? `
          <div class="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/60 text-amber-100 text-xs flex items-start gap-2 shadow-inner">
            <svg class="w-4 h-4 text-amber-300 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div class="flex-1">
              <strong class="font-bold block text-white text-xs">Registration Required</strong>
              <p class="text-amber-200 text-xs">${currentReasonMessage}</p>
            </div>
          </div>
        `
            : ''
        }

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
            <label class="block text-xs font-semibold text-rose-100">Choose Blood Type *:</label>
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
            <!-- Registration Password with Eye Toggle -->
            <div class="space-y-1">
              <label class="block text-xs font-semibold text-rose-100">Password:</label>
              <div class="relative rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
                <input
                  type="password"
                  id="reg-password"
                  required
                  placeholder="••••••••"
                  class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm pr-9 focus:outline-none"
                />
                <button
                  type="button"
                  id="toggle-reg-pwd-btn"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-rose-300 hover:text-white p-1 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  ${eyeIconOpen}
                </button>
              </div>
            </div>

            <!-- Confirm Password with Eye Toggle -->
            <div class="space-y-1">
              <label class="block text-xs font-semibold text-rose-100">Confirm Password:</label>
              <div class="relative rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
                <input
                  type="password"
                  id="reg-confirm-password"
                  required
                  placeholder="••••••••"
                  class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm pr-9 focus:outline-none"
                />
                <button
                  type="button"
                  id="toggle-reg-confirm-pwd-btn"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-rose-300 hover:text-white p-1 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  ${eyeIconOpen}
                </button>
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
            <p class="text-[10px] text-rose-300/70">Healthcare accounts are provisioned exclusively by authorized Webpage Admins.</p>
          </div>

          <button
            type="submit"
            id="register-submit-btn"
            class="w-full mt-2 py-3 rounded-full bg-[#180304] hover:bg-black text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-150 shadow-md hover:shadow-lg border border-stone-800 cursor-pointer"
          >
            Register Donor Account
          </button>
        </form>

        <div class="text-center pt-1 space-y-1.5">
          <button
            type="button"
            id="switch-to-login-btn"
            class="text-xs text-rose-200 hover:text-white underline cursor-pointer block mx-auto"
          >
            Already registered? Back to Login
          </button>
          <button
            type="button"
            id="reg-cancel-btn"
            class="text-xs text-rose-300/70 hover:text-white cursor-pointer block mx-auto pt-1"
          >
            Cancel &amp; Return to Browsing
          </button>
        </div>
      </div>
    `;

    // Password visibility toggle handlers for registration
    const regPwdInput = document.getElementById('reg-password');
    const toggleRegPwdBtn = document.getElementById('toggle-reg-pwd-btn');
    toggleRegPwdBtn?.addEventListener('click', () => {
      if (regPwdInput.type === 'password') {
        regPwdInput.type = 'text';
        toggleRegPwdBtn.innerHTML = eyeIconSlash;
      } else {
        regPwdInput.type = 'password';
        toggleRegPwdBtn.innerHTML = eyeIconOpen;
      }
    });

    const regConfirmPwdInput = document.getElementById('reg-confirm-password');
    const toggleRegConfirmPwdBtn = document.getElementById('toggle-reg-confirm-pwd-btn');
    toggleRegConfirmPwdBtn?.addEventListener('click', () => {
      if (regConfirmPwdInput.type === 'password') {
        regConfirmPwdInput.type = 'text';
        toggleRegConfirmPwdBtn.innerHTML = eyeIconSlash;
      } else {
        regConfirmPwdInput.type = 'password';
        toggleRegConfirmPwdBtn.innerHTML = eyeIconOpen;
      }
    });

    document.getElementById('switch-to-login-btn')?.addEventListener('click', () => {
      renderAuthModalContent('login');
    });

    document.getElementById('reg-cancel-btn')?.addEventListener('click', closeAuthModal);

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
          const rawMsg = res.error.message || 'Registration failed.';
          const isDuplicateEmail =
            /user already registered/i.test(rawMsg) ||
            /email already registered/i.test(rawMsg) ||
            /already been registered/i.test(rawMsg);
          const displayMsg = isDuplicateEmail ? 'Email already registered' : rawMsg;

          if (errBox) {
            errBox.textContent = displayMsg;
            errBox.classList.remove('hidden');
          }
          showToast(displayMsg, 'error');
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

        try {
          localStorage.setItem('bloodsync_active_session_user', JSON.stringify(state.user));
        } catch (storageErr) {
          console.warn('[Auth Session Storage]', storageErr);
        }

        updateUserProfileUI();
        closeAuthModal();
        navigateTo('profile');
        showToast(`Account registered successfully with blood type ${bloodType}! Welcome, ${u}!`);

        if (pendingAuthCallback) {
          const cb = pendingAuthCallback;
          pendingAuthCallback = null;
          cb();
        }
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
