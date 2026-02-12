-- GDPR consent hardening + under-16 server-side validation + 60-day account deletion workflow

-- 1) Helper parsers (safe casts from metadata text values)
CREATE OR REPLACE FUNCTION public.safe_to_date(p_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::date;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_to_timestamptz(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::timestamptz;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_to_inet(p_value text)
RETURNS inet
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::inet;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_to_int(p_value text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::integer;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_to_bool(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN false
    WHEN lower(btrim(p_value)) IN ('true', 't', '1', 'yes', 'y', 'on') THEN true
    WHEN lower(btrim(p_value)) IN ('false', 'f', '0', 'no', 'n', 'off') THEN false
    ELSE false
  END;
$$;

-- 2) Extend user_profiles with consent/deletion fields
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_consent_ip inet,
  ADD COLUMN IF NOT EXISTS health_consent_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_consent_ip inet,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_status text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.user_profiles.birth_date IS 'Date of birth used for age compliance checks (>=16).';
COMMENT ON COLUMN public.user_profiles.terms_accepted IS 'Current state of Terms/Privacy acceptance.';
COMMENT ON COLUMN public.user_profiles.terms_accepted_at IS 'Timestamp of latest Terms/Privacy acceptance.';
COMMENT ON COLUMN public.user_profiles.health_consent_accepted IS 'Current state of explicit health-data consent (GDPR Art.9).';
COMMENT ON COLUMN public.user_profiles.health_consent_accepted_at IS 'Timestamp of latest health-data consent acceptance.';
COMMENT ON COLUMN public.user_profiles.consent_version IS 'Version of legal copy accepted by the user.';
COMMENT ON COLUMN public.user_profiles.deletion_requested_at IS 'When account deletion was requested.';
COMMENT ON COLUMN public.user_profiles.deletion_scheduled_for IS 'When account hard deletion is scheduled (request + 60 days).';
COMMENT ON COLUMN public.user_profiles.deletion_status IS 'Deletion workflow status: none|scheduled|completed.';

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_deletion_status_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_deletion_status_check
  CHECK (deletion_status IN ('none', 'scheduled', 'completed'));

-- 3) Normalize/extend gender constraint to include non_binary
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%gender%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_gender_check
  CHECK (
    gender IS NULL OR gender = ANY (ARRAY['male', 'female', 'other', 'non_binary', 'prefer_not_to_say'])
  );

-- 4) Consent events append-only audit table
CREATE TABLE IF NOT EXISTS public.consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('terms_privacy', 'health_data')),
  accepted boolean NOT NULL,
  consent_version text,
  consented_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_events_user_id ON public.consent_events(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_events_type_time ON public.consent_events(consent_type, consented_at DESC);

ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own consent events" ON public.consent_events;
CREATE POLICY "Users can view own consent events"
  ON public.consent_events
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own consent events" ON public.consent_events;
CREATE POLICY "Users can insert own consent events"
  ON public.consent_events
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

-- 5) Server-side compliance validation on user_profiles
CREATE OR REPLACE FUNCTION public.validate_user_profile_compliance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL AND NEW.birth_date > current_date THEN
    RAISE EXCEPTION 'BIRTH_DATE_IN_FUTURE';
  END IF;

  IF NEW.birth_date IS NOT NULL THEN
    NEW.age := EXTRACT(YEAR FROM age(current_date, NEW.birth_date))::int;
  END IF;

  IF COALESCE(NEW.terms_accepted, false) OR COALESCE(NEW.health_consent_accepted, false) THEN
    IF NEW.birth_date IS NULL THEN
      RAISE EXCEPTION 'BIRTH_DATE_REQUIRED_FOR_CONSENT';
    END IF;

    IF NEW.birth_date > (current_date - INTERVAL '16 years')::date THEN
      RAISE EXCEPTION 'UNDERAGE_NOT_ALLOWED';
    END IF;
  END IF;

  IF COALESCE(NEW.health_consent_accepted, false) AND NOT COALESCE(NEW.terms_accepted, false) THEN
    RAISE EXCEPTION 'TERMS_CONSENT_REQUIRED_BEFORE_HEALTH_CONSENT';
  END IF;

  IF COALESCE(NEW.terms_accepted, false) AND NEW.terms_accepted_at IS NULL THEN
    NEW.terms_accepted_at := now();
  END IF;

  IF COALESCE(NEW.health_consent_accepted, false) AND NEW.health_consent_accepted_at IS NULL THEN
    NEW.health_consent_accepted_at := now();
  END IF;

  IF NEW.deletion_status = 'scheduled' AND NEW.deletion_scheduled_for IS NULL THEN
    NEW.deletion_scheduled_for := now() + INTERVAL '60 days';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_user_profile_compliance ON public.user_profiles;
