-- Remote runtime controls (maintenance mode + force update)

CREATE TABLE IF NOT EXISTS public.app_runtime_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'all')),
  min_supported_version text NOT NULL DEFAULT '0.0.0',
  latest_version text,
  force_update boolean NOT NULL DEFAULT false,
  is_maintenance boolean NOT NULL DEFAULT false,
  maintenance_title text,
  maintenance_message text,
  update_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_runtime_controls IS 'Remote runtime policy for app maintenance and forced updates.';
COMMENT ON COLUMN public.app_runtime_controls.platform IS 'Target platform: android, ios, or all.';
COMMENT ON COLUMN public.app_runtime_controls.min_supported_version IS 'Minimum app version allowed to keep using the app.';
COMMENT ON COLUMN public.app_runtime_controls.update_url IS 'URL where users can download/update the app.';
COMMENT ON COLUMN public.app_runtime_controls.is_active IS 'Only one active policy per platform should exist.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_runtime_controls_active_platform
  ON public.app_runtime_controls(platform)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.set_app_runtime_controls_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_app_runtime_controls_updated_at ON public.app_runtime_controls;
CREATE TRIGGER trg_set_app_runtime_controls_updated_at
  BEFORE UPDATE ON public.app_runtime_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.set_app_runtime_controls_updated_at();

ALTER TABLE public.app_runtime_controls ENABLE ROW LEVEL SECURITY;

-- Table is managed server-side only (service_role/dashboard); clients must use the RPC below.
REVOKE ALL ON TABLE public.app_runtime_controls FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_runtime_controls TO service_role;

CREATE OR REPLACE FUNCTION public.get_app_runtime_control(p_platform text DEFAULT NULL)
RETURNS TABLE (
  platform text,
  min_supported_version text,
  latest_version text,
  force_update boolean,
  is_maintenance boolean,
  maintenance_title text,
  maintenance_message text,
  update_url text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested AS (
    SELECT CASE
      WHEN lower(coalesce(p_platform, '')) IN ('ios', 'android') THEN lower(p_platform)
      ELSE 'all'
    END AS platform
  ),
  candidate AS (
    SELECT
      c.platform,
      c.min_supported_version,
      c.latest_version,
      c.force_update,
      c.is_maintenance,
      c.maintenance_title,
      c.maintenance_message,
      c.update_url,
      c.updated_at,
      CASE
        WHEN c.is_maintenance = true AND c.platform = r.platform THEN -30
        WHEN c.is_maintenance = true AND c.platform = 'all' THEN -20
        WHEN c.force_update = true AND c.platform = 'all' THEN -10
        WHEN c.force_update = true AND c.platform = r.platform THEN -5
        WHEN c.platform = r.platform THEN 0
        WHEN c.platform = 'all' THEN 10
        ELSE 100
      END AS priority
    FROM public.app_runtime_controls c
    CROSS JOIN requested r
    WHERE c.is_active = true
      AND c.platform IN (r.platform, 'all')
  ),
  selected AS (
    SELECT
      platform,
      min_supported_version,
      latest_version,
      force_update,
      is_maintenance,
      maintenance_title,
      maintenance_message,
      update_url,
      updated_at
    FROM candidate
    ORDER BY priority ASC, updated_at DESC
    LIMIT 1
  )
  SELECT
    s.platform,
    s.min_supported_version,
    s.latest_version,
    s.force_update,
    s.is_maintenance,
    s.maintenance_title,
    s.maintenance_message,
    s.update_url,
    s.updated_at
  FROM selected s
  UNION ALL
  SELECT
    r.platform,
    '0.0.0',
    NULL,
    false,
    false,
    NULL,
    NULL,
    NULL,
    now()
  FROM requested r
  WHERE NOT EXISTS (SELECT 1 FROM selected);
$$;

REVOKE ALL ON FUNCTION public.get_app_runtime_control(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_runtime_control(text) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_runtime_controls
    WHERE platform = 'ios' AND is_active = true
  ) THEN
    INSERT INTO public.app_runtime_controls (
      platform,
      min_supported_version,
      latest_version,
      force_update,
      is_maintenance,
      is_active
    )
    VALUES ('ios', '0.0.0', '0.1.0', false, false, true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_runtime_controls
    WHERE platform = 'android' AND is_active = true
  ) THEN
    INSERT INTO public.app_runtime_controls (
      platform,
      min_supported_version,
      latest_version,
      force_update,
      is_maintenance,
      is_active
    )
    VALUES ('android', '0.0.0', '0.1.0', false, false, true);
  END IF;
END $$;
