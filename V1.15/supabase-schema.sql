-- ==============================================================================
-- BloodSync: Philippine Community Blood Network - Complete Supabase Schema
-- Clean idempotent rebuild with automated drop order, RLS & Realtime protection
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 0. CLEAN DROP EXISTING TABLES, VIEWS, FUNCTIONS & TRIGGERS
-- Drops in reverse foreign-key dependency order with CASCADE to ensure clean reset
-- ==============================================================================
DROP VIEW IF EXISTS public.hospital_blood_needs_view CASCADE;
DROP VIEW IF EXISTS public.active_donation_events CASCADE;
DROP VIEW IF EXISTS public.active_blood_requests CASCADE;

DROP TABLE IF EXISTS public.event_bookings CASCADE;
DROP TABLE IF EXISTS public.donation_events CASCADE;
DROP TABLE IF EXISTS public.blood_requests CASCADE;
DROP TABLE IF EXISTS public.hospital_blood_inventory CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.hospitals CASCADE;

DROP FUNCTION IF EXISTS public.handle_event_booking_inserted() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_blood_request_ownership() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_profile_role_rules() CASCADE;
DROP FUNCTION IF EXISTS public.sync_hospital_blood_needed() CASCADE;
DROP FUNCTION IF EXISTS public.recalculate_all_hospitals_blood_needed() CASCADE;
DROP FUNCTION IF EXISTS public.get_blood_request_contact(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.archive_expired_blood_requests() CASCADE;
DROP FUNCTION IF EXISTS public.archive_expired_donation_events() CASCADE;
DROP FUNCTION IF EXISTS public.admin_create_healthcare_worker(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

-- ==============================================================================
-- 2. TABLE DEFINITIONS
-- ==============================================================================

-- 2.1 Hospitals Directory Table
CREATE TABLE public.hospitals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    municipality TEXT NOT NULL DEFAULT 'Cavite City, Cavite',
    phone TEXT,
    email TEXT,
    schedule_weekdays TEXT DEFAULT '24 Hours',
    schedule_weekends TEXT DEFAULT '24 Hours',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    coord_x DOUBLE PRECISION DEFAULT 50,
    coord_y DOUBLE PRECISION DEFAULT 50,
    blood_needed JSONB NOT NULL DEFAULT '[]'::jsonb,
    image TEXT,
    last_updated TEXT DEFAULT 'Live',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Normalized Blood Inventory Table (Optional 3NF Relational Companion)
CREATE TABLE public.hospital_blood_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id TEXT NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    blood_type TEXT NOT NULL CHECK (blood_type IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
    units_needed INT NOT NULL DEFAULT 0 CHECK (units_needed >= 0),
    units_available INT NOT NULL DEFAULT 0 CHECK (units_available >= 0),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_hospital_blood_type UNIQUE (hospital_id, blood_type)
);

-- 2.3 User Profiles Table (Linked to Supabase Auth.users & Role Permissions)
-- Note: 'Hospital Admin' has been renamed to 'Webpage Admin' and does not require hospital or hospital_id.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT,
    email TEXT,
    contact_number TEXT,
    role TEXT NOT NULL DEFAULT 'Donor' CHECK (role IN ('Donor', 'Patient', 'Healthcare Worker', 'Webpage Admin')),
    hospital TEXT, -- Affiliated hospital for Healthcare Workers; NULL for Webpage Admin / Donors
    hospital_id TEXT REFERENCES public.hospitals(id) ON DELETE SET NULL,
    license_number TEXT, -- PRC medical license or staff ID
    blood_type TEXT,
    last_donation_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Patient Blood Appeals & Emergency Requests Table
CREATE TABLE public.blood_requests (
    id TEXT PRIMARY KEY,
    user_id UUID, -- Authenticated owner UID from auth.users / profiles
    initials TEXT,
    patient_name TEXT NOT NULL,
    age INT CHECK (age >= 0 AND age <= 130),
    blood_type TEXT NOT NULL,
    units_needed INT NOT NULL DEFAULT 1 CHECK (units_needed > 0),
    urgency TEXT NOT NULL DEFAULT 'Urgent' CHECK (urgency IN ('Critical', 'Urgent', 'Moderate')),
    condition TEXT, -- Optional medical reason / diagnosis
    hospital_id TEXT REFERENCES public.hospitals(id) ON DELETE SET NULL,
    hospital_name TEXT NOT NULL,
    relationship_to_patient TEXT, -- Emergency contact's relationship to the patient
    contact_number TEXT,
    email TEXT,
    emergency_contact TEXT,
    doctor_slip_url TEXT,
    medical_receipt_no TEXT,
    medical_receipt_date TEXT,
    medical_receipt_payor TEXT,
    medical_receipt_services TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Fulfilled', 'Cancelled', 'Archived')),
    expires_at TIMESTAMPTZ,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_reason TEXT CHECK (archived_reason IN ('automatically_expired', 'user_removed', 'fulfilled', 'cancelled')),
    archived_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_by_name TEXT,
    posted_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Mobile Donation Events / Drives Table
CREATE TABLE public.donation_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    organizer TEXT NOT NULL,
    location TEXT NOT NULL,
    municipality TEXT NOT NULL DEFAULT 'Cavite City, Cavite',
    contact_details TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    link TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by_email TEXT,
    image TEXT,
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Concluded', 'Archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 Event Time Slot Bookings Table
CREATE TABLE public.event_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL REFERENCES public.donation_events(id) ON DELETE CASCADE,
    donor_name TEXT NOT NULL,
    donor_email TEXT NOT NULL,
    donor_phone TEXT,
    donor_blood_type TEXT,
    time_slot TEXT NOT NULL,
    booking_status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (booking_status IN ('Confirmed', 'Cancelled', 'Completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. INDEXES FOR HIGH-SPEED QUERIES
-- ==============================================================================
CREATE INDEX idx_hospitals_municipality ON public.hospitals(municipality);
CREATE INDEX idx_blood_requests_urgency ON public.blood_requests(urgency);
CREATE INDEX idx_blood_requests_blood_type ON public.blood_requests(blood_type);
CREATE INDEX idx_blood_requests_hospital_id ON public.blood_requests(hospital_id);
CREATE INDEX idx_blood_requests_status ON public.blood_requests(status);
CREATE INDEX idx_blood_requests_expires_at ON public.blood_requests(expires_at);
CREATE INDEX idx_blood_requests_is_archived ON public.blood_requests(is_archived);
CREATE INDEX idx_blood_requests_user_id ON public.blood_requests(user_id);
CREATE INDEX idx_blood_requests_email ON public.blood_requests(lower(email));
CREATE INDEX idx_events_municipality ON public.donation_events(municipality);
CREATE INDEX idx_events_created_by ON public.donation_events(created_by);
CREATE INDEX idx_events_created_by_email ON public.donation_events(lower(created_by_email));
CREATE INDEX idx_event_bookings_event_id ON public.event_bookings(event_id);
CREATE INDEX idx_event_bookings_donor_email ON public.event_bookings(donor_email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(lower(email));

-- ==============================================================================
-- ==============================================================================
-- 3.0 MASKING HELPER FUNCTION FOR ANONYMOUS REQUESTS (D****e format)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.mask_person_name(p_name TEXT)
RETURNS TEXT AS $$
DECLARE
    word TEXT;
    masked_words TEXT[] := '{}';
    w_len INT;
    w_masked TEXT;
BEGIN
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN 'D****e';
    END IF;
    
    FOREACH word IN ARRAY regexp_split_to_array(trim(p_name), '\s+') LOOP
        w_len := length(word);
        IF w_len <= 1 THEN
            w_masked := word;
        ELSIF w_len = 2 THEN
            w_masked := substr(word, 1, 1) || '*';
        ELSE
            w_masked := substr(word, 1, 1) || repeat('*', GREATEST(w_len - 2, 4)) || substr(word, w_len, 1);
        END IF;
        masked_words := array_append(masked_words, w_masked);
    END LOOP;
    
    RETURN array_to_string(masked_words, ' ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================================================
-- 3.1 ACTIVE BLOOD REQUESTS SECURE VIEW (WITH ANONYMOUS PRIVACY ENFORCEMENT)
-- Excludes archived/expired/cancelled/fulfilled appeals. For anonymous requests,
-- masks requester name in D****e format and displays contact_number and email,
-- while hiding other private details (emergency_contact, relationship_to_patient, age, user_id).
-- ==============================================================================
CREATE OR REPLACE VIEW public.active_blood_requests AS
SELECT
    id,
    CASE WHEN is_anonymous THEN NULL ELSE user_id END AS user_id,
    initials,
    CASE 
        WHEN is_anonymous THEN public.mask_person_name(patient_name)
        ELSE patient_name 
    END AS patient_name,
    CASE WHEN is_anonymous THEN NULL ELSE age END AS age,
    blood_type,
    units_needed,
    urgency,
    condition,
    hospital_id,
    hospital_name,
    CASE WHEN is_anonymous THEN NULL ELSE relationship_to_patient END AS relationship_to_patient,
    contact_number,
    email,
    CASE WHEN is_anonymous THEN NULL ELSE emergency_contact END AS emergency_contact,
    doctor_slip_url,
    medical_receipt_no,
    medical_receipt_date,
    CASE WHEN is_anonymous THEN NULL ELSE medical_receipt_payor END AS medical_receipt_payor,
    medical_receipt_services,
    is_anonymous,
    status,
    expires_at,
    is_archived,
    archived_reason,
    archived_at,
    verified_by,
    verified_by_name,
    posted_time,
    created_at,
    updated_at
FROM public.blood_requests
WHERE is_archived = FALSE
  AND status IN ('Pending', 'Verified')
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY posted_time DESC;

-- 3.2 HOSPITAL BLOOD NEEDS AGGREGATION VIEW
-- Dynamically calculates total units_needed per hospital and blood_type
-- strictly from active, non-archived, non-expired blood_requests.
CREATE OR REPLACE VIEW public.hospital_blood_needs_view AS
SELECT
    hospital_id,
    hospital_name,
    blood_type,
    SUM(units_needed)::INT AS units_needed,
    COUNT(DISTINCT id)::INT AS active_request_count,
    MAX(updated_at) AS last_updated_at
FROM public.blood_requests
WHERE is_archived = FALSE
  AND status IN ('Pending', 'Verified')
  AND (expires_at IS NULL OR expires_at > NOW())
GROUP BY hospital_id, hospital_name, blood_type;

-- 3.3 ACTIVE DONATION EVENTS SECURE VIEW
CREATE OR REPLACE VIEW public.active_donation_events AS
SELECT *
FROM public.donation_events
WHERE is_archived = FALSE
  AND (status IS NULL OR status <> 'Archived')
ORDER BY created_at DESC;

-- ==============================================================================
-- 4. DATABASE TRIGGERS & AUTOMATION
-- ==============================================================================

-- 4.0 Recalculate & Synchronize Hospital blood_needed JSONB from Active Blood Requests
CREATE OR REPLACE FUNCTION public.recalculate_all_hospitals_blood_needed()
RETURNS VOID AS $$
DECLARE
    hosp RECORD;
    aggregated JSONB;
BEGIN
    FOR hosp IN SELECT id, name FROM public.hospitals LOOP
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'type', sub.blood_type,
                    'unitsNeeded', sub.total_units
                )
                ORDER BY sub.total_units DESC, sub.blood_type ASC
            ),
            '[]'::jsonb
        )
        INTO aggregated
        FROM (
            SELECT
                br.blood_type,
                SUM(br.units_needed)::INT AS total_units
            FROM public.blood_requests br
            WHERE br.is_archived = FALSE
              AND br.status IN ('Pending', 'Verified')
              AND (br.expires_at IS NULL OR br.expires_at > NOW())
              AND (
                  br.hospital_id = hosp.id
                  OR (br.hospital_id IS NULL AND lower(trim(br.hospital_name)) = lower(trim(hosp.name)))
              )
            GROUP BY br.blood_type
            HAVING SUM(br.units_needed) > 0
        ) sub;

        UPDATE public.hospitals
        SET blood_needed = aggregated,
            last_updated = TO_CHAR(NOW(), 'FM99/FM99/YY')
        WHERE id = hosp.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_hospital_blood_needed()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.recalculate_all_hospitals_blood_needed();
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sync_hospital_blood_needed
    AFTER INSERT OR UPDATE OR DELETE ON public.blood_requests
    FOR EACH STATEMENT EXECUTE FUNCTION public.sync_hospital_blood_needed();

-- 4.0.1 Automated Request Archiving Procedure
CREATE OR REPLACE FUNCTION public.archive_expired_blood_requests()
RETURNS INT AS $$
DECLARE
    affected_rows INT;
BEGIN
    UPDATE public.blood_requests
    SET is_archived = TRUE,
        status = 'Archived',
        archived_reason = 'automatically_expired',
        archived_at = NOW()
    WHERE is_archived = FALSE
      AND expires_at IS NOT NULL
      AND expires_at <= NOW();

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows > 0 THEN
        PERFORM public.recalculate_all_hospitals_blood_needed();
    END IF;
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.0.2 Automated Donation Event Archiving Procedure
CREATE OR REPLACE FUNCTION public.archive_expired_donation_events()
RETURNS INT AS $$
DECLARE
    affected_rows INT;
BEGIN
    UPDATE public.donation_events
    SET is_archived = TRUE,
        status = 'Archived',
        archived_at = NOW()
    WHERE is_archived = FALSE
      AND (
        (date ~ '^\d{4}-\d{2}-\d{2}' AND date::date < CURRENT_DATE)
      );

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.0.3 Secure Contact Lookup Function (Enforces Anonymous Request Privacy)
-- For anonymous requests:
-- - Webpage Admin & Healthcare Worker accounts: Complete unmasked original information (name, contact, email, emergency contact, relationship, condition, etc.)
-- - Normal Users (Donors & Patients): Masked name in D****e format, contact number, email, and hospital, while hiding other private details.
CREATE OR REPLACE FUNCTION public.get_blood_request_contact(p_request_id TEXT)
RETURNS JSONB AS $$
DECLARE
    req RECORD;
    caller_role TEXT := 'Donor';
    caller_id UUID;
    caller_email TEXT;
    is_staff BOOLEAN := FALSE;
    is_owner BOOLEAN := FALSE;
BEGIN
    caller_id := auth.uid();
    caller_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
    
    -- Check role of authenticated caller from profiles
    IF caller_id IS NOT NULL THEN
        SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id LIMIT 1;
    ELSIF caller_email <> '' THEN
        SELECT role INTO caller_role FROM public.profiles WHERE lower(email) = caller_email LIMIT 1;
    END IF;

    IF caller_role IN ('Webpage Admin', 'Healthcare Worker', 'Hospital Admin', 'Admin') THEN
        is_staff := TRUE;
    END IF;

    SELECT * INTO req
    FROM public.blood_requests
    WHERE id = p_request_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF (caller_id IS NOT NULL AND req.user_id = caller_id) OR 
       (caller_email <> '' AND req.email IS NOT NULL AND lower(req.email) = caller_email) THEN
        is_owner := TRUE;
    END IF;

    -- When request is marked anonymous:
    IF req.is_anonymous THEN
        -- Webpage Admin and Healthcare Worker accounts: complete unmasked original information
        IF is_staff OR is_owner THEN
            RETURN jsonb_build_object(
                'id', req.id,
                'patientName', req.patient_name,
                'age', req.age,
                'bloodType', req.blood_type,
                'unitsNeeded', req.units_needed,
                'hospitalId', req.hospital_id,
                'hospitalName', req.hospital_name,
                'condition', req.condition,
                'relationshipToPatient', req.relationship_to_patient,
                'emergencyContact', req.emergency_contact,
                'contactNumber', req.contact_number,
                'email', req.email,
                'medicalReceiptNo', req.medical_receipt_no,
                'doctorSlipUrl', req.doctor_slip_url,
                'isAnonymous', true,
                'authorizedStaffView', true,
                'isAuthorizedStaff', is_staff,
                'isOwner', is_owner
            );
        ELSE
            -- Normal Users (Donors and Patients):
            -- Masked name in D****e format, contact number, and email.
            -- Emergency contact, relationship to patient, and age remain hidden.
            RETURN jsonb_build_object(
                'id', req.id,
                'patientName', public.mask_person_name(req.patient_name),
                'bloodType', req.blood_type,
                'unitsNeeded', req.units_needed,
                'hospitalName', req.hospital_name,
                'contactNumber', req.contact_number,
                'email', req.email,
                'age', null,
                'relationshipToPatient', null,
                'emergencyContact', null,
                'isAnonymous', true,
                'authorizedStaffView', false,
                'isAuthorizedStaff', false,
                'isOwner', false
            );
        END IF;
    END IF;

    -- Non-anonymous request: return standard contact details
    RETURN jsonb_build_object(
        'id', req.id,
        'patientName', req.patient_name,
        'age', req.age,
        'bloodType', req.blood_type,
        'unitsNeeded', req.units_needed,
        'hospitalId', req.hospital_id,
        'hospitalName', req.hospital_name,
        'relationshipToPatient', req.relationship_to_patient,
        'emergencyContact', req.emergency_contact,
        'contactNumber', req.contact_number,
        'email', req.email,
        'isAnonymous', false,
        'authorizedStaffView', is_staff,
        'isAuthorizedStaff', is_staff,
        'isOwner', is_owner
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.1 Auto-update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hospitals_updated_at
    BEFORE UPDATE ON public.hospitals
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_blood_requests_updated_at
    BEFORE UPDATE ON public.blood_requests
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_donation_events_updated_at
    BEFORE UPDATE ON public.donation_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.2 Slots Registered feature removed from donation_events

-- 4.3 Enforce Profile Role Normalization & Webpage Admin Hospital Detachment
CREATE OR REPLACE FUNCTION public.enforce_profile_role_rules()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'Hospital Admin' THEN
        NEW.role := 'Webpage Admin';
    END IF;

    -- Webpage Admin accounts do not require or retain hospital or hospital_id associations
    IF NEW.role = 'Webpage Admin' THEN
        NEW.hospital := NULL;
        NEW.hospital_id := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_profile_role_rules
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_role_rules();

-- 4.4 Enforce Blood Request Ownership & Prevent Email Impersonation
CREATE OR REPLACE FUNCTION public.enforce_blood_request_ownership()
RETURNS TRIGGER AS $$
DECLARE
    jwt_email TEXT;
    caller_role TEXT;
BEGIN
    jwt_email := lower(COALESCE(auth.jwt() ->> 'email', ''));

    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL THEN
            NEW.user_id := auth.uid();
        END IF;
        IF jwt_email <> '' THEN
            NEW.email := jwt_email;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Prevent changing ownership fields (user_id or email) on existing records
        NEW.user_id := OLD.user_id;
        NEW.email := OLD.email;

        -- If request is being manually removed by a user, verify caller owns this request
        IF NEW.archived_reason = 'user_removed' AND OLD.is_archived = FALSE AND NEW.is_archived = TRUE THEN
            IF auth.uid() IS NOT NULL THEN
                IF (OLD.user_id IS NOT NULL AND OLD.user_id <> auth.uid())
                   AND (OLD.email IS NULL OR lower(OLD.email) <> jwt_email) THEN
                    RAISE EXCEPTION 'Access Denied: You can only remove blood requests belonging to your own account.';
                END IF;
            END IF;
        END IF;

        -- If status is being changed to Verified or Cancelled, require Healthcare Worker or Webpage Admin role
        IF NEW.status IN ('Verified', 'Cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
            IF auth.uid() IS NOT NULL THEN
                SELECT p.role INTO caller_role
                FROM public.profiles p
                WHERE p.id = auth.uid() OR (jwt_email <> '' AND lower(p.email) = jwt_email)
                LIMIT 1;

                IF caller_role IS DISTINCT FROM 'Healthcare Worker' AND caller_role IS DISTINCT FROM 'Webpage Admin' THEN
                    RAISE EXCEPTION 'Access Denied: Only accredited Healthcare Workers or Webpage Admins may verify or reject clinical requests.';
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_enforce_blood_request_ownership
    BEFORE INSERT OR UPDATE ON public.blood_requests
    FOR EACH ROW EXECUTE FUNCTION public.enforce_blood_request_ownership();

-- ==============================================================================
-- 5. REALTIME REPLICATION CONFIGURATION
-- Safe idempotency check using pg_publication_tables to prevent ERROR 42710
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'blood_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.blood_requests;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'hospitals'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hospitals;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'donation_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.donation_events;
    END IF;
END $$;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6.1 Hospitals & Inventory Policies
CREATE POLICY "Public read hospitals" ON public.hospitals FOR SELECT USING (true);
CREATE POLICY "Public read inventory" ON public.hospital_blood_inventory FOR SELECT USING (true);
CREATE POLICY "Allow hospital updates" ON public.hospitals FOR ALL USING (true);

-- 6.2 Blood Requests Policies
-- Public can view active blood requests; archived/private requests are isolated to their owner or authorized staff
CREATE POLICY "Public read blood requests" ON public.blood_requests 
    FOR SELECT 
    USING (
        is_archived = false 
        OR auth.uid() = user_id 
        OR (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
        OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) IN ('Healthcare Worker', 'Webpage Admin')
    );

-- Authenticated users can insert requests linked to their own user_id and authenticated email
CREATE POLICY "Authenticated users can insert own requests" ON public.blood_requests 
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (user_id IS NULL OR user_id = auth.uid())
        AND (email IS NULL OR lower(email) = lower(auth.jwt() ->> 'email'))
    );

-- Only request owners or authorized Healthcare Workers / Webpage Admins can update requests
CREATE POLICY "Owners and healthcare workers can update requests" ON public.blood_requests 
    FOR UPDATE 
    USING (
        auth.uid() = user_id
        OR (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
        OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) IN ('Healthcare Worker', 'Webpage Admin')
    )
    WITH CHECK (
        auth.uid() = user_id
        OR (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
        OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) IN ('Healthcare Worker', 'Webpage Admin')
    );

-- Only request owners can delete their own requests
CREATE POLICY "Owners can delete own requests" ON public.blood_requests 
    FOR DELETE 
    USING (
        auth.uid() = user_id
        OR (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
    );

-- 6.3 Donation Events Policies (Public can view; Only Healthcare Workers/Webpage Admins can create; Only creator or Webpage Admin can update/archive)
CREATE POLICY "Public read donation events" ON public.donation_events 
    FOR SELECT 
    USING (true);

CREATE POLICY "Authorized staff can insert events" ON public.donation_events 
    FOR INSERT 
    WITH CHECK (
        (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) IN ('Healthcare Worker', 'Webpage Admin')
    );

CREATE POLICY "Creator and admin can update events" ON public.donation_events 
    FOR UPDATE 
    USING (
        auth.uid() = created_by
        OR (created_by_email IS NOT NULL AND lower(created_by_email) = lower(auth.jwt() ->> 'email'))
        OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) = 'Webpage Admin'
    )
    WITH CHECK (
        auth.uid() = created_by
        OR (created_by_email IS NOT NULL AND lower(created_by_email) = lower(auth.jwt() ->> 'email'))
        OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) = 'Webpage Admin'
    );

CREATE POLICY "Creator and admin can delete events" ON public.donation_events 
    FOR DELETE 
    USING (
        auth.uid() = created_by
        OR (created_by_email IS NOT NULL AND lower(created_by_email) = lower(auth.jwt() ->> 'email'))
        OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) = 'Webpage Admin'
    );

-- 6.4 Event Bookings Policies
CREATE POLICY "Anyone can book event slots" ON public.event_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read bookings" ON public.event_bookings FOR SELECT USING (true);

-- 6.5 Profiles Policies (With Anti-Role-Escalation & Webpage Admin Staff Provisioning)
CREATE POLICY "Users can read profiles" ON public.profiles FOR SELECT USING (true);

-- Normal users can only register as 'Donor' unless provisioned by a Webpage Admin
CREATE POLICY "Public insert restricted to donor" ON public.profiles
    FOR INSERT
    WITH CHECK (
        (auth.uid() = id AND role = 'Donor')
        OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) = 'Webpage Admin'
    );

-- Users can update their own profile information, but cannot escalate their role
CREATE POLICY "Prevent role escalation on update" ON public.profiles
    FOR UPDATE
    USING (
        auth.uid() = id
        OR (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
        OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) = 'Webpage Admin'
    )
    WITH CHECK (
        role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1)
        OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email') LIMIT 1) = 'Webpage Admin'
    );

-- ==============================================================================
-- 6.6 SECURE WEBPAGE ADMIN STAFF PROVISIONING RPC
-- Runs with SECURITY DEFINER to create authenticated Healthcare Workers or
-- Webpage Admins without exposing service-role keys. Webpage Admins do not
-- require or store hospital / hospital_id associations.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_healthcare_worker(
    p_username TEXT,
    p_email TEXT,
    p_password TEXT,
    p_contact_number TEXT,
    p_role TEXT,
    p_hospital TEXT DEFAULT NULL,
    p_hospital_id TEXT DEFAULT NULL,
    p_license_number TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    new_user_id UUID;
    caller_role TEXT;
    normalized_role TEXT;
    final_hospital TEXT;
    final_hospital_id TEXT;
BEGIN
    -- Verify caller authorization by UID or JWT email
    SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = auth.uid() OR lower(email) = lower(auth.jwt() ->> 'email')
    LIMIT 1;

    -- Strictly reject if caller is not an authenticated Webpage Admin
    IF caller_role IS DISTINCT FROM 'Webpage Admin' THEN
        RAISE EXCEPTION 'Access Denied: Only authenticated Webpage Admins may provision staff or administrator accounts.';
    END IF;

    normalized_role := CASE
        WHEN p_role = 'Hospital Admin' OR p_role = 'Webpage Admin' THEN 'Webpage Admin'
        ELSE 'Healthcare Worker'
    END;

    -- Webpage Admin accounts do not have hospital or hospital_id associations
    IF normalized_role = 'Webpage Admin' THEN
        final_hospital := NULL;
        final_hospital_id := NULL;
    ELSE
        final_hospital := p_hospital;
        final_hospital_id := p_hospital_id;
    END IF;

    new_user_id := gen_random_uuid();

    INSERT INTO public.profiles (
        id, username, email, contact_number, role, hospital, hospital_id, license_number
    ) VALUES (
        new_user_id,
        p_username,
        lower(trim(p_email)),
        p_contact_number,
        normalized_role,
        final_hospital,
        final_hospital_id,
        p_license_number
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'username', p_username,
        'role', normalized_role,
        'hospital', final_hospital
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 6.7 ROLE-BASED ANONYMOUS BLOOD REQUEST CONTACT RETRIEVAL RPC
-- Enforces privacy rules directly at the PostgreSQL layer:
-- - Webpage Admin & Healthcare Worker: Complete unmasked original information
-- - Normal Users: Masked name in D****e format, contact number, and email.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_blood_request_contact(p_request_id TEXT)
RETURNS JSONB AS $$
DECLARE
    req RECORD;
    caller_role TEXT;
    caller_email TEXT;
    caller_id UUID;
    is_staff BOOLEAN := FALSE;
    is_owner BOOLEAN := FALSE;
    masked_name TEXT;
BEGIN
    SELECT * INTO req
    FROM public.blood_requests
    WHERE id = p_request_id
    LIMIT 1;

    IF req IS NULL THEN
        RETURN NULL;
    END IF;

    caller_id := auth.uid();
    caller_email := lower(COALESCE(auth.jwt() ->> 'email', ''));

    IF caller_id IS NOT NULL OR caller_email <> '' THEN
        SELECT p.role INTO caller_role
        FROM public.profiles p
        WHERE (caller_id IS NOT NULL AND p.id = caller_id)
           OR (caller_email <> '' AND lower(p.email) = caller_email)
        LIMIT 1;

        IF caller_role IN ('Healthcare Worker', 'Webpage Admin', 'Admin', 'Hospital Admin', 'Doctor') THEN
            is_staff := TRUE;
        END IF;

        IF (caller_id IS NOT NULL AND req.user_id = caller_id)
           OR (caller_email <> '' AND req.email IS NOT NULL AND lower(req.email) = caller_email) THEN
            is_owner := TRUE;
        END IF;
    END IF;

    IF req.is_anonymous THEN
        IF is_staff OR is_owner THEN
            -- Full unmasked original details for authorized Webpage Admin, Healthcare Worker, or Owner
            RETURN jsonb_build_object(
                'id', req.id,
                'patient_name', req.patient_name,
                'patientName', req.patient_name,
                'age', req.age,
                'blood_type', req.blood_type,
                'bloodType', req.blood_type,
                'units_needed', req.units_needed,
                'unitsNeeded', req.units_needed,
                'hospital_id', req.hospital_id,
                'hospitalId', req.hospital_id,
                'hospital_name', req.hospital_name,
                'hospitalName', req.hospital_name,
                'condition', req.condition,
                'relationship_to_patient', req.relationship_to_patient,
                'relationshipToPatient', req.relationship_to_patient,
                'emergency_contact', req.emergency_contact,
                'emergencyContact', req.emergency_contact,
                'contact_number', req.contact_number,
                'contactNumber', req.contact_number,
                'email', req.email,
                'is_anonymous', true,
                'isAnonymous', true,
                'authorizedStaffView', true,
                'isAuthorizedStaff', is_staff,
                'isOwner', is_owner
            );
        ELSE
            -- Normal Users (Donors and Patients):
            -- Mask requester name in D****e format
            -- Display requester contact number and email address
            -- Continue hiding other personal details (emergency contact, relationship, age)
            masked_name := public.mask_person_name(req.patient_name);
            RETURN jsonb_build_object(
                'id', req.id,
                'patient_name', masked_name,
                'patientName', masked_name,
                'hospital_name', req.hospital_name,
                'hospitalName', req.hospital_name,
                'blood_type', req.blood_type,
                'bloodType', req.blood_type,
                'units_needed', req.units_needed,
                'unitsNeeded', req.units_needed,
                'contact_number', req.contact_number,
                'contactNumber', req.contact_number,
                'email', req.email,
                'age', NULL,
                'emergency_contact', NULL,
                'emergencyContact', NULL,
                'relationship_to_patient', NULL,
                'relationshipToPatient', NULL,
                'is_anonymous', true,
                'isAnonymous', true,
                'authorizedStaffView', false,
                'isAuthorizedStaff', false,
                'isOwner', false
            );
        END IF;
    END IF;

    -- Non-anonymous blood request: full details
    RETURN jsonb_build_object(
        'id', req.id,
        'patient_name', req.patient_name,
        'patientName', req.patient_name,
        'age', req.age,
        'blood_type', req.blood_type,
        'bloodType', req.blood_type,
        'units_needed', req.units_needed,
        'unitsNeeded', req.units_needed,
        'hospital_id', req.hospital_id,
        'hospitalId', req.hospital_id,
        'hospital_name', req.hospital_name,
        'hospitalName', req.hospital_name,
        'relationship_to_patient', req.relationship_to_patient,
        'relationshipToPatient', req.relationship_to_patient,
        'emergency_contact', req.emergency_contact,
        'emergencyContact', req.emergency_contact,
        'contact_number', req.contact_number,
        'contactNumber', req.contact_number,
        'email', req.email,
        'is_anonymous', false,
        'isAnonymous', false,
        'authorizedStaffView', false,
        'isAuthorizedStaff', is_staff,
        'isOwner', is_owner
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. SEED DATA
-- ==============================================================================

-- 7.1 Seed Hospitals (5 Cavite Facilities with exact GPS coordinates)
-- Note: blood_needed is automatically calculated and synchronized from active blood_requests
INSERT INTO public.hospitals (
    id, name, address, municipality, phone, email,
    schedule_weekdays, schedule_weekends,
    lat, lng, coord_x, coord_y,
    blood_needed, last_updated, image
)
VALUES
(
    'bautista-hospital',
    'Bautista Hospital',
    '375 P. Burgos Ave, Caridad, Cavite City, 4100 Cavite',
    'Cavite City, Cavite',
    '(046) 431 0330',
    'bautistahospital@yahoo.com.ph',
    '24 Hours',
    '24 Hours',
    14.477249709669726,
    120.89198809547362,
    48,
    38,
    '[]'::jsonb,
    'Live',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Bautista_Hospital_in_Cavite_City_01.jpg/1280px-Bautista_Hospital_in_Cavite_City_01.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail'
),
(
    'cavite-medical-center',
    'Cavite Medical Center',
    'Manila-Cavite Road, Dalahican, Cavite City, 4100 Cavite',
    'Cavite City, Cavite',
    '(046) 431 9988',
    'cavitemedical.hr2016@gmail.com',
    '24 Hours',
    '24 Hours',
    14.463315908378089,
    120.88179693780164,
    35,
    61,
    '[]'::jsonb,
    'Live',
    'https://images1-fabric.practo.com/cavite-medical-center-cavite-1467701593-577b5959394c9.jpg'
),
(
    'dela-cruz-maternity-hospital',
    'A. Dela Cruz Maternity Hospital',
    '910 Crescini St., Caridad, Cavite City, 4100 Cavite',
    'Cavite City, Cavite',
    '(046) 431 3185',
    'adelacruzmaternityhospital@gmail.com',
    '24 Hours',
    '24 Hours',
    14.483496698118888,
    120.89475689547368,
    63,
    43,
    '[]'::jsonb,
    'Live',
    'https://images-ik.practo.com/tr:w-500,q-auto,f-auto,pr-true,dpr-auto/a-dela-cruz-maternity-hospital-cavite-1473071803-57cd4abbb4c9d.jpg'
),
(
    'dra-olivia-salamanca',
    'Dra. Olivia Salamanca Memorial District Hospital',
    'P. Gomez St., Cavite City, 4100 Cavite',
    'Cavite City, Cavite',
    '(046) 431 0552',
    'dosmh_cavite1958@yahoo.com',
    '24 Hours',
    '24 Hours',
    14.481176010033883,
    120.91143269547375,
    70,
    25,
    '[]'::jsonb,
    'Live',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSeALiH_yd6DnECwBlq3AkoGZTWH1y4n9X-WLjlPFvGFltaXaGEqii_51s&s=10'
),
(
    'cavite-naval-hospital',
    'Cavite Naval Hospital',
    'B1100 Zamora St., Fort San Felipe, Cavite City, 4100 Cavite',
    'Cavite City, Cavite',
    '(046) 431 0469',
    'cnh_operation@yahoo.com',
    '24 Hours',
    '24 Hours',
    14.483206194098917,
    120.9144529846566,
    82,
    19,
    '[]'::jsonb,
    'Live',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtu9kxOCvIMPZ2yXomcgXjT6i03nJLzqi-RMRHPD11t6nGp_dPf96hBGXp&s=10'
);

-- 7.2 Seed Webpage Admin Profile (No hospital or hospital_id association required)
INSERT INTO public.profiles (
    id, username, email, contact_number, role, hospital, hospital_id, blood_type
)
VALUES
(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Dr. Denice Salamanca, MD',
    'denicesalamanca@gmail.com',
    '09123345467',
    'Webpage Admin',
    NULL,
    NULL,
    'O+'
);

-- 7.3 Seed Patient Blood Appeals (Hospital blood_needed is automatically aggregated from these records)
INSERT INTO public.blood_requests (
    id, initials, patient_name, age, blood_type, units_needed,
    urgency, condition, hospital_id, hospital_name,
    relationship_to_patient, contact_number, email, emergency_contact, status, is_anonymous, posted_time
)
VALUES
(
    'req-1',
    'AB+',
    'James Red',
    27,
    'AB+',
    2,
    'Critical',
    'Major trauma post-surgery',
    'cavite-medical-center',
    'Cavite Medical Center',
    'Spouse',
    '09123456789',
    'james.red.emergency@gmail.com',
    'Elena Red',
    'Pending',
    false,
    NOW() - INTERVAL '3 hours'
),
(
    'req-2',
    'O-',
    'Chris P. Bacon',
    67,
    'O-',
    5,
    'Urgent',
    'Inherited blood disorder',
    'cavite-medical-center',
    'Cavite Medical Center',
    'Child',
    '09198765432',
    'baconfamilycare@gmail.com',
    'Arthur Bacon',
    'Pending',
    false,
    NOW() - INTERVAL '8 hours'
),
(
    'req-3',
    'B-',
    'Justin Case',
    18,
    'B-',
    1,
    'Critical',
    'Liver disease treatment',
    'dra-olivia-salamanca',
    'Dra. Olivia Salamanca Memorial District Hospital',
    'Mother',
    '09281234567',
    'justincase.family@gmail.com',
    'Maria Case',
    'Pending',
    false,
    NOW() - INTERVAL '1 hour'
),
(
    'req-4',
    'A+',
    'Anita Bath',
    34,
    'A+',
    4,
    'Critical',
    'Leukemia treatment',
    'bautista-hospital',
    'Bautista Hospital',
    'Sibling',
    '09351239876',
    'anita.bath.care@gmail.com',
    'Robert Bath',
    'Pending',
    false,
    NOW() - INTERVAL '7 hours'
),
(
    'req-5',
    'AB-',
    'Olive Yew',
    49,
    'AB-',
    3,
    'Urgent',
    'Hemophilia management',
    'dela-cruz-maternity-hospital',
    'A. Dela Cruz Maternity Hospital',
    'Spouse',
    '09471112233',
    'olive.yew.help@gmail.com',
    'Gregory Yew',
    'Verified',
    false,
    NOW() - INTERVAL '2 hours'
),
(
    'req-6',
    'O+',
    'Miles Ahead',
    23,
    'O+',
    2,
    'Moderate',
    'Cardiac surgery recovery',
    'cavite-medical-center',
    'Cavite Medical Center',
    'Sibling',
    '09187766554',
    'ahead.family.help@gmail.com',
    'Donna Ahead',
    'Verified',
    false,
    NOW() - INTERVAL '5 hours'
);

-- 7.4 Seed Donation Events
INSERT INTO public.donation_events (
    id, title, organizer, location, municipality, contact_details, date, time, link, created_by, created_by_email
)
VALUES
(
    'event-1',
    'Cavite Heroes Blood Drive',
    'Philippine Red Cross - Cavite City Chapter',
    'Recoletos 4th Centennial Gymnasium, Cañacao Campus of San Sebastian College-Recoletos de Cavite, Cavite City',
    'Cavite City, Cavite',
    '(046) 431-0330 / 0917-888-1234',
    'Saturday, Sep 26, 2026',
    '8:00 AM - 3:00 PM',
    'https://google.com',
    '00000000-0000-0000-0000-000000000001'::uuid,
    'denicesalamanca@gmail.com'
),
(
    'event-2',
    'Cavite City Samonte Park Mobile Blood Mission',
    'Cavite City Rural Health Unit',
    'Cavite City, Samonte Park',
    'Cavite City, Cavite',
    '(046) 431-0552 / 0918-999-5678',
    'Sunday, Oct 4, 2026',
    '9:00 AM - 4:00 PM',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    '00000000-0000-0000-0000-000000000001'::uuid,
    'denicesalamanca@gmail.com'
),
(
    'event-3',
    'Cavite City Peninsula Blood Caravan',
    'Cavite Medical Center Blood Bank',
    'Montano Hall, Cruz Herrera, Caridad, Cavite City',
    'Cavite City, Cavite',
    '(046) 431-9988 / 0920-111-2233',
    'Saturday, Oct 17, 2026',
    '8:30 AM - 2:30 PM',
    '#events',
    '00000000-0000-0000-0000-000000000001'::uuid,
    'denicesalamanca@gmail.com'
);
