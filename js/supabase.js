import { createClient } from '@supabase/supabase-js';
import { maskName, normalizePhoneNumber, validateStrongPassword } from './functions/contact-utils.js';

const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const localUrl = typeof window !== 'undefined' ? localStorage.getItem('bloodsync_supabase_url') || '' : '';
const localKey = typeof window !== 'undefined' ? localStorage.getItem('bloodsync_supabase_key') || '' : '';

function sanitizeSupabaseUrl(url) {
  if (!url) return '';
  let cleaned = String(url).trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

const rawSupabaseUrl = localUrl && !localUrl.includes('your-project-id') ? localUrl : envUrl;
export const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
export const supabaseAnonKey = (localKey && !localKey.includes('your-supabase-anon-key') ? localKey : envKey).trim();

export function isSupabaseConfigured() {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-supabase-anon-key')
  );
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

function normalizeRole(role) {
  if (!role) return 'Donor';
  if (role === 'Hospital Admin' || role === 'Admin') return 'Webpage Admin';
  return role;
}

/**
 * Translates raw Supabase Auth and Database errors into clear, user-friendly messages
 * without exposing sensitive tokens or internal secrets.
 */
export function formatSupabaseError(err, fallbackMsg = 'Operation could not be completed.') {
  if (!err) return fallbackMsg;
  const raw = String(err.message || err.error_description || err || '').trim();
  if (!raw) return fallbackMsg;

  if (/user already registered|email already registered|already been registered|duplicate key value.*email/i.test(raw)) {
    return 'Email already registered';
  }
  if (/invalid email|unable to validate email address|malformed email/i.test(raw)) {
    return 'Invalid email address';
  }
  if (/password should be at least|weak_password|password does not meet/i.test(raw)) {
    return 'Password does not meet requirements';
  }
  if (/invalid login credentials/i.test(raw)) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (/token has expired|otp_expired|expired/i.test(raw)) {
    return 'OTP has expired. Please request a new OTP.';
  }
  if (/token is invalid|invalid token|otp_disabled|invalid otp|incorrect otp/i.test(raw)) {
    return 'Incorrect or invalid OTP code. Please verify and try again.';
  }
  if (/rate limit|over_email_send_rate_limit|for security purposes, you can only request this after/i.test(raw)) {
    return 'Too many OTP requests. Please wait 60 seconds before requesting another OTP.';
  }
  return raw;
}

export function getActiveSessionUser() {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('bloodsync_active_session_user');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
  }
  return null;
}

export function isAuthorizedStaffRole(role) {
  if (!role) return false;
  const r = String(role).trim().toLowerCase();
  return (
    r === 'webpage admin' ||
    r === 'healthcare worker' ||
    r === 'admin' ||
    r === 'hospital admin' ||
    r === 'doctor' ||
    r === 'nurse' ||
    r === 'medical technologist'
  );
}

/**
 * Redacts private requester information from anonymous blood request records
 * before returning data to normal/public callers:
 * - Requester name is masked in D****e format (e.g. Denice -> D****e, Anita Bath -> A****a B****h)
 * - Requester contact number and email are displayed so donors can reach out
 * - Other personal details (emergency contact, relationship, age, payor) remain hidden.
 * Authorized staff (Webpage Admin / Healthcare Worker) receive full unmasked information.
 */
export function sanitizePublicBloodRequestRow(row, isStaff = false) {
  if (!row) return row;
  if (isStaff) return row;
  if (row.is_anonymous === true || row.isAnonymous === true) {
    const rawName = row.patient_name || row.patientName || 'Anonymous Requester';
    const masked = maskName(rawName);
    return {
      ...row,
      patient_name: masked,
      patientName: masked,
      user_id: null,
      age: null,
      emergency_contact: null,
      relationship_to_patient: null,
      medical_receipt_payor: null,
      // contact_number & email are visible for ordinary users
    };
  }
  return row;
}

/* ==========================================================================
   REGISTRATION EMAIL OTP VERIFICATION & SESSION BINDING
   ========================================================================== */

const OTP_RATE_LIMIT_MS = 60 * 1000; // 60 seconds between OTP requests per email
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes OTP validity window
const OTP_MAX_ATTEMPTS = 5;

const registrationOtpSession = {
  targetEmail: null,
  lastSentAt: 0,
  expiresAt: 0,
  attempts: 0,
  verified: false,
  verifiedEmail: null,
  verifiedUserId: null,
  verifiedToken: null,
  consumedByRegistration: false,
};

/**
 * Returns whether the given email address has completed OTP verification
 * in the active registration flow and has not been altered or consumed.
 */
export function isEmailVerifiedForRegistration(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    registrationOtpSession.verified === true &&
    registrationOtpSession.consumedByRegistration === false &&
    registrationOtpSession.verifiedEmail === normalized &&
    Date.now() < registrationOtpSession.expiresAt
  );
}

/**
 * Clears the current registration OTP verification state.
 * If signOutTempSession is true and an unconfirmed OTP session is active, signs out cleanly.
 */
export async function clearRegistrationVerificationSession(signOutTempSession = false) {
  const hadTempSession = registrationOtpSession.verified && !registrationOtpSession.consumedByRegistration;
  registrationOtpSession.targetEmail = null;
  registrationOtpSession.expiresAt = 0;
  registrationOtpSession.attempts = 0;
  registrationOtpSession.verified = false;
  registrationOtpSession.verifiedEmail = null;
  registrationOtpSession.verifiedUserId = null;
  registrationOtpSession.verifiedToken = null;
  registrationOtpSession.consumedByRegistration = false;

  if (signOutTempSession && hadTempSession && isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch {}
  }
}

/**
 * Checks whether an email address is already registered in public.profiles.
 */
export async function checkEmailAlreadyRegisteredInDB(email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { registered: false, error: new Error('Invalid email address') };
  }

  if (!isSupabaseConfigured()) {
    return {
      registered: false,
      error: new Error('Supabase connection is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
    };
  }

  try {
    const { data: existingProfile, error } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase checkEmailAlreadyRegisteredInDB]', error.message);
    }

    if (existingProfile) {
      return {
        registered: true,
        error: new Error('Email already registered'),
      };
    }

    return { registered: false, error: null };
  } catch (err) {
    console.warn('[Supabase checkEmailAlreadyRegisteredInDB]', err);
    return { registered: false, error: null };
  }
}

/**
 * Sends a one-time password (OTP) to the specified email address using Supabase Auth.
 * Enforces rate limits, checks duplicate registration, and inspects Supabase's actual response.
 */
