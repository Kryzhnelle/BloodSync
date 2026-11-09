import { state, elements, normalizeRoleName } from './state.js';
import { navigateTo } from './navigation-tabs.js';
import { updateUserProfileUI } from './user-profile.js';
import { showToast } from './ToastNotif.js';
import {
  signInUser,
  signUpUser,
  checkEmailAlreadyRegisteredInDB,
  requestRegistrationOtpInDB,
  verifyRegistrationOtpInDB,
  isEmailVerifiedForRegistration,
  clearRegistrationVerificationSession,
  supabase,
  isSupabaseConfigured,
  formatSupabaseError,
} from '../supabase.js';
import {
  isValidContactNumber,
  attachPhoneInputFormatter,
  normalizePhoneNumber,
  formatContactDisplay,
  getPasswordRequirementsStatus,
  validateStrongPassword,
} from './contact-utils.js';

let currentReasonMessage = null;
let pendingAuthCallback = null;

// Preserves registration form state across Form -> Email OTP Verification -> Account Confirmation -> Edit Details
let pendingRegistrationDraft = {
  username: '',
  bloodType: '',
  password: '',
  confirmPassword: '',
  email: '',
  rawPhone: '',
  normalizedPhone: '',
  notifyBloodTypeMatch: false,
};

let otpCooldownInterval = null;
let isConfirmingRegistration = false;

