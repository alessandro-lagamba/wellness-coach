-- Privacy/compliance hardening:
-- - server-side IP extraction for consent/deletion audit
-- - mandatory legal-consent gate for sensitive health tables
-- - storage cleanup on account deletion + orphan cleanup job
-- - security hardening for function search_path and table privileges

-- 1) Server-side request IP extractor (prefers proxy headers, fallback to client-provided value)
CREATE OR REPLACE FUNCTION public.request_ip_address(p_fallback text DEFAULT NULL)
RETURNS inet
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
  v_forwarded text;
  v_real text;
  v_candidate text;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION
    WHEN OTHERS THEN
      v_headers := NULL;
  END;

  v_forwarded := NULLIF(COALESCE(v_headers ->> 'x-forwarded-for', v_headers ->> 'X-Forwarded-For'), '');
  IF v_forwarded IS NOT NULL THEN
    v_candidate := NULLIF(btrim(split_part(v_forwarded, ',', 1)), '');
    IF v_candidate IS NOT NULL THEN
      RETURN public.safe_to_inet(v_candidate);
    END IF;
  END IF;

  v_real := NULLIF(COALESCE(v_headers ->> 'x-real-ip', v_headers ->> 'X-Real-IP'), '');
  IF v_real IS NOT NULL THEN
    RETURN public.safe_to_inet(v_real);
  END IF;

  RETURN public.safe_to_inet(p_fallback);
END;
$$;

REVOKE ALL ON FUNCTION public.request_ip_address(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_ip_address(text) TO authenticated, service_role;

-- 2) Strengthen profile compliance validator with server-side IP defaults
CREATE OR REPLACE FUNCTION public.validate_user_profile_compliance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

  IF COALESCE(NEW.terms_accepted, false) THEN
    IF NEW.terms_accepted_at IS NULL THEN
      NEW.terms_accepted_at := now();
    END IF;
    IF NEW.terms_consent_ip IS NULL THEN
      NEW.terms_consent_ip := public.request_ip_address(NULL);
    END IF;
  END IF;

  IF COALESCE(NEW.health_consent_accepted, false) THEN
    IF NEW.health_consent_accepted_at IS NULL THEN
      NEW.health_consent_accepted_at := now();
    END IF;
    IF NEW.health_consent_ip IS NULL THEN
      NEW.health_consent_ip := public.request_ip_address(NULL);
    END IF;
  END IF;

  IF NEW.deletion_status = 'scheduled' AND NEW.deletion_scheduled_for IS NULL THEN
    NEW.deletion_scheduled_for := now() + INTERVAL '60 days';
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Consent event logger: fallback to request IP when profile IP is null
CREATE OR REPLACE FUNCTION public.log_user_profile_consents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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
        COALESCE(NEW.terms_consent_ip, public.request_ip_address(NULL)),
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
        COALESCE(NEW.health_consent_ip, public.request_ip_address(NULL)),
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
      COALESCE(NEW.terms_consent_ip, public.request_ip_address(NULL)),
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
      COALESCE(NEW.health_consent_ip, public.request_ip_address(NULL)),
      'profile_update'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Deletion request: prefer server-side IP evidence
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
  v_ip inet;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF upper(btrim(COALESCE(p_confirmation_text, ''))) <> 'ELIMINA' THEN
    RAISE EXCEPTION 'INVALID_CONFIRMATION_TEXT';
  END IF;

  v_scheduled_for := now() + INTERVAL '60 days';
  v_ip := public.request_ip_address(p_ip);

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
    v_ip,
    jsonb_build_object(
      'scheduled_for', v_scheduled_for,
      'source', COALESCE(p_source, 'settings')
    ),
    now()
  );

  RETURN v_scheduled_for;
END;
$$;

-- 5) Helper used in RLS to authorize access to health-sensitive resources
CREATE OR REPLACE FUNCTION public.user_has_required_legal_consents(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = p_uid
      AND COALESCE(up.terms_accepted, false) = true
      AND COALESCE(up.health_consent_accepted, false) = true
      AND up.birth_date IS NOT NULL
      AND up.birth_date <= (current_date - INTERVAL '16 years')::date
      AND COALESCE(up.deletion_status, 'none') <> 'scheduled'
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_required_legal_consents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_required_legal_consents(uuid) TO authenticated, service_role;

-- 6) Health data table: enforce legal consent at DB policy level
DROP POLICY IF EXISTS "Users can view own health data" ON public.health_data;
DROP POLICY IF EXISTS "Users can insert own health data" ON public.health_data;
DROP POLICY IF EXISTS "Users can update own health data" ON public.health_data;
DROP POLICY IF EXISTS "Users can delete own health data" ON public.health_data;

