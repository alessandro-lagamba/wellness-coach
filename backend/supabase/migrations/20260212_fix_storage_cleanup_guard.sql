-- Fix storage cleanup functions: Supabase blocks direct DELETE on storage.objects
-- unless storage.allow_delete_query is explicitly enabled for the transaction.

CREATE OR REPLACE FUNCTION public.delete_user_storage_objects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  PERFORM set_config('storage.allow_delete_query', 'true', true);

  DELETE FROM storage.objects
  WHERE bucket_id IN ('avatars', 'food-images')
    AND (
      name = OLD.id::text
      OR name LIKE (OLD.id::text || '/%')
    );

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_orphan_storage_objects(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  PERFORM set_config('storage.allow_delete_query', 'true', true);

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