CREATE TRIGGER trg_validate_user_profile_compliance
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_profile_compliance();

-- 6) Log consent state changes into consent_events
CREATE OR REPLACE FUNCTION public.log_user_profile_consents()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.terms_accepted, false) THEN
      INSERT INTO public.consent_events(user_id, consent_type, accepted, consent_version, consented_at, ip, source)
      VALUES (
        NEW.id,
        'terms_privacy',
        true,
        NEW.consent_version,
        COALESCE(NEW.terms_accepted_at, now()),
        NEW.terms_consent_ip,
        'profile_insert'
      );
    END IF;

    IF COALESCE(NEW.health_consent_accepted, false) THEN
      INSERT INTO public.consent_events(user_id, consent_type, accepted, consent_version, consented_at, ip, source)
      VALUES (
        NEW.id,
        'health_data',
        true,
        NEW.consent_version,
        COALESCE(NEW.health_consent_accepted_at, now()),
        NEW.health_consent_ip,
        'profile_insert'
      );
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.terms_accepted IS DISTINCT FROM OLD.terms_accepted THEN
    INSERT INTO public.consent_events(user_id, consent_type, accepted, consent_version, consented_at, ip, source)
    VALUES (
      NEW.id,
      'terms_privacy',
      COALESCE(NEW.terms_accepted, false),
      NEW.consent_version,
      COALESCE(NEW.terms_accepted_at, now()),
      NEW.terms_consent_ip,
      'profile_update'
    );
  END IF;

  IF NEW.health_consent_accepted IS DISTINCT FROM OLD.health_consent_accepted THEN
    INSERT INTO public.consent_events(user_id, consent_type, accepted, consent_version, consented_at, ip, source)
    VALUES (
      NEW.id,
      'health_data',
      COALESCE(NEW.health_consent_accepted, false),
      NEW.consent_version,
      COALESCE(NEW.health_consent_accepted_at, now()),
      NEW.health_consent_ip,
      'profile_update'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_user_profile_consents ON public.user_profiles;
CREATE TRIGGER trg_log_user_profile_consents
  AFTER INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_profile_consents();

-- 7) Sync auth.users metadata into user_profiles (for email + social flows)
CREATE OR REPLACE FUNCTION public.sync_user_profile_from_auth_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_gender text;
  v_birth_date date;
  v_age integer;
  v_terms_accepted boolean;
  v_terms_accepted_at timestamptz;
  v_terms_ip inet;
  v_health_accepted boolean;
  v_health_accepted_at timestamptz;
  v_health_ip inet;
  v_consent_version text;