CREATE POLICY "Users can view own health data"
  ON public.health_data
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  );

CREATE POLICY "Users can insert own health data"
  ON public.health_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  );

CREATE POLICY "Users can update own health data"
  ON public.health_data
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  );

CREATE POLICY "Users can delete own health data"
  ON public.health_data
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  );

-- 7) Daily copilot analyses are also health-sensitive
DROP POLICY IF EXISTS "Users can view their own daily copilot analyses" ON public.daily_copilot_analyses;
DROP POLICY IF EXISTS "Users can insert their own daily copilot analyses" ON public.daily_copilot_analyses;
DROP POLICY IF EXISTS "Users can update their own daily copilot analyses" ON public.daily_copilot_analyses;
DROP POLICY IF EXISTS "Users can delete their own daily copilot analyses" ON public.daily_copilot_analyses;

CREATE POLICY "Users can view their own daily copilot analyses"
  ON public.daily_copilot_analyses
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  );

CREATE POLICY "Users can insert their own daily copilot analyses"
  ON public.daily_copilot_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  );

CREATE POLICY "Users can update their own daily copilot analyses"
  ON public.daily_copilot_analyses
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  );

CREATE POLICY "Users can delete their own daily copilot analyses"
  ON public.daily_copilot_analyses
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.user_has_required_legal_consents(auth.uid())
  );

-- 8) Keep consent_events append-only for clients
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.consent_events FROM anon, authenticated;

-- 9) Cleanup storage objects when user profile is deleted (cascade from auth.users)
CREATE OR REPLACE FUNCTION public.delete_user_storage_objects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id IN ('avatars', 'food-images')
    AND (
      name = OLD.id::text
      OR name LIKE (OLD.id::text || '/%')
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_user_storage_objects ON public.user_profiles;
CREATE TRIGGER trg_delete_user_storage_objects
  BEFORE DELETE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_user_storage_objects();

-- 10) Orphan storage cleanup utility + scheduled weekly job
CREATE OR REPLACE FUNCTION public.cleanup_orphan_storage_objects(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  WITH candidates AS (
    SELECT o.id
    FROM storage.objects o
    LEFT JOIN auth.users u
      ON u.id = CASE
        WHEN split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN split_part(o.name, '/', 1)::uuid
        ELSE NULL
      END
    WHERE o.bucket_id IN ('avatars', 'food-images')
      AND split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND u.id IS NULL
    LIMIT GREATEST(COALESCE(p_limit, 500), 1)
  )
  DELETE FROM storage.objects o
  USING candidates c
  WHERE o.id = c.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_orphan_storage_objects(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_storage_objects(integer) TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid
    INTO v_job_id
    FROM cron.job
    WHERE jobname = 'cleanup_orphan_storage_objects_weekly'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'cleanup_orphan_storage_objects_weekly',
      '37 3 * * 0',
      $job$SELECT public.cleanup_orphan_storage_objects(500);$job$
    );
  END IF;
END $$;

-- 11) Silence RLS lint on app_runtime_controls while keeping table private to service role
DROP POLICY IF EXISTS "Service role full access app_runtime_controls" ON public.app_runtime_controls;
CREATE POLICY "Service role full access app_runtime_controls"
  ON public.app_runtime_controls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 12) Function search_path hardening for linted helpers
ALTER FUNCTION public.safe_to_timestamptz(text) SET search_path = public;
ALTER FUNCTION public.safe_to_bool(text) SET search_path = public;
ALTER FUNCTION public.safe_to_int(text) SET search_path = public;
ALTER FUNCTION public.safe_to_inet(text) SET search_path = public;
ALTER FUNCTION public.safe_to_date(text) SET search_path = public;
ALTER FUNCTION public.validate_user_profile_compliance() SET search_path = public;
ALTER FUNCTION public.log_user_profile_consents() SET search_path = public;
ALTER FUNCTION public.set_app_runtime_controls_updated_at() SET search_path = public;
