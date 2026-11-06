import { createClient } from '@supabase/supabase-js';
import { maskName, normalizePhoneNumber } from './functions/contact-utils.js';

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
 * Register a new user with email & password and create their profile record in Supabase.
 * Public registrations are strictly restricted to Donor role.
 * Converts duplicate registration errors to "Email already registered".
 */
export async function signUpUser({
  email,
  password,
  username,
  contactNumber,
  bloodType = 'O+',
  role = 'Donor',
  hospital = '',
}) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const safeRole = 'Donor'; // Ordinary users cannot self-assign Webpage Admin or Healthcare Worker

  const localProfile = {
    id: `usr-${Date.now()}`,
    email: normalizedEmail,
    username,
    contactNumber,
    bloodType,
    role: safeRole,
    hospital: '',
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    const existingLocal = getLocalRegisteredUsers().find(
      (u) => u.email && u.email.toLowerCase() === normalizedEmail
    );
    if (existingLocal) {
      return {
        data: null,
        profile: null,
        error: new Error('Email already registered'),
      };
    }
    saveLocalRegisteredUser(localProfile);
    return {
      data: {
        user: {
          id: localProfile.id,
          email: normalizedEmail,
          user_metadata: { username, contactNumber, bloodType, role: safeRole, hospital: '' },
        },
      },
      profile: localProfile,
      error: null,
    };
  }

  // Check if email already exists in public.profiles
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

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        username,
        contact_number: contactNumber,
        blood_type: bloodType,
        role: safeRole,
        hospital: '',
      },
    },
  });

  if (error) {
    const rawMsg = error.message || '';
    if (/user already registered|email already registered|already been registered/i.test(rawMsg)) {
      return {
        data: null,
        profile: null,
        error: new Error('Email already registered'),
      };
    }
    return { data: null, profile: null, error };
  }

  // Supabase Auth returns an empty identities array when email confirmation is enabled and the email is already registered
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      data: null,
      profile: null,
      error: new Error('Email already registered'),
    };
  }

  const userId = data?.user?.id || localProfile.id;
  localProfile.id = userId;
  saveLocalRegisteredUser(localProfile);

  // Insert or update profile row in public.profiles table
  if (data?.user) {
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
        email: normalizedEmail,
        contact_number: contactNumber,
        blood_type: bloodType,
        role: safeRole,
        hospital: null,
        hospital_id: null,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[Supabase Profile Upsert]', e);
    }
  }

  return { data, profile: localProfile, error: null };
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
      }
      return localMatch || null;
    }

    const resolvedRole = normalizeRole(data.role);
    const isWebpageAdmin = resolvedRole === 'Webpage Admin';

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
    };
  } catch (err) {
    console.warn('[Supabase fetchUserProfileFromDB]', err);
    return localMatch || null;
  }
}

/**
 * Sign in an existing user with email and password and load their profile record.
 */