BEGIN
  v_gender := NULLIF(meta ->> 'gender', '');
  IF v_gender = 'non-binary' THEN
    v_gender := 'non_binary';
  END IF;
  IF v_gender IS NOT NULL AND v_gender NOT IN ('male', 'female', 'other', 'non_binary', 'prefer_not_to_say') THEN
    v_gender := NULL;
  END IF;

  v_birth_date := public.safe_to_date(meta ->> 'birth_date');
  v_age := COALESCE(public.safe_to_int(meta ->> 'age'), CASE WHEN v_birth_date IS NOT NULL THEN EXTRACT(YEAR FROM age(current_date, v_birth_date))::int ELSE NULL END);
  v_terms_accepted := public.safe_to_bool(meta ->> 'terms_consent_accepted');
  v_terms_accepted_at := public.safe_to_timestamptz(meta ->> 'terms_consent_accepted_at');
  v_terms_ip := public.safe_to_inet(meta ->> 'terms_consent_ip');
  v_health_accepted := public.safe_to_bool(meta ->> 'health_consent_accepted');
  v_health_accepted_at := public.safe_to_timestamptz(meta ->> 'health_consent_accepted_at');
  v_health_ip := public.safe_to_inet(meta ->> 'health_consent_ip');
  v_consent_version := NULLIF(meta ->> 'consent_version', '');

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    age,
    gender,
    birth_date,
    terms_accepted,
    terms_accepted_at,
    terms_consent_ip,
    health_consent_accepted,
    health_consent_accepted_at,
    health_consent_ip,
    consent_version
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(meta ->> 'full_name', ''),
    NULLIF(meta ->> 'first_name', ''),
    NULLIF(meta ->> 'last_name', ''),
    v_age,
    v_gender,
    v_birth_date,
    v_terms_accepted,
    v_terms_accepted_at,
    v_terms_ip,
    v_health_accepted,
    v_health_accepted_at,
    v_health_ip,
    v_consent_version
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, user_profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    first_name = COALESCE(EXCLUDED.first_name, user_profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, user_profiles.last_name),
    age = COALESCE(EXCLUDED.age, user_profiles.age),
    gender = COALESCE(EXCLUDED.gender, user_profiles.gender),
    birth_date = COALESCE(user_profiles.birth_date, EXCLUDED.birth_date),
    terms_accepted = (COALESCE(user_profiles.terms_accepted, false) OR COALESCE(EXCLUDED.terms_accepted, false)),
    terms_accepted_at = COALESCE(user_profiles.terms_accepted_at, EXCLUDED.terms_accepted_at),
    terms_consent_ip = COALESCE(user_profiles.terms_consent_ip, EXCLUDED.terms_consent_ip),
    health_consent_accepted = (COALESCE(user_profiles.health_consent_accepted, false) OR COALESCE(EXCLUDED.health_consent_accepted, false)),
    health_consent_accepted_at = COALESCE(user_profiles.health_consent_accepted_at, EXCLUDED.health_consent_accepted_at),
    health_consent_ip = COALESCE(user_profiles.health_consent_ip, EXCLUDED.health_consent_ip),
    consent_version = COALESCE(EXCLUDED.consent_version, user_profiles.consent_version),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_profile_from_auth_metadata ON auth.users;
CREATE TRIGGER trg_sync_user_profile_from_auth_metadata
  AFTER INSERT OR UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_profile_from_auth_metadata();

-- 8) Backfill current profiles from auth metadata (one-shot)
INSERT INTO public.user_profiles (
  id,
  email,
  full_name,
  first_name,
  last_name,
  age,
  gender,
  birth_date,
  terms_accepted,
  terms_accepted_at,
  terms_consent_ip,
  health_consent_accepted,
  health_consent_accepted_at,
  health_consent_ip,
  consent_version
)
SELECT
  au.id,
  au.email,
  NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
  NULLIF(au.raw_user_meta_data ->> 'first_name', ''),
  NULLIF(au.raw_user_meta_data ->> 'last_name', ''),
  COALESCE(
    public.safe_to_int(au.raw_user_meta_data ->> 'age'),
    CASE
      WHEN public.safe_to_date(au.raw_user_meta_data ->> 'birth_date') IS NOT NULL
      THEN EXTRACT(YEAR FROM age(current_date, public.safe_to_date(au.raw_user_meta_data ->> 'birth_date')))::int
      ELSE NULL
    END
  ),
  CASE
    WHEN NULLIF(au.raw_user_meta_data ->> 'gender', '') = 'non-binary' THEN 'non_binary'
    WHEN NULLIF(au.raw_user_meta_data ->> 'gender', '') IN ('male', 'female', 'other', 'non_binary', 'prefer_not_to_say') THEN NULLIF(au.raw_user_meta_data ->> 'gender', '')
    ELSE NULL
  END,
  public.safe_to_date(au.raw_user_meta_data ->> 'birth_date'),
  public.safe_to_bool(au.raw_user_meta_data ->> 'terms_consent_accepted'),
  public.safe_to_timestamptz(au.raw_user_meta_data ->> 'terms_consent_accepted_at'),
  public.safe_to_inet(au.raw_user_meta_data ->> 'terms_consent_ip'),
  public.safe_to_bool(au.raw_user_meta_data ->> 'health_consent_accepted'),
  public.safe_to_timestamptz(au.raw_user_meta_data ->> 'health_consent_accepted_at'),
  public.safe_to_inet(au.raw_user_meta_data ->> 'health_consent_ip'),
  NULLIF(au.raw_user_meta_data ->> 'consent_version', '')