function clearOtpCooldownTimer() {
  if (otpCooldownInterval) {
    clearInterval(otpCooldownInterval);
    otpCooldownInterval = null;
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates the real-time password requirements checklist HTML.
 */
export function renderPasswordRequirementsChecklistHTML(prefix = 'reg-pwd') {
  return `
    <div id="${prefix}-checklist" class="p-2.5 rounded-xl bg-black/30 border border-rose-900/50 space-y-1 text-[11px]">
      <p class="font-bold text-rose-200 uppercase tracking-wider text-[10px] mb-1">Password Requirements:</p>
      <div data-req="minLength" class="flex items-center gap-1.5 text-rose-300/75 transition-colors">
        <span class="req-icon font-mono text-xs">○</span>
        <span>At least 8 characters</span>
      </div>
      <div data-req="hasUppercase" class="flex items-center gap-1.5 text-rose-300/75 transition-colors">
        <span class="req-icon font-mono text-xs">○</span>
        <span>At least one uppercase letter (A–Z)</span>
      </div>
      <div data-req="hasLowercase" class="flex items-center gap-1.5 text-rose-300/75 transition-colors">
        <span class="req-icon font-mono text-xs">○</span>
        <span>At least one lowercase letter (a–z)</span>
      </div>
      <div data-req="hasNumber" class="flex items-center gap-1.5 text-rose-300/75 transition-colors">
        <span class="req-icon font-mono text-xs">○</span>
        <span>At least one number (0–9)</span>
      </div>
      <div data-req="hasSpecial" class="flex items-center gap-1.5 text-rose-300/75 transition-colors">
        <span class="req-icon font-mono text-xs">○</span>
        <span>At least one special character (!, @, #, $, %...)</span>
      </div>
    </div>
  `;
}

/**
 * Updates the real-time visual state of the password requirements checklist as the user types.
 */
export function updatePasswordChecklistUI(passwordValue, prefix = 'reg-pwd') {
  const checklistEl = document.getElementById(`${prefix}-checklist`);
  if (!checklistEl) return;
  const status = getPasswordRequirementsStatus(passwordValue);

  const keys = ['minLength', 'hasUppercase', 'hasLowercase', 'hasNumber', 'hasSpecial'];
  keys.forEach((key) => {
    const row = checklistEl.querySelector(`[data-req="${key}"]`);
    if (!row) return;
    const icon = row.querySelector('.req-icon');
    if (status[key]) {
      row.classList.remove('text-rose-300/75');
      row.classList.add('text-emerald-300', 'font-semibold');
      if (icon) icon.textContent = '✓';
    } else {
      row.classList.add('text-rose-300/75');
      row.classList.remove('text-emerald-300', 'font-semibold');
      if (icon) icon.textContent = '○';
    }
  });
}

export function openAuthModal(mode = 'login', reasonMessage = null, onLoginSuccess = null) {
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
  clearOtpCooldownTimer();
  currentReasonMessage = null;
  pendingAuthCallback = null;
  isConfirmingRegistration = false;
  // If user cancels before completing registration, clear temporary unconfirmed OTP session
  if (!state.user?.isLoggedIn) {
    clearRegistrationVerificationSession(true);
  }
  elements.authModal?.classList.add('hidden-view');
}

export function renderAuthModalContent(mode) {
  clearOtpCooldownTimer();
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
              <p class="text-amber-200 text-xs leading-relaxed">${escapeHtml(currentReasonMessage)}</p>
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
                class="btn-no-3d absolute right-2 top-1/2 -translate-y-1/2 text-rose-300 hover:text-white p-1 cursor-pointer"
                aria-label="Toggle password visibility"
              >
                ${eyeIconOpen}
              </button>
            </div>
            <div class="text-right pt-0.5">
              <button
                type="button"
                id="forgot-password-btn"
                class="btn-no-3d text-[11px] text-rose-200 hover:text-white underline cursor-pointer"
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
            class="btn-no-3d text-xs text-rose-200 hover:text-white underline cursor-pointer block mx-auto"
          >
            Don't have an account? Sign up
          </button>
          <button
            type="button"
            id="auth-cancel-btn"
            class="btn-no-3d text-xs text-rose-300/70 hover:text-white cursor-pointer block mx-auto pt-1"
          >
            Cancel &amp; Return to Browsing
          </button>
        </div>
      </div>
    `;

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

    document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
      renderAuthModalContent('forgot-password');
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
      const submitBtn = document.getElementById('login-submit-btn');

      errBox?.classList.add('hidden');

      if (!email || !email.includes('@')) {
        if (errBox) {
          errBox.textContent = 'Invalid email address';
          errBox.classList.remove('hidden');
        }
        showToast('Invalid email address', 'error');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'SIGNING IN...';
      }

      try {
        const res = await signInUser({ email, password: p });

        if (res?.error || !res?.data?.user) {
          const msg = res?.error?.message || 'Invalid login credentials.';
          if (errBox) {
            errBox.textContent = msg;
            errBox.classList.remove('hidden');
          }
          showToast(msg, 'error');
          return;
        }

        const profile = res?.profile || {};
        const normalizedRole = normalizeRoleName(profile.role || 'Donor');
        const isWebpageAdmin = normalizedRole === 'Webpage Admin';

        state.user = {
          id: res.data.user.id,
          username: profile.username || email.split('@')[0],
          email: res.data.user.email || profile.email || email,
          contactNumber: profile.contactNumber || '',
          isLoggedIn: true,
          role: normalizedRole,
          hospital: isWebpageAdmin ? '' : profile.hospital || '',
          hospitalId: isWebpageAdmin ? '' : profile.hospitalId || '',
          licenseNumber: profile.licenseNumber || '',
          bloodType: profile.bloodType || 'O+',
          notifyBloodTypeMatch: Boolean(profile.notifyBloodTypeMatch),
        };

        try {
          localStorage.setItem('bloodsync_active_session_user', JSON.stringify(state.user));
        } catch (storageErr) {
          console.warn('[Auth Session Storage]', storageErr);
        }

        updateUserProfileUI();
        closeAuthModal();
        showToast(`Welcome back, ${state.user.username}!`);

        // Refresh the page only after successful Supabase authentication
        window.location.reload();
      } catch (err) {
        console.warn('[Auth Login]', err);
        const msg = formatSupabaseError(err, 'An unexpected error occurred during login.');
        if (errBox) {
          errBox.textContent = msg;
          errBox.classList.remove('hidden');
        }
        showToast(msg, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'LOGIN';
        }
      }
    });
  } else if (mode === 'forgot-password') {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="text-center pt-1">
          <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-wider uppercase text-white">
            Reset Password
          </h2>
          <p class="text-xs text-rose-200 mt-1">Verify your email with a Supabase OTP to set a new password</p>
        </div>

        <div id="reset-pwd-msg-box" class="hidden p-2.5 rounded-lg text-xs text-center font-medium"></div>

        <div class="space-y-3">
          <div class="space-y-1">
            <label class="block text-xs font-semibold text-rose-100">Registered Email Address:</label>
            <div class="flex gap-2">
              <div class="flex-1 rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
                <input
                  type="email"
                  id="reset-email-input"
                  required
                  placeholder="example@gmail.com"
                  class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm focus:outline-none"
                />
              </div>
              <button
                type="button"
                id="send-reset-otp-btn"
                class="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs whitespace-nowrap cursor-pointer"
              >
                Send OTP
              </button>
            </div>
          </div>

          <form id="reset-password-form" class="space-y-3">
            <div class="space-y-1">
              <label class="block text-xs font-semibold text-rose-100">OTP Verification Code:</label>
              <div class="rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
                <input
                  type="text"
                  id="reset-otp-input"
                  required
                  maxlength="8"
                  placeholder="Enter OTP from email"
                  class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm font-mono tracking-widest focus:outline-none"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="block text-xs font-semibold text-rose-100">New Password:</label>
              <div class="relative rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
                <input
                  type="password"
                  id="reset-new-password"
                  required
                  placeholder="••••••••"
                  class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm pr-9 focus:outline-none"
                />
                <button
                  type="button"
                  id="toggle-reset-pwd-btn"
                  class="btn-no-3d absolute right-2 top-1/2 -translate-y-1/2 text-rose-300 hover:text-white p-1 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  ${eyeIconOpen}
                </button>
              </div>
            </div>

            ${renderPasswordRequirementsChecklistHTML('reset-pwd')}

            <button
              type="submit"
              id="submit-reset-pwd-btn"
              class="w-full py-3 rounded-full bg-[#180304] hover:bg-black text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
            >
              Verify OTP &amp; Update Password
            </button>
          </form>

          <div class="text-center pt-1">
            <button
              type="button"
              id="back-to-login-from-reset-btn"
              class="btn-no-3d text-xs text-rose-200 hover:text-white underline cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    `;

    const resetPwdInput = document.getElementById('reset-new-password');
    const toggleResetBtn = document.getElementById('toggle-reset-pwd-btn');
    toggleResetBtn?.addEventListener('click', () => {
      if (resetPwdInput.type === 'password') {
        resetPwdInput.type = 'text';
        toggleResetBtn.innerHTML = eyeIconSlash;
      } else {
        resetPwdInput.type = 'password';
        toggleResetBtn.innerHTML = eyeIconOpen;
      }
    });

    resetPwdInput?.addEventListener('input', () => {
      updatePasswordChecklistUI(resetPwdInput.value, 'reset-pwd');
    });

    document.getElementById('back-to-login-from-reset-btn')?.addEventListener('click', () => {
      renderAuthModalContent('login');
    });

    const msgBox = document.getElementById('reset-pwd-msg-box');
    const showResetMsg = (text, isSuccess = false) => {
      if (!msgBox) return;
      msgBox.textContent = text;
      msgBox.className = isSuccess
        ? 'p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-600 text-emerald-200 text-xs text-center font-medium'
        : 'p-2.5 rounded-lg bg-rose-950/80 border border-rose-600 text-rose-200 text-xs text-center font-medium';
    };

    document.getElementById('send-reset-otp-btn')?.addEventListener('click', async () => {
      const email = document.getElementById('reset-email-input')?.value.trim();
      if (!email || !email.includes('@')) {
        showResetMsg('Please enter a valid email address.', false);
        return;
      }
      if (!isSupabaseConfigured()) {
        showResetMsg('Supabase Auth is not configured.', false);
        return;
      }
      const btn = document.getElementById('send-reset-otp-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending...';
      }
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) {
          showResetMsg(formatSupabaseError(error, 'Failed to send password reset OTP.'), false);
          return;
        }
        showResetMsg(`Password recovery code sent to ${email}. Please check your inbox.`, true);
      } catch (err) {
        showResetMsg(formatSupabaseError(err, 'Failed to send reset OTP.'), false);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Resend OTP';
        }
      }
    });

    document.getElementById('reset-password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('reset-email-input')?.value.trim();
      const otp = document.getElementById('reset-otp-input')?.value.trim();
      const newPassword = document.getElementById('reset-new-password')?.value || '';

      const pwdCheck = validateStrongPassword(newPassword);
      if (!pwdCheck.isValid) {
        showResetMsg(pwdCheck.message, false);
        showToast('Password does not meet requirements', 'error');
        return;
      }

      if (!isSupabaseConfigured()) {
        showResetMsg('Supabase Auth is not configured.', false);
        return;
      }

      const submitBtn = document.getElementById('submit-reset-pwd-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
      }

      try {
        let { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: 'recovery',
        });
        if (error) {
          const fallbackEmailOtp = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email',
          });
          if (!fallbackEmailOtp.error && fallbackEmailOtp.data?.user) {
            data = fallbackEmailOtp.data;
            error = null;
          }
        }
        if (error || !data?.user) {
          showResetMsg(formatSupabaseError(error, 'Incorrect or expired OTP code.'), false);
          return;
        }

        const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
        if (updateErr) {
          showResetMsg(formatSupabaseError(updateErr, 'Failed to update password.'), false);
          return;
        }

        showToast('Password updated successfully! Please sign in with your new password.');
        renderAuthModalContent('login');
      } catch (err) {
        showResetMsg(formatSupabaseError(err, 'Failed to reset password.'), false);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Verify OTP & Update Password';
        }
      }
    });
  } else if (mode === 'register') {
    const selectedBt = pendingRegistrationDraft.bloodType || '';
    const notifyLabelBt = selectedBt || 'your selected blood type';
    const isVerifiedForDraftEmail =
      pendingRegistrationDraft.email && isEmailVerifiedForRegistration(pendingRegistrationDraft.email);

    container.innerHTML = `
      <div class="space-y-3.5">
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
              <p class="text-amber-200 text-xs">${escapeHtml(currentReasonMessage)}</p>
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
                value="${escapeHtml(pendingRegistrationDraft.username)}"
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
                <option value="" disabled ${!selectedBt ? 'selected' : ''}>-- Choose Blood Type --</option>
                ${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
                  .map(
                    (bt) =>
                      `<option value="${bt}" ${selectedBt === bt ? 'selected' : ''}>${bt}</option>`
                  )
                  .join('')}
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
                  value="${escapeHtml(pendingRegistrationDraft.password)}"
                  placeholder="••••••••"
                  class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm pr-9 focus:outline-none"
                />
                <button
                  type="button"
                  id="toggle-reg-pwd-btn"
                  class="btn-no-3d absolute right-2 top-1/2 -translate-y-1/2 text-rose-300 hover:text-white p-1 cursor-pointer"
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
                  value="${escapeHtml(pendingRegistrationDraft.confirmPassword)}"
                  placeholder="••••••••"
                  class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm pr-9 focus:outline-none"
                />
                <button
                  type="button"
                  id="toggle-reg-confirm-pwd-btn"
                  class="btn-no-3d absolute right-2 top-1/2 -translate-y-1/2 text-rose-300 hover:text-white p-1 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  ${eyeIconOpen}
                </button>
              </div>
            </div>
          </div>

          <!-- Real-Time Stronger Password Requirements Feedback -->
          ${renderPasswordRequirementsChecklistHTML('reg-pwd')}

          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-semibold text-rose-100">Email Address:</label>
              ${
                isVerifiedForDraftEmail
                  ? `<span id="reg-email-verified-badge" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/60">✓ Email Verified</span>`
                  : `<span id="reg-email-verified-badge" class="hidden text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/60">✓ Email Verified</span>`
              }
            </div>
            <div class="rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <input
                type="email"
                id="reg-email"
                required
                value="${escapeHtml(pendingRegistrationDraft.email)}"
                placeholder="example@gmail.com"
                class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm focus:outline-none"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-rose-100">Contact Number (XXXX-XXX-XXXX):</label>
            <div class="rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <input
                type="tel"
                id="reg-phone"
                required
                maxlength="13"
                value="${escapeHtml(pendingRegistrationDraft.rawPhone)}"
                placeholder="0912-345-6789"
                class="w-full px-3 py-2 bg-transparent text-white placeholder-rose-300/40 text-xs sm:text-sm focus:outline-none font-mono"
              />
            </div>
            <p class="text-[10px] text-rose-300/70">Format: 0912-345-6789. Healthcare accounts are provisioned exclusively by authorized Webpage Admins.</p>
          </div>

          <!-- Blood Type Email Notification Opt-In Checkbox -->
          <div class="p-3 rounded-xl bg-black/30 border border-rose-900/60 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="reg-notify-blood-type"
              ${pendingRegistrationDraft.notifyBloodTypeMatch ? 'checked' : ''}
              class="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-rose-700 bg-[#40070B] cursor-pointer shrink-0"
            />
            <label for="reg-notify-blood-type" id="reg-notify-blood-type-label" class="text-xs text-rose-100 leading-snug cursor-pointer select-none">
              Receive email notification when the same blood type as <strong class="text-white underline">${escapeHtml(notifyLabelBt)}</strong> is requested.
            </label>
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
            class="btn-no-3d text-xs text-rose-200 hover:text-white underline cursor-pointer block mx-auto"
          >
            Already registered? Back to Login
          </button>
          <button
            type="button"
            id="reg-cancel-btn"
            class="btn-no-3d text-xs text-rose-300/70 hover:text-white cursor-pointer block mx-auto pt-1"
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

    // Initialize and bind real-time password checklist
    if (regPwdInput) {
      updatePasswordChecklistUI(regPwdInput.value, 'reg-pwd');
      regPwdInput.addEventListener('input', () => {
        updatePasswordChecklistUI(regPwdInput.value, 'reg-pwd');
      });
    }

    // Dynamically update Blood Type in notification checkbox label
    const regBloodTypeSelect = document.getElementById('reg-blood-type');
    const regNotifyLabel = document.getElementById('reg-notify-blood-type-label');
    regBloodTypeSelect?.addEventListener('change', () => {
      const bt = regBloodTypeSelect.value || 'your selected blood type';
      if (regNotifyLabel) {
        regNotifyLabel.innerHTML = `Receive email notification when the same blood type as <strong class="text-white underline">${escapeHtml(bt)}</strong> is requested.`;
      }
    });

    // Update email verified badge dynamically if user edits email
    const regEmailInput = document.getElementById('reg-email');
    const verifiedBadge = document.getElementById('reg-email-verified-badge');
    regEmailInput?.addEventListener('input', () => {
      const currentEm = regEmailInput.value.trim().toLowerCase();
      if (verifiedBadge) {
        if (isEmailVerifiedForRegistration(currentEm)) {
          verifiedBadge.classList.remove('hidden');
        } else {
          verifiedBadge.classList.add('hidden');
        }
      }
    });

    // Attach phone input formatter for real-time XXXX-XXX-XXXX format
    const regPhoneInput = document.getElementById('reg-phone');
    if (regPhoneInput) {
      attachPhoneInputFormatter(regPhoneInput);
    }

    document.getElementById('switch-to-login-btn')?.addEventListener('click', () => {
      renderAuthModalContent('login');
    });

    document.getElementById('reg-cancel-btn')?.addEventListener('click', closeAuthModal);

    // Step 1 -> Step 2: Clicking "Register Donor Account" validates fields and opens Email Verification Modal (or Confirmation Modal if email already verified)
    document.getElementById('auth-register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('reg-username').value.trim();
      const p = document.getElementById('reg-password').value;
      const cp = document.getElementById('reg-confirm-password').value;
      const em = document.getElementById('reg-email').value.trim().toLowerCase();
      const rawPh = document.getElementById('reg-phone').value.trim();
      const ph = normalizePhoneNumber(rawPh);
      const bloodType = document.getElementById('reg-blood-type')?.value;
      const notifyBloodTypeMatch = Boolean(document.getElementById('reg-notify-blood-type')?.checked);

      const errBox = document.getElementById('register-error-box');
      errBox?.classList.add('hidden');

      if (!u) {
        if (errBox) {
          errBox.textContent = 'Please enter your full name or username.';
          errBox.classList.remove('hidden');
        }
        return;
      }

      if (!bloodType) {
        if (errBox) {
          errBox.textContent = 'Please choose your blood type (A+, A-, B+, B-, AB+, AB-, O+, or O-).';
          errBox.classList.remove('hidden');
        }
        showToast('Please select your blood type.', 'error');
        document.getElementById('reg-blood-type')?.focus();
        return;
      }

      // Stronger Password Validation
      const pwdCheck = validateStrongPassword(p);
      if (!pwdCheck.isValid) {
        if (errBox) {
          errBox.textContent = pwdCheck.message;
          errBox.classList.remove('hidden');
        }
        showToast('Password does not meet requirements', 'error');
        document.getElementById('reg-password')?.focus();
        return;
      }

      if (p !== cp) {
        if (errBox) {
          errBox.textContent = 'Passwords do not match.';
          errBox.classList.remove('hidden');
        }
        showToast('Passwords do not match.', 'error');
        document.getElementById('reg-confirm-password')?.focus();
        return;
      }

      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        if (errBox) {
          errBox.textContent = 'Invalid email address';
          errBox.classList.remove('hidden');
        }
        showToast('Invalid email address', 'error');
        document.getElementById('reg-email')?.focus();
        return;
      }

      if (!isValidContactNumber(rawPh)) {
        if (errBox) {
          errBox.textContent =
            'Contact number must be a valid 11-digit mobile number in XXXX-XXX-XXXX format (e.g., 0912-345-6789).';
          errBox.classList.remove('hidden');
        }
        showToast('Please enter a valid 11-digit contact number in XXXX-XXX-XXXX format.', 'error');
        document.getElementById('reg-phone')?.focus();
        return;
      }

      // Save current registration draft
      pendingRegistrationDraft = {
        username: u,
        bloodType,
        password: p,
        confirmPassword: cp,
        email: em,
        rawPhone: formatContactDisplay(ph),
        normalizedPhone: ph,
        notifyBloodTypeMatch,
      };

      const submitBtn = document.getElementById('register-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking Account...';
      }

      try {
        // Verify with Supabase that this email is not already registered before sending OTP
        const dupRes = await checkEmailAlreadyRegisteredInDB(em);
        if (dupRes.error) {
          const msg = dupRes.error.message || 'Email already registered';
          if (errBox) {
            errBox.textContent = msg;
            errBox.classList.remove('hidden');
          }
          showToast(msg, 'error');
          return;
        }

        // If this exact email is already verified in the current session, proceed directly to Account Confirmation Modal
        if (isEmailVerifiedForRegistration(em)) {
          renderAuthModalContent('confirm-registration');
        } else {
          // Otherwise, require Email OTP Verification first
          renderAuthModalContent('verify-otp');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Register Donor Account';
        }
      }
    });
  } else if (mode === 'verify-otp') {
    const targetEmail = pendingRegistrationDraft.email;
    if (!targetEmail) {
      renderAuthModalContent('register');
      return;
    }

    container.innerHTML = `
      <div class="space-y-4">
        <div class="text-center pt-1 space-y-1">
          <div class="w-12 h-12 rounded-2xl bg-rose-950/90 border border-rose-700/60 text-rose-200 mx-auto flex items-center justify-center shadow-md">
            <svg class="w-6 h-6 text-rose-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white">
            Email Verification
          </h2>
          <p class="text-xs text-rose-200">
            Step 1 of 2: Verify your email address before reviewing and confirming your donor account.
          </p>
        </div>

        <div class="p-3.5 rounded-2xl bg-black/30 border border-rose-900/60 text-xs space-y-1">
          <span class="text-[10px] font-bold uppercase tracking-wider text-rose-300 block">Verification Recipient Email:</span>
          <p class="font-mono font-bold text-white text-sm break-all">${escapeHtml(targetEmail)}</p>
        </div>

        <div id="otp-modal-status-box" class="hidden p-3 rounded-xl text-xs font-medium text-center"></div>

        <!-- Step A: Send OTP Button -->
        <div class="space-y-2">
          <button
            type="button"
            id="send-reg-otp-btn"
            class="w-full py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer shadow-md"
          >
            Send OTP to Email
          </button>
          <p class="text-[11px] text-rose-200/80 text-center">
            Click <strong>Send OTP to Email</strong> to receive a one-time verification code at your email address.
          </p>
        </div>

        <!-- Step B: Enter & Verify OTP -->
        <form id="verify-reg-otp-form" class="space-y-3 pt-2 border-t border-rose-900/50">
          <div class="space-y-1">
            <label for="reg-otp-code-input" class="block text-xs font-semibold text-rose-100">
              Enter One-Time Password (OTP):
            </label>
            <div class="rounded-md border-2 border-black bg-[#40070B] overflow-hidden focus-within:border-rose-400">
              <input
                type="text"
                id="reg-otp-code-input"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="8"
                required
                placeholder="Enter 6 to 8-digit OTP code"
                class="w-full px-3 py-2.5 bg-transparent text-white placeholder-rose-300/40 text-sm sm:text-base font-mono tracking-widest text-center focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            id="verify-reg-otp-btn"
            class="w-full py-3 rounded-full bg-[#180304] hover:bg-black text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            Verify OTP
          </button>
        </form>

        <div class="flex items-center justify-between pt-2 border-t border-rose-900/40 text-xs">
          <button
            type="button"
            id="otp-back-to-register-btn"
            class="btn-no-3d text-rose-200 hover:text-white underline cursor-pointer font-semibold"
          >
            ← Edit Registration Details
          </button>
          <button
            type="button"
            id="otp-cancel-btn"
            class="btn-no-3d text-rose-300/70 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    `;

    const statusBox = document.getElementById('otp-modal-status-box');
    const sendOtpBtn = document.getElementById('send-reg-otp-btn');
    const verifyOtpBtn = document.getElementById('verify-reg-otp-btn');
    const otpInput = document.getElementById('reg-otp-code-input');

    const showOtpStatus = (message, type = 'error') => {
      if (!statusBox) return;
      statusBox.textContent = message;
      statusBox.classList.remove('hidden');
      if (type === 'success') {
        statusBox.className =
          'p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 text-xs font-semibold text-center';
      } else if (type === 'info') {
        statusBox.className =
          'p-3 rounded-xl bg-amber-950/80 border border-amber-500/70 text-amber-100 text-xs font-medium text-center';
      } else {
        statusBox.className =
          'p-3 rounded-xl bg-rose-950/90 border border-rose-500/80 text-rose-200 text-xs font-semibold text-center';
      }
    };

    const startSendButtonCooldown = (seconds = 60) => {
      clearOtpCooldownTimer();
      let remaining = seconds;
      if (!sendOtpBtn) return;
      sendOtpBtn.disabled = true;
      sendOtpBtn.textContent = `Resend OTP in ${remaining}s`;

      otpCooldownInterval = setInterval(() => {
        remaining -= 1;
        if (!sendOtpBtn) {
          clearOtpCooldownTimer();
          return;
        }
        if (remaining <= 0) {
          clearOtpCooldownTimer();
          sendOtpBtn.disabled = false;
          sendOtpBtn.textContent = 'Request Another OTP';
        } else {
          sendOtpBtn.textContent = `Resend OTP in ${remaining}s`;
        }
      }, 1000);
    };

    otpInput?.addEventListener('input', () => {
      otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 8);
    });

    sendOtpBtn?.addEventListener('click', async () => {
      if (!sendOtpBtn) return;
      sendOtpBtn.disabled = true;
      sendOtpBtn.textContent = 'Sending OTP...';
      statusBox?.classList.add('hidden');

      const res = await requestRegistrationOtpInDB(targetEmail);
      if (res?.error) {
        showOtpStatus(res.error.message || 'Failed to send OTP email.', 'error');
        showToast(res.error.message || 'Failed to send OTP email.', 'error');
        if (res.cooldownSeconds) {
          startSendButtonCooldown(res.cooldownSeconds);
        } else {
          sendOtpBtn.disabled = false;
          sendOtpBtn.textContent = 'Send OTP to Email';
        }
        return;
      }

      showOtpStatus(
        `An OTP verification code has been sent to ${targetEmail}. Please check your inbox (and spam folder) and enter the code below.`,
        'success'
      );
      showToast(`OTP sent to ${targetEmail}`);
      otpInput?.focus();
      startSendButtonCooldown(res.cooldownSeconds || 60);
    });

    document.getElementById('verify-reg-otp-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = otpInput?.value.trim() || '';
      if (!code) {
        showOtpStatus('Please enter the OTP code sent to your email.', 'error');
        return;
      }

      if (verifyOtpBtn) {
        verifyOtpBtn.disabled = true;
        verifyOtpBtn.textContent = 'Verifying OTP...';
      }

      try {
        const res = await verifyRegistrationOtpInDB(targetEmail, code);
        if (res?.error || !res?.verified) {
          const msg = res?.error?.message || 'Incorrect or expired OTP code.';
          showOtpStatus(msg, 'error');
          showToast(msg, 'error');
          return;
        }

        showOtpStatus('Email verified successfully! Proceeding to account confirmation...', 'success');
        showToast('Email verified! Please review and confirm your registration details.');
        renderAuthModalContent('confirm-registration');
      } finally {
        if (verifyOtpBtn) {
          verifyOtpBtn.disabled = false;
          verifyOtpBtn.textContent = 'Verify OTP';
        }
      }
    });

    document.getElementById('otp-back-to-register-btn')?.addEventListener('click', () => {
      renderAuthModalContent('register');
    });

    document.getElementById('otp-cancel-btn')?.addEventListener('click', closeAuthModal);
  } else if (mode === 'confirm-registration') {
    const draft = pendingRegistrationDraft;
    if (!draft.email || !isEmailVerifiedForRegistration(draft.email)) {
      showToast('Please verify your email address with an OTP before confirming registration.', 'error');
      renderAuthModalContent('verify-otp');
      return;
    }

    container.innerHTML = `
      <div class="space-y-4">
        <div class="text-center pt-1 space-y-1">
          <div class="w-12 h-12 rounded-2xl bg-emerald-950/90 border border-emerald-600/70 text-emerald-300 mx-auto flex items-center justify-center shadow-md">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white">
            Confirm Registration
          </h2>
          <p class="text-xs text-rose-200">
            Step 2 of 2: Please review your registration details carefully before creating your account.
          </p>
        </div>

        <div id="confirm-reg-error-box" class="hidden p-3 rounded-xl bg-rose-950/90 border border-rose-500 text-rose-200 text-xs font-semibold text-center"></div>

        <!-- Registration Details Review Card -->
        <div class="p-4 rounded-2xl bg-black/35 border border-rose-900/60 space-y-3 text-xs sm:text-sm">
          <div class="flex items-center justify-between border-b border-rose-900/40 pb-2">
            <span class="text-rose-300 font-semibold">Full Name / Username</span>
            <span class="font-bold text-white text-right">${escapeHtml(draft.username)}</span>
          </div>

          <div class="flex items-center justify-between border-b border-rose-900/40 pb-2">
            <span class="text-rose-300 font-semibold">Blood Type</span>
            <span class="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-black text-xs">${escapeHtml(draft.bloodType)}</span>
          </div>

          <div class="flex items-center justify-between border-b border-rose-900/40 pb-2 gap-2">
            <span class="text-rose-300 font-semibold shrink-0">Email Address</span>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="font-mono font-bold text-white truncate">${escapeHtml(draft.email)}</span>
              <span class="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/60 text-[10px] font-bold shrink-0">✓ Verified</span>
            </div>
          </div>

          <div class="flex items-center justify-between border-b border-rose-900/40 pb-2">
            <span class="text-rose-300 font-semibold">Contact Number</span>
            <span class="font-mono font-bold text-white">${escapeHtml(formatContactDisplay(draft.normalizedPhone))}</span>
          </div>

          <div class="flex items-center justify-between border-b border-rose-900/40 pb-2">
            <span class="text-rose-300 font-semibold">Account Role</span>
            <span class="font-bold text-rose-100">Donor</span>
          </div>

          <div class="space-y-1 pt-0.5">
            <span class="text-rose-300 font-semibold block">Blood Type Email Notifications</span>
            <p class="text-xs ${draft.notifyBloodTypeMatch ? 'text-emerald-300 font-bold' : 'text-stone-300'}">
              ${
                draft.notifyBloodTypeMatch
                  ? `✓ Enabled — Receive email notification when the same blood type as ${escapeHtml(draft.bloodType)} is requested.`
                  : `Disabled — You can enable notifications for ${escapeHtml(draft.bloodType)} requests anytime in your Profile.`
              }
            </p>
          </div>
        </div>

        <p class="text-[11px] text-rose-200/80 text-center leading-relaxed">
          By clicking <strong>Confirm Registration</strong>, your verified donor account will be created in BloodSync. If you go back and change your email address, email OTP verification will be required again.
        </p>

        <div class="space-y-2.5 pt-1">
          <button
            type="button"
            id="confirm-final-registration-btn"
            class="w-full py-3 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-md cursor-pointer"
          >
            Confirm Registration
          </button>

          <button
            type="button"
            id="edit-registration-details-btn"
            class="w-full py-2.5 rounded-full bg-black/40 hover:bg-black/60 text-rose-100 border border-rose-800/70 font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Go Back / Edit Details
          </button>
        </div>
      </div>
    `;

    document.getElementById('edit-registration-details-btn')?.addEventListener('click', () => {
      renderAuthModalContent('register');
    });

    document.getElementById('confirm-final-registration-btn')?.addEventListener('click', async () => {
      if (isConfirmingRegistration) return;
      isConfirmingRegistration = true;

      const confirmBtn = document.getElementById('confirm-final-registration-btn');
      const editBtn = document.getElementById('edit-registration-details-btn');
      const errBox = document.getElementById('confirm-reg-error-box');
      errBox?.classList.add('hidden');

      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Creating Account...';
      }
      if (editBtn) editBtn.disabled = true;

      try {
        const res = await signUpUser({
          email: draft.email,
          password: draft.password,
          username: draft.username,
          contactNumber: draft.normalizedPhone,
          bloodType: draft.bloodType,
          role: 'Donor',
          hospital: '',
          notifyBloodTypeMatch: draft.notifyBloodTypeMatch,
        });

        if (res?.error || !res?.data?.user) {
          const msg = res?.error?.message || 'Registration could not be completed.';
          if (errBox) {
            errBox.textContent = msg;
            errBox.classList.remove('hidden');
          }
          showToast(msg, 'error');
          return;
        }

        const confirmedProfile = res.profile || {};
        state.user = {
          id: res.data.user.id,
          username: confirmedProfile.username || draft.username,
          email: res.data.user.email || draft.email,
          contactNumber: confirmedProfile.contactNumber || draft.normalizedPhone,
          isLoggedIn: true,
          role: 'Donor',
          hospital: '',
          hospitalId: '',
          bloodType: confirmedProfile.bloodType || draft.bloodType,
          notifyBloodTypeMatch: Boolean(
            confirmedProfile.notifyBloodTypeMatch ?? draft.notifyBloodTypeMatch
          ),
        };

        // Reset draft state after confirmed registration
        pendingRegistrationDraft = {
          username: '',
          bloodType: '',
          password: '',
          confirmPassword: '',
          email: '',
          rawPhone: '',
          normalizedPhone: '',
          notifyBloodTypeMatch: false,
        };

        try {
          localStorage.setItem('bloodsync_active_session_user', JSON.stringify(state.user));
        } catch (storageErr) {
          console.warn('[Auth Session Storage]', storageErr);
        }

        updateUserProfileUI();
        closeAuthModal();
        navigateTo('profile');
        showToast(
          `Account registered and confirmed with blood type ${state.user.bloodType}! Welcome, ${state.user.username}!`
        );

        if (pendingAuthCallback) {
          const cb = pendingAuthCallback;
          pendingAuthCallback = null;
          cb();
        }
      } catch (err) {
        console.warn('[Confirm Registration Error]', err);
        const msg = formatSupabaseError(err, 'An unexpected error occurred during registration.');
        if (errBox) {
          errBox.textContent = msg;
          errBox.classList.remove('hidden');
        }
        showToast(msg, 'error');
      } finally {
        isConfirmingRegistration = false;
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm Registration';
        }
        if (editBtn) editBtn.disabled = false;
      }
    });
  }
}
