-- Retention policy for food analysis images:
-- - keep at most 60 days of image references in public.food_analyses
-- - delete from storage.objects only files in food-images no longer referenced
-- - preserve nutrition/meal textual data (only image_url is cleared)

CREATE OR REPLACE FUNCTION public.purge_expired_food_analysis_images(
  p_retention_days integer DEFAULT 60,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_retention_days integer := GREATEST(COALESCE(p_retention_days, 60), 1);
  v_limit integer := GREATEST(COALESCE(p_limit, 500), 1);
  v_rows_selected integer := 0;
  v_rows_cleared integer := 0;
  v_storage_candidates integer := 0;
  v_storage_deleted integer := 0;
BEGIN
  -- 1) Select expired rows with image_url still populated
  WITH expired AS (
    SELECT
      fa.id,
      fa.image_url,
      CASE
        WHEN fa.image_url ~ '^https?://[^/]+/storage/v1/object/public/food-images/.+'
        THEN split_part(
          regexp_replace(
            fa.image_url,
            '^https?://[^/]+/storage/v1/object/public/food-images/',
            ''
          ),
          '?',
          1
        )
        ELSE NULL
      END AS storage_name
    FROM public.food_analyses fa
    WHERE fa.image_url IS NOT NULL
      AND btrim(fa.image_url) <> ''
      AND fa.created_at < now() - make_interval(days => v_retention_days)
    ORDER BY fa.created_at ASC
    LIMIT v_limit
  )
  SELECT COUNT(*) INTO v_rows_selected FROM expired;

  IF v_rows_selected = 0 THEN
    RETURN jsonb_build_object(
      'rows_selected', 0,
      'rows_cleared', 0,
      'storage_candidates', 0,
      'storage_deleted', 0,
      'retention_days', v_retention_days,
      'limit', v_limit
    );
  END IF;

  -- 2) Count storage candidates from those expired rows
  WITH expired AS (
    SELECT
      fa.id,
      CASE
        WHEN fa.image_url ~ '^https?://[^/]+/storage/v1/object/public/food-images/.+'
        THEN split_part(
          regexp_replace(
            fa.image_url,
            '^https?://[^/]+/storage/v1/object/public/food-images/',
            ''
          ),
          '?',
          1
        )
        ELSE NULL
      END AS storage_name
    FROM public.food_analyses fa
    WHERE fa.image_url IS NOT NULL
      AND btrim(fa.image_url) <> ''
      AND fa.created_at < now() - make_interval(days => v_retention_days)
    ORDER BY fa.created_at ASC
    LIMIT v_limit
  )
  SELECT COUNT(DISTINCT storage_name)
  INTO v_storage_candidates
  FROM expired
  WHERE storage_name IS NOT NULL
    AND storage_name <> '';

  -- 3) Delete only unreferenced storage objects
  PERFORM set_config('storage.allow_delete_query', 'true', true);

  WITH expired AS (
    SELECT
      fa.id,
      CASE
        WHEN fa.image_url ~ '^https?://[^/]+/storage/v1/object/public/food-images/.+'
        THEN split_part(
          regexp_replace(
            fa.image_url,
            '^https?://[^/]+/storage/v1/object/public/food-images/',
            ''
          ),
          '?',
          1
        )
        ELSE NULL
      END AS storage_name
    FROM public.food_analyses fa
    WHERE fa.image_url IS NOT NULL
      AND btrim(fa.image_url) <> ''
      AND fa.created_at < now() - make_interval(days => v_retention_days)
    ORDER BY fa.created_at ASC
    LIMIT v_limit
  ),
  candidate_paths AS (
    SELECT DISTINCT e.storage_name
    FROM expired e
    WHERE e.storage_name IS NOT NULL
      AND e.storage_name <> ''
  ),
  still_referenced_paths AS (
    SELECT DISTINCT
      split_part(
        regexp_replace(
          fa.image_url,
          '^https?://[^/]+/storage/v1/object/public/food-images/',
          ''
        ),
        '?',
        1
      ) AS storage_name
    FROM public.food_analyses fa
    WHERE fa.image_url ~ '^https?://[^/]+/storage/v1/object/public/food-images/.+'
      AND fa.id NOT IN (SELECT id FROM expired)
  ),
  to_delete_paths AS (
    SELECT cp.storage_name
    FROM candidate_paths cp
    LEFT JOIN still_referenced_paths srp ON srp.storage_name = cp.storage_name
    WHERE srp.storage_name IS NULL
  )
  DELETE FROM storage.objects o
  USING to_delete_paths tdp
  WHERE o.bucket_id = 'food-images'
    AND o.name = tdp.storage_name;

  GET DIAGNOSTICS v_storage_deleted = ROW_COUNT;

  -- 4) Clear image_url from expired food_analyses (preserve meal/nutrition text data)
  WITH expired AS (
    SELECT fa.id
    FROM public.food_analyses fa
    WHERE fa.image_url IS NOT NULL
      AND btrim(fa.image_url) <> ''
      AND fa.created_at < now() - make_interval(days => v_retention_days)
    ORDER BY fa.created_at ASC
    LIMIT v_limit
  )
  UPDATE public.food_analyses fa
  SET
    image_url = NULL,
    updated_at = now()
  WHERE fa.id IN (SELECT id FROM expired);

  GET DIAGNOSTICS v_rows_cleared = ROW_COUNT;

  RETURN jsonb_build_object(
    'rows_selected', v_rows_selected,
    'rows_cleared', v_rows_cleared,
    'storage_candidates', v_storage_candidates,
    'storage_deleted', v_storage_deleted,
    'retention_days', v_retention_days,
    'limit', v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_food_analysis_images(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_food_analysis_images(integer, integer) TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid
    INTO v_job_id
    FROM cron.job
    WHERE jobname = 'purge_expired_food_images_daily'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'purge_expired_food_images_daily',
      '47 3 * * *',
      $job$SELECT public.purge_expired_food_analysis_images(60, 500);$job$
    );
  END IF;
END $$;
