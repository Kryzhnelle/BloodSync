/**
 * BloodSync - Supabase Client & Realtime API Helper Module
 *
 * HOW TO CONNECT YOUR REAL SUPABASE DATABASE:
 * 1. Go to https://supabase.com and create a free project.
 * 2. Go to Project Settings -> API.
 * 3. Copy your "Project URL" and "anon public key".
 * 4. Paste them into your .env file:
 *      VITE_SUPABASE_URL="https://your-project.supabase.co"
 *      VITE_SUPABASE_ANON_KEY="your-anon-key"
 *    (Alternatively, you can save them in localStorage: 'bloodsync_supabase_url' and 'bloodsync_supabase_key')
 * 5. Run the SQL script from `supabase-schema.sql` in your Supabase SQL Editor.
 */

import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const localUrl = typeof window !== 'undefined' ? localStorage.getItem('bloodsync_supabase_url') || '' : '';
const localKey = typeof window !== 'undefined' ? localStorage.getItem('bloodsync_supabase_key') || '' : '';

export const supabaseUrl = (localUrl && !localUrl.includes('your-project-id')) ? localUrl : envUrl;
export const supabaseAnonKey = (localKey && !localKey.includes('your-supabase-anon-key')) ? localKey : envKey;

// Helper to check if user has set real Supabase credentials
export function isSupabaseConfigured() {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-supabase-anon-key')
  );
}

// Initialize Supabase Client
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/* ==========================================================================
   AUTHENTICATION & PROFILE APIS
   ========================================================================== */

// Local fallback store for registered profiles (ensures credentials persist across sessions)
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
    const list = getLocalRegisteredUsers().filter((u) => u.email !== userProfile.email);
    list.push(userProfile);
    localStorage.setItem('bloodsync_registered_users', JSON.stringify(list));
  } catch (e) {
    console.warn('[LocalStorage User Save]', e);
  }
}

/**
 * Register a new user with email & password and create their profile record in Supabase.
 * @param {Object} userData - { email, password, username, contactNumber, bloodType, role, hospital }
 */
export async function signUpUser({ email, password, username, contactNumber, bloodType = 'O+', role = 'Donor', hospital = '' }) {
  // Always cache locally so profile info persists immediately
  const localProfile = {
    id: `usr-${Date.now()}`,
    email,
    username,
    contactNumber,
    bloodType,
    role,
    hospital,
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Keys not configured. Operating in local mode.');
    saveLocalRegisteredUser(localProfile);
    return {
      data: {
        user: { id: localProfile.id, email, user_metadata: { username, contactNumber, bloodType, role, hospital } },
      },
      profile: localProfile,
      error: null,
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        contact_number: contactNumber,
        blood_type: bloodType,
        role,
        hospital,
      },
    },
  });

  if (error) return { data: null, profile: null, error };

  const userId = data?.user?.id || localProfile.id;
  localProfile.id = userId;
  saveLocalRegisteredUser(localProfile);

  // Insert or update profile row in public.profiles table
  if (data?.user) {
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
        email,
        contact_number: contactNumber,
        blood_type: bloodType,
        role,
        hospital,
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
  // Check local store first as fallback
  const localList = getLocalRegisteredUsers();
  const localMatch = localList.find((u) => (userId && u.id === userId) || (email && u.email === email));

  if (!isSupabaseConfigured()) {
    return localMatch || null;
  }

  try {
    let query = supabase.from('profiles').select('*');
    if (userId) {
      query = query.eq('id', userId);
    } else if (email) {
      query = query.eq('email', email);
    }
    const { data, error } = await query.single();
    if (error || !data) {
      return localMatch || null;
    }
    return {
      id: data.id,
      username: data.username,
      email: data.email,
      contactNumber: data.contact_number,
      bloodType: data.blood_type || 'O+',
      role: data.role || 'Donor',
      hospital: data.hospital || '',
      hospitalId: data.hospital_id || '',
    };
  } catch (err) {
    console.warn('[Supabase fetchUserProfileFromDB]', err);
    return localMatch || null;
  }
}

/**
 * Sign in an existing user with email and password and load their profile record.
 * @param {Object} credentials - { email, password }
 */