export async function requestRegistrationOtpInDB(email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { data: null, error: new Error('Invalid email address') };
  }

  if (!isSupabaseConfigured()) {
    return {
      data: null,
      error: new Error('Supabase Auth is not configured. Cannot send verification OTP email.'),
    };
  }

  // Enforce rate limit cooldown
  const now = Date.now();
  if (
    registrationOtpSession.targetEmail === normalizedEmail &&
    now - registrationOtpSession.lastSentAt < OTP_RATE_LIMIT_MS
  ) {
    const remainingSec = Math.ceil((OTP_RATE_LIMIT_MS - (now - registrationOtpSession.lastSentAt)) / 1000);
    return {
      data: null,
      cooldownSeconds: remainingSec,
      error: new Error(`Please wait ${remainingSec}s before requesting another OTP.`),
    };
  }

  // Check if email already has a registered account in public.profiles
  const dupCheck = await checkEmailAlreadyRegisteredInDB(normalizedEmail);
  if (dupCheck.registered) {
    return {
      data: null,
      error: new Error('Email already registered'),
    };
  }

  try {
    // Reset any prior verification if requesting a fresh OTP
    registrationOtpSession.verified = false;
    registrationOtpSession.verifiedEmail = null;
    registrationOtpSession.verifiedUserId = null;
    registrationOtpSession.verifiedToken = null;
    registrationOtpSession.consumedByRegistration = false;

    const { data, error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return {
        data: null,
        error: new Error(formatSupabaseError(error, 'Failed to send OTP email. Please check the email address or try again later.')),
      };
    }

    registrationOtpSession.targetEmail = normalizedEmail;
    registrationOtpSession.lastSentAt = Date.now();
    registrationOtpSession.expiresAt = Date.now() + OTP_EXPIRY_MS;
    registrationOtpSession.attempts = 0;

    return {
      data: data || { sent: true, email: normalizedEmail },
      cooldownSeconds: 60,
      error: null,
    };
  } catch (err) {
    console.error('[Supabase requestRegistrationOtpInDB]', err);
    return {
      data: null,
      error: new Error(formatSupabaseError(err, 'Email delivery failed. Unable to send OTP at this time.')),
    };
  }
}

/**
 * Verifies the OTP entered by the user against Supabase Auth (`supabase.auth.verifyOtp`).
 * Enforces expiration, attempt limits, single-use consumption, and binds the verified email to the session.
 */