FROM auth.users au
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(EXCLUDED.email, user_profiles.email),
  full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
  first_name = COALESCE(EXCLUDED.first_name, user_profiles.first_name),
  last_name = COALESCE(EXCLUDED.last_name, user_profiles.last_name),
  age = COALESCE(EXCLUDED.age, user_profiles.age),
  gender = COALESCE(EXCLUDED.gender, user_profiles.gender),
  birth_date = COALESCE(user_profiles.birth_date, EXCLUDED.birth_date),
  terms_accepted = (COALESCE(user_profiles.terms_accepted, false) OR COALESCE(EXCLUDED.terms_accepted, false)),
  terms_accepted_at = COALESCE(user_profiles.terms_accepted_at, EXCLUDED.terms_accepted_at),
  terms_consent_ip = COALESCE(user_profiles.terms_consent_ip, EXCLUDED.terms_consent_ip),
  health_consent_accepted = (COALESCE(user_profiles.health_consent_accepted, false) OR COALESCE(EXCLUDED.health_consent_accepted, false)),
  health_consent_accepted_at = COALESCE(user_profiles.health_consent_accepted_at, EXCLUDED.health_consent_accepted_at),
  health_consent_ip = COALESCE(user_profiles.health_consent_ip, EXCLUDED.health_consent_ip),
  consent_version = COALESCE(EXCLUDED.consent_version, user_profiles.consent_version),
  updated_at = now();

-- 9) Account deletion request (60-day delay)
CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_confirmation_text text DEFAULT NULL,
  p_source text DEFAULT 'settings',
  p_ip text DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid;
  v_scheduled_for timestamptz;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF upper(btrim(COALESCE(p_confirmation_text, ''))) <> 'ELIMINA' THEN
    RAISE EXCEPTION 'INVALID_CONFIRMATION_TEXT';
  END IF;

  v_scheduled_for := now() + INTERVAL '60 days';

  INSERT INTO public.user_profiles (
    id,
    email,
    deletion_requested_at,
    deletion_scheduled_for,
    deletion_status
  )
  VALUES (
    v_uid,
    (SELECT email FROM auth.users WHERE id = v_uid),
    now(),
    v_scheduled_for,
    'scheduled'
  )
  ON CONFLICT (id) DO UPDATE SET
    deletion_requested_at = now(),
    deletion_scheduled_for = v_scheduled_for,
    deletion_status = 'scheduled',
    updated_at = now();

  UPDATE auth.users
  SET banned_until = v_scheduled_for
  WHERE id = v_uid;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    metadata,
    created_at
  )
  VALUES (
    v_uid,
    'account_deletion_requested',
    'account',
    v_uid,
    public.safe_to_inet(p_ip),
    jsonb_build_object(
      'scheduled_for', v_scheduled_for,
      'source', COALESCE(p_source, 'settings')
    ),
    now()
  );

  RETURN v_scheduled_for;
END;
$$;

-- 10) Batch processor for scheduled deletions (to run via cron/Edge function)
CREATE OR REPLACE FUNCTION public.process_due_account_deletions(p_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid;
  v_count integer := 0;
BEGIN
  FOR v_uid IN
    SELECT id
    FROM public.user_profiles
    WHERE deletion_status = 'scheduled'
      AND deletion_scheduled_for IS NOT NULL
      AND deletion_scheduled_for <= now()
    ORDER BY deletion_scheduled_for
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
  LOOP
    DELETE FROM auth.users WHERE id = v_uid;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 11) Secure existing hard-delete helper (self-delete or service role only)
CREATE OR REPLACE FUNCTION public.delete_user_completely(user_id_to_delete uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := auth.role();
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;

    IF v_uid <> user_id_to_delete THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;

  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.process_due_account_deletions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_due_account_deletions(integer) TO service_role;

REVOKE ALL ON FUNCTION public.delete_user_completely(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO authenticated, service_role;