export async function signInUser({ email, password }) {
  const localList = getLocalRegisteredUsers();
  const localMatch = localList.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Keys not configured. Operating in local mode.');
    const userProfile = localMatch || {
      id: `usr-${Date.now()}`,
      username: email.split('@')[0],
      email,
      contactNumber: '09123456789',
      bloodType: 'O+',
      role: 'Donor',
      hospital: '',
    };
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
      profile = {
        id: data.user.id,
        username: meta.username || email.split('@')[0],
        email: data.user.email,
        contactNumber: meta.contact_number || '09123456789',
        bloodType: meta.blood_type || 'O+',
        role: meta.role || 'Donor',
        hospital: meta.hospital || '',
      };
    }
  }

  return { data, profile: profile || localMatch, error: null };
}

/**
 * Sign out the current authenticated user.
 */
export async function signOutUser() {
  if (!isSupabaseConfigured()) return { error: null };
  return await supabase.auth.signOut();
}

/**
 * Get the currently authenticated user from active session.
 */
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

/**
 * Subscribe to Supabase Auth state changes (login, logout, token refresh).
 * @param {Function} callback - Called with (event, session)
 */
export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured()) return { unsubscribe: () => {} };
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return listener.subscription;
}

/* ==========================================================================
   DATABASE APIS: HOSPITALS & INVENTORY
   ========================================================================== */

/**
 * Fetch all accredited hospitals from Supabase
 */
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
 * Update hospital blood inventory in Supabase
 */
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

/**
 * Real-time subscription to hospital inventory changes
 */
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

/**
 * Automatically archive all requests whose expiration cutoff has passed.
 * Sets is_archived = true, status = 'Archived', archived_reason = 'automatically_expired'.
 */
export async function archiveExpiredRequestsInDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    const nowIso = new Date().toISOString();
    // 1. Prefer database trigger/procedure if installed
    const { data: rpcData, error: rpcError } = await supabase.rpc('archive_expired_blood_requests');
    if (!rpcError) return rpcData;

    // 2. Direct client fallback update query
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
 * Fetch all urgent requests from Supabase (runs expiration cleanup first)
 */
export async function fetchRequestsFromDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    // Automatically archive any expired requests first
    await archiveExpiredRequestsInDB();

    const { data, error } = await supabase
      .from('blood_requests')
      .select('*')
      .order('posted_time', { ascending: false });

    if (error) {
      console.error('[Supabase] Error fetching blood requests:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase fetchRequests]', err);
    return null;
  }
}

/**
 * Post a new urgent blood request to Supabase including required expiration timestamp
 * @param {Object} req - Request object matching schema
 */