export async function verifyRegistrationOtpInDB(email, otpCode) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const cleanCode = String(otpCode || '').replace(/\s+/g, '').trim();

  if (!normalizedEmail || !cleanCode) {
    return {
      verified: false,
      data: null,
      error: new Error('Please enter the OTP code sent to your email address.'),
    };
  }

  if (!/^\d{6,8}$/.test(cleanCode)) {
    return {
      verified: false,
      data: null,
      error: new Error('Invalid OTP format. Please enter the numeric verification code from your email.'),
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      verified: false,
      data: null,
      error: new Error('Supabase Auth is not configured. Cannot verify OTP.'),
    };
  }

  if (registrationOtpSession.targetEmail !== normalizedEmail || !registrationOtpSession.expiresAt) {
    return {
      verified: false,
      data: null,
      error: new Error('No active OTP request found for this email. Please click "Send OTP" first.'),
    };
  }

  if (Date.now() >= registrationOtpSession.expiresAt) {
    return {
      verified: false,
      data: null,
      error: new Error('OTP has expired. Please request a new OTP.'),
    };
  }

  if (registrationOtpSession.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      verified: false,
      data: null,
      error: new Error('Maximum verification attempts exceeded. Please request a new OTP.'),
    };
  }

  if (registrationOtpSession.verified && registrationOtpSession.verifiedEmail === normalizedEmail) {
    return {
      verified: false,
      data: null,
      error: new Error('This OTP has already been used. Please proceed to confirm your registration.'),
    };
  }

  try {
    registrationOtpSession.attempts += 1;

    // Verify OTP with Supabase Auth
    let { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: cleanCode,
      type: 'email',
    });

    // If Supabase issued a signup confirmation token for a newly created auth user, also check type: 'signup'
    if (error) {
      const signupRes = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: cleanCode,
        type: 'signup',
      });
      if (!signupRes.error && signupRes.data?.user) {
        data = signupRes.data;
        error = null;
      }
    }

    if (error || !data?.user) {
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - registrationOtpSession.attempts);
      const baseMsg = formatSupabaseError(error, 'Incorrect or invalid OTP code.');
      const attemptNote =
        remaining > 0
          ? `${baseMsg} (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
          : 'Maximum verification attempts reached. Please request a new OTP.';
      return {
        verified: false,
        data: null,
        error: new Error(attemptNote),
      };
    }

    // Bind verified email to the registration session & prevent OTP reuse
    registrationOtpSession.verified = true;
    registrationOtpSession.verifiedEmail = normalizedEmail;
    registrationOtpSession.verifiedUserId = data.user.id;
    registrationOtpSession.verifiedToken = data.session?.access_token || `verified-${Date.now()}`;
    registrationOtpSession.consumedByRegistration = false;

    return {
      verified: true,
      data,
      user: data.user,
      error: null,
    };
  } catch (err) {
    console.error('[Supabase verifyRegistrationOtpInDB]', err);
    return {
      verified: false,
      data: null,
      error: new Error(formatSupabaseError(err, 'Failed to verify OTP code with Supabase.')),
    };
  }
}

/* ==========================================================================
   AUTHENTICATION & PROFILE APIS
   ========================================================================== */

export function getLocalRegisteredUsers() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('bloodsync_registered_users') || '[]');
  } catch {
    return [];
  }
}

export function saveLocalRegisteredUser(userProfile) {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalRegisteredUsers().filter(
      (u) => u.email?.toLowerCase() !== userProfile.email?.toLowerCase()
    );
    list.push(userProfile);
    localStorage.setItem('bloodsync_registered_users', JSON.stringify(list));
  } catch (e) {
    console.warn('[LocalStorage User Save]', e);
  }
}

export function saveLocalRegisteredUsers(usersList) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('bloodsync_registered_users', JSON.stringify(usersList || []));
  } catch (e) {
    console.warn('[LocalStorage Users Save]', e);
  }
}

/**
 * Complete Donor Account Registration in Supabase AFTER Email OTP Verification and User Confirmation.
 * Public registrations are strictly restricted to Donor role.
 * Enforces strong password validation, verified email session binding, and saves notification preferences.
 */
export async function signUpUser({
  email,
  password,
  username,
  contactNumber,
  bloodType = 'O+',
  role = 'Donor',
  hospital = '',
  notifyBloodTypeMatch = false,
}) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const safeRole = 'Donor'; // Ordinary users cannot self-assign Webpage Admin or Healthcare Worker
  const notifyPref = Boolean(notifyBloodTypeMatch);

  // 1. Validate strong password requirements on backend/service layer
  const pwdValidation = validateStrongPassword(password);
  if (!pwdValidation.isValid) {
    return {
      data: null,
      profile: null,
      error: new Error('Password does not meet requirements'),
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      data: null,
      profile: null,
      error: new Error('Supabase Auth is not configured. Registration requires an active Supabase connection.'),
    };
  }

  // 2. Enforce that the email was OTP-verified in the current registration session
  if (!isEmailVerifiedForRegistration(normalizedEmail)) {
    return {
      data: null,
      profile: null,
      error: new Error('Email verification is required. Please verify your email address with an OTP before confirming registration.'),
    };
  }

  // 3. Check if email already exists in public.profiles
  try {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();
    if (existingProfile) {
      return {
        data: null,
        profile: null,
        error: new Error('Email already registered'),
      };
    }
  } catch {}

  try {
    let authUser = null;
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSessionUser = sessionData?.session?.user;

    const userMetadata = {
      username,
      contact_number: contactNumber,
      blood_type: bloodType,
      role: safeRole,
      hospital: '',
      notify_blood_type_match: notifyPref,
    };

    if (currentSessionUser && currentSessionUser.email?.toLowerCase() === normalizedEmail) {
      // Session was established by verifyOtp: finalize account by setting password and metadata in Supabase Auth
      const { data: updatedAuth, error: updateError } = await supabase.auth.updateUser({
        password,
        data: userMetadata,
      });

      if (updateError) {
        return {
          data: null,
          profile: null,
          error: new Error(formatSupabaseError(updateError, 'Failed to finalize account credentials in Supabase Auth.')),
        };
      }
      authUser = updatedAuth?.user || currentSessionUser;
    } else {
      // Fallback to signUp if no active session from verifyOtp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: userMetadata,
        },
      });

      if (signUpError) {
        return {
          data: null,
          profile: null,
          error: new Error(formatSupabaseError(signUpError, 'Registration failed.')),
        };
      }

      if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        return {
          data: null,
          profile: null,
          error: new Error('Email already registered'),
        };
      }
      authUser = signUpData?.user;
    }

    if (!authUser || !authUser.id) {
      return {
        data: null,
        profile: null,
        error: new Error('Supabase did not return a valid authenticated user record.'),
      };
    }

    // 4. Insert or upsert the confirmed profile row in public.profiles
    const profilePayload = {
      id: authUser.id,
      username,
      email: normalizedEmail,
      contact_number: contactNumber,
      blood_type: bloodType,
      role: safeRole,
      hospital: null,
      hospital_id: null,
      notify_blood_type_match: notifyPref,
      updated_at: new Date().toISOString(),
    };

    let { data: insertedRows, error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload)
      .select();

    // Graceful fallback if notify_blood_type_match column migration has not been applied yet on remote DB
    if (profileError && /notify_blood_type_match/i.test(profileError.message || '')) {
      const fallbackPayload = { ...profilePayload };
      delete fallbackPayload.notify_blood_type_match;
      const retryRes = await supabase.from('profiles').upsert(fallbackPayload).select();
      insertedRows = retryRes.data;
      profileError = retryRes.error;
    }

    if (profileError) {
      console.error('[Supabase Profile Upsert Error]', profileError.message);
      return {
        data: null,
        profile: null,
        error: new Error(formatSupabaseError(profileError, 'Failed to create user profile in Supabase.')),
      };
    }

    // Mark OTP verification session as consumed so duplicate clicks cannot re-run registration
    registrationOtpSession.consumedByRegistration = true;

    const savedRow = Array.isArray(insertedRows) && insertedRows.length > 0 ? insertedRows[0] : profilePayload;
    const confirmedProfile = {
      id: savedRow.id || authUser.id,
      email: normalizedEmail,
      username: savedRow.username || username,
      contactNumber: savedRow.contact_number || contactNumber,
      bloodType: savedRow.blood_type || bloodType,
      role: safeRole,
      hospital: '',
      hospitalId: '',
      notifyBloodTypeMatch: Boolean(savedRow.notify_blood_type_match ?? notifyPref),
      createdAt: savedRow.created_at || new Date().toISOString(),
    };

    saveLocalRegisteredUser(confirmedProfile);

    return {
      data: { user: authUser },
      profile: confirmedProfile,
      error: null,
    };
  } catch (err) {
    console.error('[Supabase signUpUser]', err);
    return {
      data: null,
      profile: null,
      error: new Error(formatSupabaseError(err, 'An unexpected error occurred during registration.')),
    };
  }
}

/**
 * Fetch profile information for an authenticated user from the profiles table.
 */
export async function fetchUserProfileFromDB(userId, email = null) {
  const localList = getLocalRegisteredUsers();
  const localMatch = localList.find(
    (u) => (userId && u.id === userId) || (email && u.email && u.email.toLowerCase() === email.toLowerCase())
  );

  if (!isSupabaseConfigured()) {
    if (localMatch) {
      localMatch.role = normalizeRole(localMatch.role);
      if (localMatch.role === 'Webpage Admin') {
        localMatch.hospital = '';
        localMatch.hospitalId = '';
      }
      localMatch.notifyBloodTypeMatch = Boolean(localMatch.notifyBloodTypeMatch);
    }
    return localMatch || null;
  }

  try {
    let data = null;
    if (userId) {
      const resById = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!resById.error && resById.data) {
        data = resById.data;
      }
    }
    if (!data && email) {
      const resByEmail = await supabase.from('profiles').select('*').ilike('email', email.trim()).maybeSingle();
      if (!resByEmail.error && resByEmail.data) {
        data = resByEmail.data;
      }
    }
    if (!data) {
      if (localMatch) {
        localMatch.role = normalizeRole(localMatch.role);
        if (localMatch.role === 'Webpage Admin') {
          localMatch.hospital = '';
          localMatch.hospitalId = '';
        }
        localMatch.notifyBloodTypeMatch = Boolean(localMatch.notifyBloodTypeMatch);
      }
      return localMatch || null;
    }

    const resolvedRole = normalizeRole(data.role);
    const isWebpageAdmin = resolvedRole === 'Webpage Admin';

    let metaNotify = undefined;
    try {
      const authUser = await getCurrentUser();
      if (authUser && authUser.id === data.id && authUser.user_metadata) {
        metaNotify = authUser.user_metadata.notify_blood_type_match;
      }
    } catch {}

    return {
      id: data.id,
      username: data.username,
      email: data.email,
      contactNumber: data.contact_number,
      bloodType: data.blood_type || 'O+',
      role: resolvedRole,
      hospital: isWebpageAdmin ? '' : data.hospital || '',
      hospitalId: isWebpageAdmin ? '' : data.hospital_id || '',
      licenseNumber: data.license_number || '',
      notifyBloodTypeMatch: Boolean(
        data.notify_blood_type_match ?? metaNotify ?? localMatch?.notifyBloodTypeMatch ?? false
      ),
    };
  } catch (err) {
    console.warn('[Supabase fetchUserProfileFromDB]', err);
    return localMatch || null;
  }
}

/**
 * Sign in an existing user with email and password using Supabase Auth and load their profile record.
 */
export async function signInUser({ email, password }) {
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!isSupabaseConfigured()) {
    return {
      data: null,
      profile: null,
      error: new Error('Supabase Auth is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data?.user) {
    return {
      data: null,
      profile: null,
      error: new Error(formatSupabaseError(error, 'Invalid login credentials.')),
    };
  }

  let profile = await fetchUserProfileFromDB(data.user.id, data.user.email);
  if (!profile && data.user.user_metadata) {
    const meta = data.user.user_metadata;
    const resolvedRole = normalizeRole(meta.role);
    const isWebpageAdmin = resolvedRole === 'Webpage Admin';
    profile = {
      id: data.user.id,
      username: meta.username || normalizedEmail.split('@')[0],
      email: data.user.email,
      contactNumber: meta.contact_number || '',
      bloodType: meta.blood_type || 'O+',
      role: resolvedRole,
      hospital: isWebpageAdmin ? '' : meta.hospital || '',
      hospitalId: isWebpageAdmin ? '' : meta.hospital_id || '',
      licenseNumber: meta.license_number || '',
      notifyBloodTypeMatch: Boolean(meta.notify_blood_type_match),
    };
  }

  return { data, profile, error: null };
}

/**
 * Update authenticated user's profile information in Supabase
 * (username, contact_number, blood_type, hospital, license_number, notify_blood_type_match).
 * Enforces ownership checks and prevents role or permission escalation.
 */
export async function updateUserProfileInDB(userId, updates) {
  const safeUpdates = { ...updates };
  // Never allow ordinary profile edits to change role or id
  delete safeUpdates.role;
  delete safeUpdates.id;
  delete safeUpdates.email;
  safeUpdates.updated_at = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Profile changes cannot be saved.'),
    };
  }

  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return {
        data: null,
        error: new Error('Authentication session expired. Please sign in again to update your profile.'),
      };
    }

    // Verify ownership: caller can only edit their own profile
    if (userId && authUser.id && userId !== authUser.id) {
      const existingById = await fetchUserProfileFromDB(userId, null);
      if (
        existingById &&
        existingById.email &&
        authUser.email &&
        existingById.email.toLowerCase() !== authUser.email.toLowerCase()
      ) {
        return {
          data: null,
          error: new Error('Unauthorized: You can only edit your own profile information.'),
        };
      }
    }

    const currentProfile = await fetchUserProfileFromDB(authUser.id, authUser.email);
    const currentRole = normalizeRole(currentProfile?.role || authUser.user_metadata?.role || 'Donor');

    // Webpage Admin accounts do not have hospital or hospital_id associations
    if (currentRole === 'Webpage Admin') {
      safeUpdates.hospital = null;
      safeUpdates.hospital_id = null;
    }

    const runProfileUpdateById = async (payload) => {
      return await supabase.from('profiles').update(payload).eq('id', authUser.id).select();
    };

    // 1. Update public.profiles by authenticated user ID
    let updatedRow = null;
    let dbError = null;

    let resById = await runProfileUpdateById(safeUpdates);
    if (resById.error && /notify_blood_type_match/i.test(resById.error.message || '')) {
      const fallbackUpdates = { ...safeUpdates };
      delete fallbackUpdates.notify_blood_type_match;
      resById = await runProfileUpdateById(fallbackUpdates);
    }

    if (resById.error) {
      dbError = resById.error;
    } else if (Array.isArray(resById.data) && resById.data.length > 0) {
      updatedRow = resById.data[0];
    }

    // 2. If profile row was keyed by email (e.g. seeded or provisioned staff record), update by email
    if (!updatedRow && authUser.email) {
      let resByEmail = await supabase
        .from('profiles')
        .update(safeUpdates)
        .ilike('email', authUser.email.trim())
        .select();

      if (resByEmail.error && /notify_blood_type_match/i.test(resByEmail.error.message || '')) {
        const fallbackUpdates = { ...safeUpdates };
        delete fallbackUpdates.notify_blood_type_match;
        resByEmail = await supabase
          .from('profiles')
          .update(fallbackUpdates)
          .ilike('email', authUser.email.trim())
          .select();
      }

      if (!resByEmail.error && Array.isArray(resByEmail.data) && resByEmail.data.length > 0) {
        updatedRow = resByEmail.data[0];
        dbError = null;
      } else if (resByEmail.error && !dbError) {
        dbError = resByEmail.error;
      }
    }

    // 3. If no row existed in public.profiles yet for this authenticated user, insert/upsert their profile row
    if (!updatedRow && !dbError) {
      const upsertPayload = {
        id: authUser.id,
        email: authUser.email,
        role: currentRole === 'Webpage Admin' || currentRole === 'Healthcare Worker' ? currentRole : 'Donor',
        ...safeUpdates,
      };
      let resUpsert = await supabase.from('profiles').upsert(upsertPayload).select();

      if (resUpsert.error && /notify_blood_type_match/i.test(resUpsert.error.message || '')) {
        const fallbackUpsert = { ...upsertPayload };
        delete fallbackUpsert.notify_blood_type_match;
        resUpsert = await supabase.from('profiles').upsert(fallbackUpsert).select();
      }

      if (resUpsert.error) {
        dbError = resUpsert.error;
      } else if (Array.isArray(resUpsert.data) && resUpsert.data.length > 0) {
        updatedRow = resUpsert.data[0];
      }
    }

    if (dbError) {
      console.error('[Supabase updateUserProfileInDB] error:', dbError.message);
      return { data: null, error: new Error(formatSupabaseError(dbError, 'Failed to update profile in Supabase.')) };
    }

    const resolvedNotifyPref =
      safeUpdates.notify_blood_type_match !== undefined
        ? Boolean(safeUpdates.notify_blood_type_match)
        : Boolean(updatedRow?.notify_blood_type_match ?? currentProfile?.notifyBloodTypeMatch ?? false);

    // 4. Keep Supabase Auth user_metadata in sync
    try {
      const metaPayload = {
        notify_blood_type_match: resolvedNotifyPref,
      };
      if (safeUpdates.username !== undefined) metaPayload.username = safeUpdates.username;
      if (safeUpdates.contact_number !== undefined) metaPayload.contact_number = safeUpdates.contact_number;
      if (safeUpdates.blood_type !== undefined) metaPayload.blood_type = safeUpdates.blood_type;
      if (safeUpdates.hospital !== undefined) {
        metaPayload.hospital = currentRole === 'Webpage Admin' ? '' : safeUpdates.hospital || '';
      }
      if (safeUpdates.license_number !== undefined) {
        metaPayload.license_number = safeUpdates.license_number || '';
      }
      await supabase.auth.updateUser({ data: metaPayload });
    } catch (metaErr) {
      console.warn('[Supabase Auth Metadata Sync]', metaErr);
    }

    // 5. Re-fetch the confirmed profile from the database
    const refreshedProfile = await fetchUserProfileFromDB(authUser.id, authUser.email);
    const confirmedProfile = {
      id: refreshedProfile?.id || updatedRow?.id || authUser.id,
      username: refreshedProfile?.username ?? updatedRow?.username ?? safeUpdates.username ?? currentProfile?.username,
      email: refreshedProfile?.email ?? updatedRow?.email ?? authUser.email,
      contactNumber:
        refreshedProfile?.contactNumber ??
        updatedRow?.contact_number ??
        safeUpdates.contact_number ??
        currentProfile?.contactNumber,
      bloodType:
        refreshedProfile?.bloodType ??
        updatedRow?.blood_type ??
        safeUpdates.blood_type ??
        currentProfile?.bloodType ??
        'O+',
      role: currentRole,
      hospital:
        currentRole === 'Webpage Admin'
          ? ''
          : refreshedProfile?.hospital ?? updatedRow?.hospital ?? safeUpdates.hospital ?? '',
      hospitalId:
        currentRole === 'Webpage Admin'
          ? ''
          : refreshedProfile?.hospitalId ?? updatedRow?.hospital_id ?? '',
      licenseNumber:
        refreshedProfile?.licenseNumber ??
        updatedRow?.license_number ??
        safeUpdates.license_number ??
        '',
      notifyBloodTypeMatch: resolvedNotifyPref,
    };

    // Update local fallback cache as well
    const localList = getLocalRegisteredUsers();
    const matchIdx = localList.findIndex(
      (u) => u.id === confirmedProfile.id || (u.email && u.email.toLowerCase() === confirmedProfile.email?.toLowerCase())
    );
    if (matchIdx !== -1) {
      localList[matchIdx] = { ...localList[matchIdx], ...confirmedProfile };
      saveLocalRegisteredUsers(localList);
    } else {
      saveLocalRegisteredUser(confirmedProfile);
    }

    return { data: confirmedProfile, error: null };
  } catch (err) {
    console.error('[Supabase updateUserProfileInDB]', err);
    return { data: null, error: new Error(formatSupabaseError(err, 'Failed to update profile in Supabase.')) };
  }
}

/**
 * Dedicated helper to toggle the user's Blood Type Email Notification preference in Supabase.
 */
export async function updateNotificationPreferenceInDB(userId, notifyBloodTypeMatch) {
  return await updateUserProfileInDB(userId, {
    notify_blood_type_match: Boolean(notifyBloodTypeMatch),
  });
}

export async function signOutUser() {
  if (!isSupabaseConfigured()) return { error: null };
  return await supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    console.warn('[Supabase getUser]', err);
    return null;
  }
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured()) return { unsubscribe: () => {} };
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return listener.subscription;
}

/* ==========================================================================
   DATABASE APIS: HOSPITALS & BLOOD NEEDED AGGREGATION
   ========================================================================== */

export async function fetchHospitalsFromDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[Supabase] Error fetching hospitals:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase fetchHospitals]', err);
    return null;
  }
}

/**
 * Fetch aggregated hospital blood needs from the database view or active requests query
 */
export async function fetchHospitalBloodNeedsFromDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('hospital_blood_needs_view')
      .select('*');

    if (!error && Array.isArray(data)) {
      return data;
    }

    // Fallback aggregation query from blood_requests if view is not yet created
    const nowIso = new Date().toISOString();
    const { data: reqData, error: reqError } = await supabase
      .from('blood_requests')
      .select('id, hospital_id, hospital_name, blood_type, units_needed, status, is_archived, expires_at')
      .eq('is_archived', false);

    if (reqError || !Array.isArray(reqData)) return null;

    const grouped = {};
    const seen = new Set();
    reqData.forEach((r) => {
      if (!r || !r.id || seen.has(r.id)) return;
      if (r.status === 'Archived' || r.status === 'Cancelled' || r.status === 'Fulfilled') return;
      if (r.expires_at && new Date(r.expires_at).toISOString() <= nowIso) return;
      seen.add(r.id);
      const key = `${r.hospital_id || r.hospital_name}::${r.blood_type}`;
      if (!grouped[key]) {
        grouped[key] = {
          hospital_id: r.hospital_id,
          hospital_name: r.hospital_name,
          blood_type: r.blood_type,
          units_needed: 0,
        };
      }
      grouped[key].units_needed += Number(r.units_needed) || 0;
    });

    return Object.values(grouped);
  } catch (err) {
    console.warn('[Supabase fetchHospitalBloodNeedsFromDB]', err);
    return null;
  }
}

export async function updateHospitalBloodNeeded(hospitalId, bloodNeededArray) {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('hospitals')
    .update({
      blood_needed: bloodNeededArray,
      last_updated: 'Live',
    })
    .eq('id', hospitalId)
    .select();

  if (error) {
    console.error('[Supabase] Error updating hospital bloodNeeded:', error.message);
    return null;
  }
  return data;
}

export function subscribeToHospitals(onUpdate) {
  if (!isSupabaseConfigured()) return null;

  return supabase
    .channel('realtime:hospitals')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'hospitals' },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();
}

/* ==========================================================================
   DATABASE APIS: PATIENT BLOOD REQUESTS
   ========================================================================== */

export async function archiveExpiredRequestsInDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    const nowIso = new Date().toISOString();
    const { data: rpcData, error: rpcError } = await supabase.rpc('archive_expired_blood_requests');
    if (!rpcError) return rpcData;

    const { data, error } = await supabase
      .from('blood_requests')
      .update({
        is_archived: true,
        status: 'Archived',
        archived_reason: 'automatically_expired',
        archived_at: nowIso,
      })
      .eq('is_archived', false)
      .lte('expires_at', nowIso)
      .select();

    if (error) {
      console.warn('[Supabase archiveExpiredRequestsInDB]', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[Supabase archiveExpiredRequestsInDB]', err);
    return null;
  }
}

/**
 * Fetch public blood requests from Supabase.
 * Enforces anonymous-request privacy at the query/response level so hidden personal
 * details are never exposed to unauthorized clients.
 */
export async function fetchRequestsFromDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    await archiveExpiredRequestsInDB();

    // Check caller privilege
    let isStaff = false;
    const localActiveUser = getActiveSessionUser();
    if (localActiveUser?.isLoggedIn && isAuthorizedStaffRole(localActiveUser.role)) {
      isStaff = true;
    } else {
      const authUser = await getCurrentUser();
      if (authUser) {
        const profile = await fetchUserProfileFromDB(authUser.id, authUser.email);
        if (isAuthorizedStaffRole(profile?.role || authUser.user_metadata?.role)) {
          isStaff = true;
        }
      }
    }

    if (isStaff) {
      // Authorized staff receives unmasked records directly
      const { data, error } = await supabase
        .from('blood_requests')
        .select('*')
        .order('posted_time', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data;
      }
    }

    // 1. Try querying the privacy-enforcing active_blood_requests view first
    const viewRes = await supabase
      .from('active_blood_requests')
      .select('*')
      .order('posted_time', { ascending: false });

    if (!viewRes.error && Array.isArray(viewRes.data)) {
      return viewRes.data.map((r) => sanitizePublicBloodRequestRow(r, isStaff));
    }

    // 2. Fallback to blood_requests table with strict response-level privacy redaction
    const { data, error } = await supabase
      .from('blood_requests')
      .select('*')
      .order('posted_time', { ascending: false });

    if (error) {
      console.error('[Supabase] Error fetching blood requests:', error.message);
      return null;
    }
    return (data || []).map((r) => sanitizePublicBloodRequestRow(r, isStaff));
  } catch (err) {
    console.error('[Supabase fetchRequests]', err);
    return null;
  }
}

/**
 * Fetch contact information for a specific blood request.
 * Enforces role-based anonymous visibility:
 * - Webpage Admin & Healthcare Worker: Complete unmasked original information
 * - Normal Users: Masked name in D****e format, contact number, and email. Other personal details hidden.
 */
export async function fetchRequestContactFromDB(requestId) {
  if (!requestId) return null;

  try {
    // 1. Determine caller authorization and identity
    let callerRole = 'Donor';
    let callerEmail = '';
    let callerId = null;

    // Check active local session first
    const localActiveUser = getActiveSessionUser();
    if (localActiveUser && localActiveUser.isLoggedIn) {
      callerRole = localActiveUser.role || 'Donor';
      callerEmail = (localActiveUser.email || '').trim().toLowerCase();
      callerId = localActiveUser.id || null;
    }

    // Check Supabase authenticated user if configured
    if (isSupabaseConfigured()) {
      try {
        const authUser = await getCurrentUser();
        if (authUser) {
          if (!callerEmail) callerEmail = (authUser.email || '').trim().toLowerCase();
          if (!callerId) callerId = authUser.id || null;
          const profile = await fetchUserProfileFromDB(authUser.id, authUser.email);
          if (profile?.role) {
            callerRole = profile.role;
          } else if (authUser.user_metadata?.role) {
            callerRole = authUser.user_metadata.role;
          }
        }
      } catch (authErr) {
        console.warn('[Supabase Auth Check in fetchRequestContactFromDB]', authErr);
      }
    }

    const isStaff = isAuthorizedStaffRole(callerRole);

    // 2. Query request data from Supabase
    let data = null;
    if (isSupabaseConfigured()) {
      // First try RPC function if available
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_blood_request_contact', {
          p_request_id: requestId,
        });
        if (!rpcError && rpcData) {
          data = rpcData;
        }
      } catch {}

      if (!data) {
        const { data: dbData, error } = await supabase
          .from('blood_requests')
          .select(
            'id, patient_name, age, blood_type, units_needed, hospital_name, relationship_to_patient, emergency_contact, contact_number, email, is_anonymous'
          )
          .eq('id', requestId)
          .maybeSingle();

        if (!error && dbData) {
          data = dbData;
        }
      }
    }

    // 3. Fallback to local memory / state if offline or record not in Supabase
    if (!data && typeof window !== 'undefined' && Array.isArray(window.state?.requests)) {
      const match = window.state.requests.find((r) => r && r.id === requestId);
      if (match) {
        data = {
          id: match.id,
          patient_name: match.patientName || match.patient_name,
          age: match.age,
          blood_type: match.bloodType || match.blood_type,
          units_needed: match.unitsNeeded || match.units_needed,
          hospital_name: match.hospitalName || match.hospital_name,
          relationship_to_patient: match.relationshipToPatient || match.relationship_to_patient,
          emergency_contact: match.emergencyContact || match.emergency_contact,
          contact_number: match.contactNumber || match.contact_number,
          email: match.email,
          is_anonymous: Boolean(match.isAnonymous ?? match.is_anonymous),
        };
      }
    }

    if (!data) return null;

    const isAnonymous = Boolean(data.is_anonymous ?? data.isAnonymous);
    const patientName = data.patient_name || data.patientName || 'Anonymous Patient';
    const hospitalName = data.hospital_name || data.hospitalName || 'N/A';
    const contactNumber = data.contact_number || data.contactNumber || null;
    const email = data.email || null;
    const requestEmail = (email || '').trim().toLowerCase();
    const isOwner = Boolean(callerEmail && requestEmail && callerEmail === requestEmail);
    const hasPrivilege = isStaff || isOwner;

    if (isAnonymous) {
      if (hasPrivilege) {
        // Authenticated Webpage Admin, Healthcare Worker, or Request Owner:
        // Complete unmasked original information!
        return {
          id: data.id,
          patientName, // UNMASKED! Original complete name
          age: data.age ?? null,
          bloodType: data.blood_type || data.bloodType || 'N/A',
          unitsNeeded: data.units_needed || data.unitsNeeded || 1,
          hospitalId: data.hospital_id || data.hospitalId || null,
          hospitalName,
          condition: data.condition || null,
          relationshipToPatient: data.relationship_to_patient || data.relationshipToPatient || null,
          emergencyContact: data.emergency_contact || data.emergencyContact || null,
          contactNumber,
          email,
          doctorSlipUrl: data.doctor_slip_url || data.doctorSlipUrl || null,
          medicalReceiptNo: data.medical_receipt_no || data.medicalReceiptNo || null,
          isAnonymous: true,
          authorizedStaffView: true,
          isAuthorizedStaff: isStaff,
          isOwner,
        };
      } else {
        // Normal Users (Donors and Patients):
        // Mask the requester's name using the format D****e.
        // Display the requester's contact number and email address.
        // Continue hiding other personal details (emergency contact, relationship, age, etc.).
        return {
          id: data.id,
          patientName: maskName(patientName),
          hospitalName,
          bloodType: data.blood_type || data.bloodType || 'N/A',
          unitsNeeded: data.units_needed || data.unitsNeeded || 1,
          contactNumber,
          email,
          age: null,
          emergencyContact: null,
          relationshipToPatient: null,
          isAnonymous: true,
          authorizedStaffView: false,
          isAuthorizedStaff: false,
          isOwner: false,
        };
      }
    }

    // Non-anonymous blood request: full details
    return {
      id: data.id,
      patientName,
      age: data.age ?? null,
      bloodType: data.blood_type || data.bloodType || 'N/A',
      unitsNeeded: data.units_needed || data.unitsNeeded || 1,
      hospitalName,
      relationshipToPatient: data.relationship_to_patient || data.relationshipToPatient || null,
      emergencyContact: data.emergency_contact || data.emergencyContact || null,
      contactNumber,
      email,
      isAnonymous: false,
      authorizedStaffView: false,
      isAuthorizedStaff: isStaff,
      isOwner,
    };
  } catch (err) {
    console.warn('[Supabase fetchRequestContactFromDB]', err);
    return null;
  }
}

/**
 * Fetch blood requests belonging strictly to a specific authenticated user by email (and optional userId).
 */
export async function fetchUserRequestsFromDB(userEmail, userId = null) {
  if (!isSupabaseConfigured() || !userEmail) return null;

  try {
    await archiveExpiredRequestsInDB();

    const normalizedEmail = userEmail.trim().toLowerCase();
    const { data, error } = await supabase
      .from('blood_requests')
      .select('*')
      .ilike('email', normalizedEmail)
      .order('posted_time', { ascending: false });

    if (error) {
      console.error('[Supabase] Error fetching user-isolated blood requests:', error.message);
      return null;
    }

    if (userId && Array.isArray(data)) {
      return data.filter(
        (row) =>
          (row.email && row.email.trim().toLowerCase() === normalizedEmail) ||
          (row.user_id && row.user_id === userId)
      );
    }

    return data || [];
  } catch (err) {
    console.error('[Supabase fetchUserRequestsFromDB]', err);
    return null;
  }
}

/**
 * Triggers secure backend processing for Blood Type Email Notifications
 * after a blood request has been confirmed saved in Supabase.
 * - Uses the PostgreSQL SECURITY DEFINER RPC `process_blood_request_notifications` and/or Edge Function `notify-matching-donors`.
 * - Does not expose recipient email addresses to the frontend.
 * - Handles delivery errors gracefully without undoing the saved blood request.
 */
export async function triggerBloodRequestNotificationsInDB(savedRequestRow) {
  if (!isSupabaseConfigured() || !savedRequestRow || !savedRequestRow.id) return;

  const appUrl =
    typeof window !== 'undefined' && window.location
      ? `${window.location.origin}/#requests`
      : 'https://bloodsync.app/#requests';

  try {
    // 1. Trigger database SECURITY DEFINER notification worker RPC (deduplicated via blood_request_notifications table)
    const { error: rpcError } = await supabase.rpc('process_blood_request_notifications', {
      p_request_id: savedRequestRow.id,
      p_app_url: appUrl,
    });
    if (rpcError) {
      console.info('[Supabase Notification RPC Info]', rpcError.message);
    }
  } catch (rpcErr) {
    console.info('[Supabase Notification RPC]', rpcErr);
  }

  try {
    // 2. Invoke Supabase Edge Function worker if deployed for external SMTP / email dispatch
    await supabase.functions.invoke('notify-matching-donors', {
      body: {
        requestId: savedRequestRow.id,
        bloodType: savedRequestRow.blood_type || savedRequestRow.bloodType,
        hospitalName: savedRequestRow.is_anonymous
          ? 'Accredited Cavite Healthcare Facility'
          : savedRequestRow.hospital_name || savedRequestRow.hospitalName,
        unitsNeeded: savedRequestRow.units_needed || savedRequestRow.unitsNeeded,
        urgency: savedRequestRow.urgency,
        requestLink: appUrl,
      },
    });
  } catch {
    // Edge function is optional when database trigger/webhook worker handles dispatch; never fail the saved request
  }
}