export async function signInUser({ email, password }) {
  const localList = getLocalRegisteredUsers();
  const localMatch = localList.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());

  if (!isSupabaseConfigured()) {
    const userProfile = localMatch || {
      id: `usr-${Date.now()}`,
      username: email.split('@')[0],
      email,
      contactNumber: '09123456789',
      bloodType: 'O+',
      role: 'Donor',
      hospital: '',
    };
    userProfile.role = normalizeRole(userProfile.role);
    if (userProfile.role === 'Webpage Admin') {
      userProfile.hospital = '';
      userProfile.hospitalId = '';
    }
    return {
      data: {
        user: { id: userProfile.id, email, user_metadata: userProfile },
      },
      profile: userProfile,
      error: null,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { data: null, profile: null, error };

  let profile = null;
  if (data?.user) {
    profile = await fetchUserProfileFromDB(data.user.id, data.user.email);
    if (!profile && data.user.user_metadata) {
      const meta = data.user.user_metadata;
      const resolvedRole = normalizeRole(meta.role);
      const isWebpageAdmin = resolvedRole === 'Webpage Admin';
      profile = {
        id: data.user.id,
        username: meta.username || email.split('@')[0],
        email: data.user.email,
        contactNumber: meta.contact_number || '',
        bloodType: meta.blood_type || 'O+',
        role: resolvedRole,
        hospital: isWebpageAdmin ? '' : meta.hospital || '',
        hospitalId: isWebpageAdmin ? '' : meta.hospital_id || '',
        licenseNumber: meta.license_number || '',
      };
    }
  }

  return { data, profile: profile || localMatch, error: null };
}

/**
 * Update authenticated user's profile information in Supabase (username, contact_number, blood_type, hospital, license_number).
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
    const localList = getLocalRegisteredUsers();
    const matchIdx = localList.findIndex((u) => u.id === userId);
    if (matchIdx !== -1) {
      localList[matchIdx] = {
        ...localList[matchIdx],
        username: safeUpdates.username ?? localList[matchIdx].username,
        contactNumber: safeUpdates.contact_number ?? localList[matchIdx].contactNumber,
        bloodType: safeUpdates.blood_type ?? localList[matchIdx].bloodType,
        hospital: safeUpdates.hospital ?? localList[matchIdx].hospital,
        licenseNumber: safeUpdates.license_number ?? localList[matchIdx].licenseNumber,
      };
      saveLocalRegisteredUsers(localList);
    }
    return {
      data: {
        id: userId,
        username: safeUpdates.username,
        contactNumber: safeUpdates.contact_number,
        bloodType: safeUpdates.blood_type,
        hospital: safeUpdates.hospital || '',
        licenseNumber: safeUpdates.license_number || '',
      },
      error: null,
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

    // 1. Update public.profiles by authenticated user ID
    let updatedRow = null;
    let dbError = null;

    const resById = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', authUser.id)
      .select();

    if (resById.error) {
      dbError = resById.error;
    } else if (Array.isArray(resById.data) && resById.data.length > 0) {
      updatedRow = resById.data[0];
    }

    // 2. If profile row was keyed by email (e.g. seeded or provisioned staff record), update by email
    if (!updatedRow && authUser.email) {
      const resByEmail = await supabase
        .from('profiles')
        .update(safeUpdates)
        .ilike('email', authUser.email.trim())
        .select();

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
      const resUpsert = await supabase
        .from('profiles')
        .upsert(upsertPayload)
        .select();

      if (resUpsert.error) {
        dbError = resUpsert.error;
      } else if (Array.isArray(resUpsert.data) && resUpsert.data.length > 0) {
        updatedRow = resUpsert.data[0];
      }
    }

    if (dbError) {
      console.error('[Supabase updateUserProfileInDB] error:', dbError.message);
      return { data: null, error: dbError };
    }

    // 4. Keep Supabase Auth user_metadata in sync
    try {
      await supabase.auth.updateUser({
        data: {
          username: safeUpdates.username,
          contact_number: safeUpdates.contact_number,
          blood_type: safeUpdates.blood_type,
          hospital: currentRole === 'Webpage Admin' ? '' : safeUpdates.hospital || '',
          license_number: safeUpdates.license_number || '',
        },
      });
    } catch (metaErr) {
      console.warn('[Supabase Auth Metadata Sync]', metaErr);
    }

    // 5. Re-fetch the confirmed profile from the database
    const refreshedProfile = await fetchUserProfileFromDB(authUser.id, authUser.email);
    const confirmedProfile = refreshedProfile || {
      id: updatedRow?.id || authUser.id,
      username: updatedRow?.username ?? safeUpdates.username,
      email: updatedRow?.email ?? authUser.email,
      contactNumber: updatedRow?.contact_number ?? safeUpdates.contact_number,
      bloodType: updatedRow?.blood_type ?? safeUpdates.blood_type,
      role: currentRole,
      hospital: currentRole === 'Webpage Admin' ? '' : updatedRow?.hospital ?? safeUpdates.hospital ?? '',
      hospitalId: currentRole === 'Webpage Admin' ? '' : updatedRow?.hospital_id ?? '',
      licenseNumber: updatedRow?.license_number ?? safeUpdates.license_number ?? '',
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
    return { data: null, error: err };
  }
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
 * Post a new urgent blood request to Supabase including relationship_to_patient and expiration timestamp
 */
export async function createBloodRequestInDB(req) {
  if (!isSupabaseConfigured()) return null;

  try {
    const authUser = await getCurrentUser();
    const boundUserId = authUser?.id || req.userId || null;
    const boundEmail = authUser?.email || req.email;

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

    if (error) {
      console.error('[Supabase] Error inserting blood request:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase createBloodRequest]', err);
    return null;
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