export async function createBloodRequestInDB(req) {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase.from('blood_requests').insert([
      {
        id: req.id,
        user_id: req.userId || null,
        initials: req.initials || req.bloodType,
        patient_name: req.patientName,
        age: req.age,
        blood_type: req.bloodType,
        units_needed: req.unitsNeeded,
        urgency: req.urgency,
        condition: req.condition,
        hospital_id: req.hospitalId,
        hospital_name: req.hospitalName,
        contact_number: req.contactNumber,
        email: req.email,
        emergency_contact: req.emergencyContact,
        medical_receipt_no: req.medicalReceiptNo,
        medical_receipt_amount: req.receiptAmount,
        medical_receipt_date: req.receiptDate,
        medical_receipt_payor: req.receiptPayor,
        medical_receipt_services: req.receiptServices,
        medical_receipt_status: req.receiptStatus || 'Paid',
        status: req.status || 'Pending',
        expires_at: req.expiresAt,
        is_archived: req.isArchived || false,
        archived_reason: req.archivedReason || null,
        archived_at: req.archivedAt || null,
        posted_time: new Date().toISOString(),
      },
    ]);

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

/**
 * Manually or automatically archive a request
 * @param {string} requestId
 * @param {'automatically_expired'|'user_removed'} reason
 */
export async function archiveRequestInDB(requestId, reason = 'user_removed') {
  if (!isSupabaseConfigured()) return null;

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('blood_requests')
      .update({
        is_archived: true,
        status: 'Archived',
        archived_reason: reason,
        archived_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', requestId)
      .select();

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
 * Update the verification status of a patient request (e.g. Healthcare Worker approval)
 */
export async function updateBloodRequestStatus(requestId, status, verifiedByName = null) {
  if (!isSupabaseConfigured()) return null;

  try {
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
 * Admin-controlled creation of Healthcare Worker & Hospital Admin accounts.
 * Executes through secure database procedure `admin_create_healthcare_worker`
 * which verifies caller authorization in PostgreSQL without exposing service-role keys.
 */
export async function adminCreateHealthcareWorkerAccount({
  username,
  email,
  password,
  contactNumber,
  role = 'Healthcare Worker',
  hospital,
  hospitalId,
  licenseNumber,
}) {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Operating in local mock mode.');
    return {
      data: {
        id: `staff-${Date.now()}`,
        username,
        email,
        contactNumber,
        role,
        hospital,
        hospitalId,
        licenseNumber,
        createdAt: new Date().toISOString(),
        status: 'Active',
      },
      error: null,
    };
  }

  try {
    // Call PostgreSQL SECURITY DEFINER procedure with caller authorization check
    const { data, error } = await supabase.rpc('admin_create_healthcare_worker', {
      p_username: username,
      p_email: email,
      p_password: password,
      p_contact_number: contactNumber,
      p_role: role,
      p_hospital: hospital,
      p_hospital_id: hospitalId,
      p_license_number: licenseNumber,
    });

    if (error) {
      // Fallback: create through profiles table if RPC not yet deployed
      const { data: profileData, error: profileError } = await supabase.from('profiles').insert([
        {
          username,
          email,
          contact_number: contactNumber,
          role,
          hospital,
          hospital_id: hospitalId,
          license_number: licenseNumber,
        },
      ]).select();

      if (profileError) return { data: null, error: profileError };
      return { data: profileData?.[0], error: null };
    }

    return { data, error: null };
  } catch (err) {
    console.error('[Supabase adminCreateHealthcareWorkerAccount]', err);
    return { data: null, error: err };
  }
}

/**
 * Real-time subscription to new incoming or updated blood requests
 * @param {Function} onChange - Callback triggered when a request is inserted or updated
 */
export function subscribeToNewRequests(onChange) {
  if (!isSupabaseConfigured()) return null;

  const channel = supabase
    .channel('realtime:blood_requests')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'blood_requests' },
      (payload) => {
        onChange(payload);
      }
    )
    .subscribe();

  return channel;
}

/* ==========================================================================
   DATABASE APIS: DONATION EVENTS & DRIVE BOOKINGS
   ========================================================================== */

/**
 * Automatically archive all donation event drives whose scheduled date/time has passed.
 */
export async function archiveExpiredEventsInDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    const nowIso = new Date().toISOString();
    // 1. Try RPC procedure if installed
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('archive_expired_donation_events');
      if (!rpcError) return rpcData;
    } catch {}

    // 2. Client query check for events with scheduled_date or date
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
 * Remove / Archive a donation event drive by authorized users (Admin or Healthcare Worker)
 * @param {string} eventId
 */
export async function removeEventInDB(eventId) {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Removing event in local mode:', eventId);
    return { data: { id: eventId }, error: null };
  }

  try {
    const nowIso = new Date().toISOString();
    // Soft-archive the event drive
    const { data, error } = await supabase
      .from('donation_events')
      .update({
        is_archived: true,
        status: 'Archived',
        archived_at: nowIso,
      })
      .eq('id', eventId)
      .select();

    if (error) {
      // If column doesn't exist yet, delete the record directly
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

/**
 * Helper to parse various event date & time formats
 */
export function parseEventDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    // If dateStr is an ISO string or YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return new Date(dateStr);
    }
    // E.g., "Saturday, Sep 26, 2026" or "Sep 26, 2026"
    const cleaned = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*/i, '');
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      // If time string exists, try to extract end time or start time (e.g., "8:00 AM - 3:00 PM")
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

/**
 * Fetch donation events from Supabase (runs expiration cleanup first)
 */
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

/**
 * Create a new mobile donation event drive (matching 2.svg Event Registration)
 */
export async function createEventInDB(event) {
  if (!isSupabaseConfigured()) return null;

  try {
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
        total_slots: event.totalSlots || 50,
        slots_remaining: event.slotsRemaining || 35,
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

/**
 * Book an appointment slot for a mobile donation drive
 */
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

/**
 * Real-time subscription to donation event slot changes
 */
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