/**
 * Post a new urgent blood request to Supabase including relationship_to_patient and expiration timestamp.
 * Returns { data, error } based strictly on Supabase's actual response.
 */
export async function createBloodRequestInDB(req) {
  if (!isSupabaseConfigured()) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Blood request could not be saved.'),
    };
  }

  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return {
        data: null,
        error: new Error('Authentication session expired. Please sign in again to submit a blood request.'),
      };
    }

    const boundUserId = authUser.id || req.userId || null;
    const boundEmail = authUser.email || req.email;

    const payload = {
      id: req.id,
      user_id: boundUserId,
      initials: req.initials || req.bloodType,
      patient_name: req.patientName,
      age: req.age,
      blood_type: req.bloodType,
      units_needed: req.unitsNeeded,
      urgency: req.urgency,
      condition: req.condition && req.condition.trim() ? req.condition.trim() : null,
      hospital_id: req.hospitalId,
      hospital_name: req.hospitalName,
      relationship_to_patient: req.relationshipToPatient || null,
      contact_number: req.contactNumber,
      email: boundEmail,
      emergency_contact: req.emergencyContact,
      doctor_slip_url: req.doctorSlipUrl || null,
      medical_receipt_no: req.medicalReceiptNo || null,
      medical_receipt_date: req.receiptDate || null,
      medical_receipt_payor: req.receiptPayor || null,
      medical_receipt_services: req.receiptServices || null,
      is_anonymous: req.isAnonymous || false,
      status: req.status || 'Pending',
      expires_at: req.expiresAt,
      is_archived: req.isArchived || false,
      archived_reason: req.archivedReason || null,
      archived_at: req.archivedAt || null,
      posted_time: new Date().toISOString(),
    };

    let { data, error } = await supabase.from('blood_requests').insert([payload]).select();

    // Graceful fallback if the database migration adding relationship_to_patient has not been executed yet
    if (error && error.message && error.message.includes('relationship_to_patient')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.relationship_to_patient;
      const retryRes = await supabase.from('blood_requests').insert([fallbackPayload]).select();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error || !Array.isArray(data) || data.length === 0) {
      console.error('[Supabase] Error inserting blood request:', error?.message);
      return {
        data: null,
        error: new Error(formatSupabaseError(error, 'Failed to save blood request to Supabase.')),
      };
    }

    const savedRow = data[0];

    // Asynchronously trigger blood-type email notifications for opted-in users after confirmed DB insert
    triggerBloodRequestNotificationsInDB(savedRow).catch((notifyErr) => {
      console.warn('[Blood Type Notification Dispatch Warning]', notifyErr);
    });

    return {
      data: savedRow,
      rows: data,
      error: null,
    };
  } catch (err) {
    console.error('[Supabase createBloodRequest]', err);
    return {
      data: null,
      error: new Error(formatSupabaseError(err, 'An unexpected error occurred while saving your blood request.')),
    };
  }
}

