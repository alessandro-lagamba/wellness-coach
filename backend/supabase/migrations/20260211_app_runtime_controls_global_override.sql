-- Ensure global ("all") maintenance/force-update can override platform-specific rows when required.

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