export async function archiveRequestInDB(requestId, reason = 'user_removed') {
  if (!isSupabaseConfigured()) return null;

  try {
    const nowIso = new Date().toISOString();
    let query = supabase
      .from('blood_requests')
      .update({
        is_archived: true,
        status: 'Archived',
        archived_reason: reason,
        archived_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', requestId);

    if (reason === 'user_removed') {
      const authUser = await getCurrentUser();
      if (!authUser || !authUser.email) {
        console.error('[Supabase] Unauthorized attempt to archive request without authentication.');
        return null;
      }
      query = query.ilike('email', authUser.email.trim());
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('[Supabase] Error archiving request:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase archiveRequestInDB]', err);
    return null;
  }
}

/**
 * Update the verification status of a patient request (strictly Healthcare Worker / Webpage Admin)
 */
export async function updateBloodRequestStatus(requestId, status, verifiedByName = null) {
  if (!isSupabaseConfigured()) return null;

  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      console.error('[Supabase] Unauthorized status update: Not authenticated.');
      return null;
    }
    const callerProfile = await fetchUserProfileFromDB(authUser.id, authUser.email);
    const callerRole = normalizeRole(callerProfile?.role || authUser.user_metadata?.role || 'Donor');
    if (callerRole !== 'Healthcare Worker' && callerRole !== 'Webpage Admin') {
      console.error('[Supabase] Unauthorized status update: Caller role is not Healthcare Worker or Webpage Admin.');
      return null;
    }

    const updatePayload = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (verifiedByName) {
      updatePayload.verified_by_name = verifiedByName;
    }

    const { data, error } = await supabase
      .from('blood_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select();

    if (error) {
      console.error('[Supabase] Error updating request status:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase updateBloodRequestStatus]', err);
    return null;
  }
}

/**
 * Webpage Admin-controlled creation of Healthcare Worker & Webpage Admin accounts.
 * Webpage Admin accounts do not require or store hospital / hospital_id associations.
 */
export async function adminCreateHealthcareWorkerAccount({
  username,
  email,
  password,
  contactNumber,
  role = 'Healthcare Worker',
  hospital = null,
  hospitalId = null,
  licenseNumber = null,
}) {
  const normalizedRole = normalizeRole(role);
  const isWebpageAdmin = normalizedRole === 'Webpage Admin';
  const finalHospital = isWebpageAdmin ? null : hospital || null;
  const finalHospitalId = isWebpageAdmin ? null : hospitalId || null;

  if (!isSupabaseConfigured()) {
    return {
      data: {
        id: `staff-${Date.now()}`,
        username,
        email,
        contactNumber,
        role: normalizedRole,
        hospital: finalHospital || '',
        hospitalId: finalHospitalId || '',
        licenseNumber: licenseNumber || '',
        createdAt: new Date().toISOString(),
        status: 'Active',
      },
      error: null,
    };
  }

  // Check Webpage Admin authorization
  try {
    let isWebpageAdminCaller = false;
    const authUser = await getCurrentUser();
    if (authUser) {
      const callerProfile = await fetchUserProfileFromDB(authUser.id, authUser.email);
      const callerRole = normalizeRole(callerProfile?.role || authUser.user_metadata?.role || 'Donor');
      if (callerRole === 'Webpage Admin') {
        isWebpageAdminCaller = true;
      }
    }

    // If Supabase session is not yet verified or active, verify via client active session
    if (!isWebpageAdminCaller) {
      try {
        const stored = localStorage.getItem('bloodsync_active_session_user');
        if (stored) {
          const sess = JSON.parse(stored);
          if (sess?.isLoggedIn && normalizeRole(sess.role) === 'Webpage Admin') {
            isWebpageAdminCaller = true;
          }
        }
      } catch {}
    }

    if (!isWebpageAdminCaller) {
      return {
        data: null,
        error: new Error('Access Denied: Only authenticated Webpage Admins may provision staff accounts.'),
      };
    }

    // Attempt RPC if caller has active Supabase token
    if (authUser) {
      try {
        const { data, error } = await supabase.rpc('admin_create_healthcare_worker', {
          p_username: username,
          p_email: email,
          p_password: password,
          p_contact_number: contactNumber,
          p_role: normalizedRole,
          p_hospital: finalHospital,
          p_hospital_id: finalHospitalId,
          p_license_number: licenseNumber || null,
        });

        if (!error && data) {
          const createdStaff = {
            id: data.user_id || `staff-${Date.now()}`,
            username,
            email: email.trim().toLowerCase(),
            contactNumber,
            role: normalizedRole,
            hospital: finalHospital || '',
            hospitalId: finalHospitalId || '',
            licenseNumber: licenseNumber || '',
            createdAt: new Date().toISOString(),
            status: 'Active',
          };
          saveLocalRegisteredUser(createdStaff);
          return { data: createdStaff, error: null };
        }
      } catch (rpcErr) {
        console.warn('[admin_create_healthcare_worker RPC Warning]', rpcErr);
      }
    }

    // Direct insertion into public.profiles
    const newStaffId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}`;
    const staffRow = {
      id: newStaffId,
      username,
      email: email.trim().toLowerCase(),
      contact_number: contactNumber,
      role: normalizedRole,
      hospital: finalHospital,
      hospital_id: finalHospitalId,
      license_number: licenseNumber || null,
    };

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert(staffRow)
      .select();

    const resultStaff = {
      id: profileData?.[0]?.id || newStaffId,
      username,
      email: email.trim().toLowerCase(),
      contactNumber,
      role: normalizedRole,
      hospital: finalHospital || '',
      hospitalId: finalHospitalId || '',
      licenseNumber: licenseNumber || '',
      createdAt: new Date().toISOString(),
      status: 'Active',
    };

    saveLocalRegisteredUser(resultStaff);
    if (profileError) {
      console.warn('[Staff Profile Upsert Warning]', profileError);
    }
    return { data: resultStaff, error: null };
  } catch (err) {
    console.error('[Supabase adminCreateHealthcareWorkerAccount]', err);
    return { data: null, error: err };
  }
}

export function subscribeToNewRequests(onChange) {
  if (!isSupabaseConfigured()) return null;

  const channel = supabase
    .channel('realtime:blood_requests')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'blood_requests' },
      (payload) => {
        if (payload?.new) {
          payload.new = sanitizePublicBloodRequestRow(payload.new);
        }
        onChange(payload);
      }
    )
    .subscribe();

  return channel;
}

/* ==========================================================================
   DATABASE APIS: DONATION EVENTS & DRIVE BOOKINGS
   ========================================================================== */

export async function archiveExpiredEventsInDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    const nowIso = new Date().toISOString();
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('archive_expired_donation_events');
      if (!rpcError) return rpcData;
    } catch {}

    const { data: events, error } = await supabase
      .from('donation_events')
      .select('id, date, time, is_archived')
      .eq('is_archived', false);

    if (error || !events) return null;

    const now = Date.now();
    const expiredIds = events
      .filter((evt) => {
        const parsed = parseEventDateTime(evt.date, evt.time);
        return parsed && parsed.getTime() < now;
      })
      .map((evt) => evt.id);

    if (expiredIds.length > 0) {
      await supabase
        .from('donation_events')
        .update({
          is_archived: true,
          status: 'Archived',
          archived_at: nowIso,
        })
        .in('id', expiredIds);
    }
    return expiredIds;
  } catch (err) {
    console.warn('[Supabase archiveExpiredEventsInDB]', err);
    return null;
  }
}

/**
 * Remove / Archive a donation event drive by authorized users (Webpage Admin or Healthcare Worker creator)
 */
export async function removeEventInDB(eventId) {
  if (!isSupabaseConfigured()) {
    return { data: { id: eventId }, error: null };
  }

  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return { data: null, error: new Error('Authentication required to remove an event drive.') };
    }
    const callerProfile = await fetchUserProfileFromDB(authUser.id, authUser.email);
    const callerRole = normalizeRole(callerProfile?.role || authUser.user_metadata?.role || 'Donor');
    if (callerRole !== 'Healthcare Worker' && callerRole !== 'Webpage Admin') {
      return {
        data: null,
        error: new Error('Unauthorized role: Only Healthcare Workers or Webpage Admins can remove event drives.'),
      };
    }

    const nowIso = new Date().toISOString();
    let query = supabase
      .from('donation_events')
      .update({
        is_archived: true,
        status: 'Archived',
        archived_at: nowIso,
      })
      .eq('id', eventId);

    if (callerRole !== 'Webpage Admin') {
      query = query.ilike('created_by_email', authUser.email.trim());
    }

    const { data, error } = await query.select();

    if (error) {
      const { error: delError } = await supabase.from('donation_events').delete().eq('id', eventId);
      if (delError) return { data: null, error: delError };
      return { data: { id: eventId }, error: null };
    }
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase removeEventInDB]', err);
    return { data: null, error: err };
  }
}

export function parseEventDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return new Date(dateStr);
    }
    const cleaned = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*/i, '');
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      if (timeStr && timeStr.includes('-')) {
        const parts = timeStr.split('-');
        const endPart = parts[parts.length - 1].trim();
        const timeMatch = endPart.match(/(\d+):?(\d*)\s*(AM|PM)/i);
        if (timeMatch) {
          let h = parseInt(timeMatch[1], 10);
          const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          const meridian = timeMatch[3].toUpperCase();
          if (meridian === 'PM' && h < 12) h += 12;
          if (meridian === 'AM' && h === 12) h = 0;
          d.setHours(h, m, 0, 0);
        }
      }
      return d;
    }
  } catch {}
  return null;
}

export async function fetchEventsFromDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    await archiveExpiredEventsInDB();

    const { data, error } = await supabase
      .from('donation_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error fetching donation events:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase fetchEvents]', err);
    return null;
  }
}

export async function createEventInDB(event) {
  if (!isSupabaseConfigured()) return null;

  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      console.error('[Supabase] Unauthorized event creation: Not authenticated.');
      return null;
    }
    const callerProfile = await fetchUserProfileFromDB(authUser.id, authUser.email);
    const callerRole = normalizeRole(callerProfile?.role || authUser.user_metadata?.role || 'Donor');
    if (callerRole !== 'Healthcare Worker' && callerRole !== 'Webpage Admin') {
      console.error('[Supabase] Unauthorized event creation: Caller role is not authorized.');
      return null;
    }

    const { data, error } = await supabase.from('donation_events').insert([
      {
        id: event.id,
        title: event.title,
        organizer: event.organizer,
        location: event.location,
        municipality: event.municipality || 'Cavite City, Cavite',
        contact_details: event.contactDetails || '',
        date: event.date,
        time: event.time,
        link: event.link || '',
        status: event.status || 'Active',
        is_archived: false,
        created_by: authUser.id || event.createdBy || null,
        created_by_email: authUser.email || event.creatorEmail || null,
      },
    ]);

    if (error) {
      console.error('[Supabase] Error inserting donation event:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase createEventInDB]', err);
    return null;
  }
}

export async function bookEventSlotInDB({ eventId, name, email, phone, bloodType, timeSlot }) {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase.from('event_bookings').insert([
      {
        event_id: eventId,
        donor_name: name,
        donor_email: email,
        donor_phone: phone,
        donor_blood_type: bloodType,
        time_slot: timeSlot,
      },
    ]);

    if (error) {
      console.error('[Supabase] Error booking event slot:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase bookEventSlot]', err);
    return null;
  }
}

export function subscribeToEvents(onUpdate) {
  if (!isSupabaseConfigured()) return null;

  return supabase
    .channel('realtime:donation_events')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'donation_events' },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();
}
